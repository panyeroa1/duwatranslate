/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  StreamingLog
} from './types';
import EventEmitter from 'eventemitter3';
import { DEFAULT_LIVE_API_MODEL } from './constants';
import { difference } from 'lodash';
import { base64ToArrayBuffer } from './utils';

/**
 * Event types that can be emitted by the MultimodalLiveClient.

 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (e: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when a tool call is received
  toolcall: (toolCall: LiveServerToolCall) => void;
  // Emitted when a tool call is cancelled
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
  inputTranscription: (text: string, isFinal: boolean) => void;
  outputTranscription: (text: string, isFinal: boolean) => void;
}

// FIX: Refactor to use composition over inheritance for EventEmitter.
export class GenAILiveClient {
  // FIX: Use an internal EventEmitter instance.
  private readonly emitter = new EventEmitter<LiveClientEventTypes>();

  // FIX: Expose on/off methods.
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  public readonly model: string = DEFAULT_LIVE_API_MODEL;

  protected websocket?: WebSocket;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  public get status() {
    return this._status;
  }

  /**
   * Creates a new GenAILiveClient instance.
   * @param apiKey - (Unused) API key is handled by the backend
   * @param model - Optional model name to override the default model
   */
  constructor(apiKey: string, model?: string) {
    if (model) this.model = model;
  }

  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this._status = 'connecting';
    const wsUrl = `ws://localhost:8000/ws`;

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(wsUrl);
        this.websocket.binaryType = 'arraybuffer';

        this.websocket.onopen = () => {
          this._status = 'connected';
          // Send initial config
          this.websocket?.send(JSON.stringify({
            model: this.model,
            config: config
          }));
          this.onOpen();
          resolve(true);
        };

        this.websocket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Audio data
            this.emitter.emit('audio', event.data);
          } else {
            // JSON messages
            const message = JSON.parse(event.data);
            this.handleBackendMessage(message);
          }
        };

        this.websocket.onerror = (e) => {
          this._status = 'disconnected';
          this.onError(new ErrorEvent('WebSocket error'));
          reject(e);
        };

        this.websocket.onclose = (e) => {
          this._status = 'disconnected';
          this.onClose(e);
        };

      } catch (e: any) {
        this._status = 'disconnected';
        this.onError(new ErrorEvent('Connection failed', { error: e }));
        reject(e);
      }
    });
  }

  private handleBackendMessage(message: any) {
    // Backend sends the model_dump of LiveServerMessage
    if (message.setup_complete || message.setupComplete) {
      this.emitter.emit('setupcomplete');
      return;
    }

    if (message.server_content || message.serverContent) {
      const serverContent = message.server_content || message.serverContent;

      if (serverContent.interrupted) {
        this.emitter.emit('interrupted');
        return;
      }

      if (serverContent.input_transcription || serverContent.inputTranscription) {
        const trans = serverContent.input_transcription || serverContent.inputTranscription;
        this.emitter.emit('inputTranscription', trans.text, trans.is_final || trans.isFinal || false);
      }

      if (serverContent.output_transcription || serverContent.outputTranscription) {
        const trans = serverContent.output_transcription || serverContent.outputTranscription;
        this.emitter.emit('outputTranscription', trans.text, trans.is_final || trans.isFinal || false);
      }

      if (serverContent.model_turn || serverContent.modelTurn) {
        const turn = serverContent.model_turn || serverContent.modelTurn;
        if (turn.parts) {
          // We filter out audio parts as they are sent as binary chunks in this implementation
          const textParts = turn.parts.filter((p: any) => !p.inline_data && !p.inlineData);
          if (textParts.length > 0) {
            this.emitter.emit('content', { modelTurn: { parts: textParts } });
          }
        }
      }

      if (serverContent.turn_complete || serverContent.turnComplete) {
        this.emitter.emit('turncomplete');
      }
    }
  }

  public disconnect() {
    this.websocket?.close();
    this.websocket = undefined;
    this._status = 'disconnected';
    this.log('client.close', `Disconnected`);
    return true;
  }

  public send(parts: Part | Part[], turnComplete: boolean = true) {
    if (this._status !== 'connected' || !this.websocket) {
      this.emitter.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    const message = {
      client_content: { turns: Array.isArray(parts) ? parts : [parts], turnComplete }
    };
    this.websocket.send(JSON.stringify(message));
    this.log(`client.send`, parts);
  }

  public sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (this._status !== 'connected' || !this.websocket) {
      return;
    }
    chunks.forEach(chunk => {
      if (chunk.mimeType.includes('audio')) {
        // Send as binary for performance
        const buffer = base64ToArrayBuffer(chunk.data);
        this.websocket?.send(buffer);
      } else {
        // Other types (if any) as JSON
        this.websocket?.send(JSON.stringify({ realtime_input: { media: chunk } }));
      }
    });
  }

  public sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (this._status !== 'connected' || !this.websocket) {
      return;
    }
    this.websocket.send(JSON.stringify({ tool_response: toolResponse }));
  }

  protected onMessage(message: LiveServerMessage) {
    if (message.setupComplete) {
      // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
      this.emitter.emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      this.log('server.toolCall', message);
      // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
      this.emitter.emit('toolcall', message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log('receive.toolCallCancellation', message);
      // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
      this.emitter.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      if (serverContent.interrupted) {
        this.log('receive.serverContent', 'interrupted');
        // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
        this.emitter.emit('interrupted');
        return;
      }

      if (serverContent.inputTranscription) {
        // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
        this.emitter.emit(
          'inputTranscription',
          serverContent.inputTranscription.text,
          // FIX: Property 'isFinal' does not exist on type 'Transcription'.
          (serverContent.inputTranscription as any).isFinal ?? false,
        );
        this.log(
          'server.inputTranscription',
          serverContent.inputTranscription.text,
        );
      }

      if (serverContent.outputTranscription) {
        // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
        this.emitter.emit(
          'outputTranscription',
          serverContent.outputTranscription.text,
          // FIX: Property 'isFinal' does not exist on type 'Transcription'.
          (serverContent.outputTranscription as any).isFinal ?? false,
        );
        this.log(
          'server.outputTranscription',
          serverContent.outputTranscription.text,
        );
      }

      if (serverContent.modelTurn) {
        let parts: Part[] = serverContent.modelTurn.parts || [];

        const audioParts = parts.filter(p =>
          p.inlineData?.mimeType?.startsWith('audio/pcm'),
        );
        const base64s = audioParts.map(p => p.inlineData?.data);
        const otherParts = difference(parts, audioParts);

        base64s.forEach(b64 => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
            this.emitter.emit('audio', data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });

        if (otherParts.length > 0) {
          const content: LiveServerContent = { modelTurn: { parts: otherParts } };
          // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
          this.emitter.emit('content', content);
          this.log(`server.content`, message);
        }
      }

      if (serverContent.turnComplete) {
        this.log('server.send', 'turnComplete');
        // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
        this.emitter.emit('turncomplete');
      }
    }
  }

  protected onError(e: ErrorEvent) {
    this._status = 'disconnected';
    console.error('error:', e);

    const message = `Could not connect to GenAI Live: ${e.message}`;
    this.log(`server.${e.type}`, message);
    // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
    this.emitter.emit('error', e);
  }

  protected onOpen() {
    this._status = 'connected';
    // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
    this.emitter.emit('open');
  }

  protected onClose(e: CloseEvent) {
    this._status = 'disconnected';
    let reason = e.reason || '';
    if (reason.toLowerCase().includes('error')) {
      const prelude = 'ERROR]';
      const preludeIndex = reason.indexOf(prelude);
      if (preludeIndex > 0) {
        reason = reason.slice(preludeIndex + prelude.length + 1, Infinity);
      }
    }

    this.log(
      `server.${e.type}`,
      `disconnected ${reason ? `with reason: ${reason}` : ``}`
    );
    // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
    this.emitter.emit('close', e);
  }

  /**
   * Internal method to emit a log event.
   * @param type - Log type
   * @param message - Log message
   */
  protected log(type: string, message: string | object) {
    // FIX: Changed this.emit to this.emitter.emit to fix property does not exist error.
    this.emitter.emit('log', {
      type,
      message,
      date: new Date(),
    });
  }
}
