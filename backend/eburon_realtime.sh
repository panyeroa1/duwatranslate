#!/bin/bash

# Configuration
IMAGE_NAME="eburon-realtime"
CONTAINER_NAME="eburon-realtime-inst"
PORT=8000

# check if .env.local exists in parent dir
if [ -f "../.env.local" ]; then
    echo "Loading GOOGLE_API_KEY from ../.env.local"
    API_KEY=$(grep GOOGLE_API_KEY ../.env.local | cut -d '=' -f2)
else
    echo "Error: ../.env.local not found. Please ensure GOOGLE_API_KEY is defined there."
    exit 1
fi

echo "Building Docker image: $IMAGE_NAME..."
docker build -t $IMAGE_NAME .

# Stop and remove existing container if it exists
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "Stopping and removing existing container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

echo "Starting Eburon Realtime container..."
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:8000 \
    -e GOOGLE_API_KEY=$API_KEY \
    $IMAGE_NAME

echo "Eburon Realtime is running on port $PORT"
echo "Log into container with: docker logs -f $CONTAINER_NAME"
