import os
import json
import asyncio
import base64
import logging
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("eburon-realtime")

app = FastAPI(title="Eburon Realtime Backend")

# Try several possible locations for environment variables
env_locations = [
    Path(__file__).parent / ".env",          # backend/.env
    Path(__file__).parent.parent / ".env",   # root/.env
    Path(__file__).parent.parent / ".env.local" # root/.env.local
]

for loc in env_locations:
    try:
        if loc.exists():
            load_dotenv(loc)
    except Exception as e:
        # Use basic logging if logger fails or is somehow not ready
        print(f"Warning: Could not check environment file {loc}: {e}")

load_dotenv() # Also load from CWD

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

if not GOOGLE_API_KEY:
    logger.error("GOOGLE_API_KEY not found in environment variables")

client = genai.Client(api_key=GOOGLE_API_KEY, http_options={'api_version': 'v1alpha'})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to Eburon Realtime")
    
    genai_session = None
    
    async def send_to_frontend(message):
        """Helper to send messages back to the frontend."""
        try:
            if isinstance(message, bytes):
                # Binary audio data
                await websocket.send_bytes(message)
            else:
                # JSON control messages
                await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending to frontend: {e}")

    try:
        # First message from frontend should be the config
        init_message = await websocket.receive_json()
        model_name = init_message.get("model", "gemini-2.0-flash-exp")
        config = init_message.get("config", {})
        
        logger.info(f"Starting session with model: {model_name}")

        async with client.aio.live.connect(model=model_name, config=config) as session:
            genai_session = session
            
            # Create a task to handle incoming messages from Google to Frontend
            async def google_to_frontend():
                try:
                    async for message in session.receive():
                        # Process server messages
                        # If message has audio, send it
                        server_content = getattr(message, 'server_content', None)
                        if server_content and server_content.model_turn:
                            for part in server_content.model_turn.parts:
                                if part.inline_data and part.inline_data.mime_type.startswith("audio/pcm"):
                                    # Send raw audio bytes
                                    await send_to_frontend(part.inline_data.data)
                        
                        # Send the whole message as JSON for other content (text, tools, etc)
                        try:
                            msg_dict = {}
                            model_dump = getattr(message, 'model_dump', None)
                            if callable(model_dump):
                                msg_dict = model_dump(exclude_none=True)
                            else:
                                to_dict = getattr(message, 'dict', None)
                                if callable(to_dict):
                                    msg_dict = to_dict(exclude_none=True)
                                else:
                                    # Very defensive fallback
                                    msg_dict = {k: v for k, v in vars(message).items() if not k.startswith('_')}
                            
                            if msg_dict:
                                await send_to_frontend(msg_dict)
                        except Exception as dump_err:
                            logger.error(f"Error dumping message to JSON: {dump_err}")
                except Exception as e:
                    logger.error(f"Error in google_to_frontend: {e}")

            # Create a task to handle incoming messages from Frontend to Google
            async def frontend_to_google():
                try:
                    while True:
                        # Receive from frontend
                        # This could be JSON (text parts, tools) or Binary (audio chunks)
                        try:
                            message = await websocket.receive()
                            
                            if "text" in message:
                                data = json.loads(message["text"])
                                # It's a control message or text turn
                                if "realtime_input" in data:
                                    # Handle base64 audio from frontend if they send it as JSON
                                    # But we prefer binary for performance
                                    pass
                                elif "client_content" in data:
                                    await session.send(data["client_content"], end_of_turn=data.get("turn_complete", True))
                                elif "tool_response" in data:
                                    await session.send(data["tool_response"])
                            
                            elif "bytes" in message:
                                # It's raw PCM audio chunk
                                await session.send(input=types.LiveClientRealtimeInput(
                                    media=types.LiveClientMedia(
                                        mime_type="audio/pcm;rate=16000",
                                        data=message["bytes"]
                                    )
                                ))
                                
                        except WebSocketDisconnect:
                            break
                        except Exception as e:
                            logger.error(f"Error in frontend_to_google: {e}")
                except Exception as e:
                    logger.error(f"Error in outer frontend_to_google: {e}")

            # Run both proxy directions concurrently
            await asyncio.gather(google_to_frontend(), frontend_to_google())

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Session error: {e}")
    finally:
        logger.info("Cleaned up Eburon Realtime session")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
