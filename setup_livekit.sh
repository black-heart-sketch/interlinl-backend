#!/bin/bash

# Configuration
ENV_FILE=".env"
LIVEKIT_URL="ws://localhost:7880"
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="secret"
CONTAINER_NAME="livekit-dev"

echo "====================================="
echo "🔄 Checking LiveKit self-hosted setup..."
echo "====================================="

# 1. Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker CLI could not be found. Please install Docker."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker Desktop or the docker service before running this server."
    exit 1
fi

# 2. Check if LiveKit container is running or exists
if [ "$(docker ps -a -q -f name=^/${CONTAINER_NAME}$)" ]; then
    # Exists, check if running
    if [ "$(docker ps -q -f name=^/${CONTAINER_NAME}$)" ]; then
        echo "✅ LiveKit server is already running."
    else
        echo "⚠️ LiveKit server exists but is stopped. Starting it..."
        docker start $CONTAINER_NAME
    fi
else
    # Does not exist, pull and run
    echo "📥 LiveKit server not found. Pulling image and starting it up..."
    docker run -d --name $CONTAINER_NAME \
      --restart unless-stopped \
      -p 7880:7880 \
      -p 7881:7881 \
      -p 7882:7882/udp \
      -e LIVEKIT_KEYS="${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}" \
      -e LIVEKIT_NODE_IP="127.0.0.1" \
      livekit/livekit-server --dev

    if [ $? -eq 0 ]; then
        echo "✅ LiveKit server started successfully."
    else
        echo "❌ Failed to start LiveKit server."
        exit 1
    fi
fi

# 3. Setup .env
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️ .env file not found. Creating a new one..."
    touch "$ENV_FILE"
fi

# Function to update or append env var
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$ENV_FILE"; then
        echo "ℹ️ $key is already set."
    else
        echo "➕ Adding $key to .env"
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

update_env "LIVEKIT_URL" "$LIVEKIT_URL"
update_env "LIVEKIT_API_KEY" "$LIVEKIT_API_KEY"
update_env "LIVEKIT_API_SECRET" "$LIVEKIT_API_SECRET"

echo "====================================="
echo "🎉 LiveKit setup complete."
echo "====================================="
