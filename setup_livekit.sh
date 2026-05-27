#!/bin/bash

# Configuration
ENV_FILE=".env"
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="secret"
CONTAINER_NAME="livekit-dev"

echo "====================================="
echo "🔄 Checking LiveKit self-hosted setup..."
echo "====================================="

# 1. Detect environment and get Public IP (AWS EC2 vs Local Developer)
# Priority 1: Check AWS IMDSv2 / IMDSv1 metadata service (IMDSv2 tokens first)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 10" --connect-timeout 2)
if [ -n "$TOKEN" ]; then
    PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 --connect-timeout 2)
else
    # Fallback to IMDSv1 if token is not available
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 --connect-timeout 2)
fi

if [ -n "$PUBLIC_IP" ]; then
    echo "☁️ Detected AWS EC2 environment. Public IP: $PUBLIC_IP"
else
    # Fallback to local machine detection
    echo "🏠 Detected local development environment."
    PUBLIC_IP="127.0.0.1"
fi

LIVEKIT_URL="ws://${PUBLIC_IP}:7880"

# 2. Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker CLI could not be found. Please install Docker."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker Desktop or the docker service before running this server."
    exit 1
fi

# 3. Check if LiveKit container is running or exists
CREATE_NEW=true
if [ "$(docker ps -a -q -f name=^/${CONTAINER_NAME}$)" ]; then
    # If the container exists, check if the existing env node IP matches the current PUBLIC_IP
    EXISTING_IP=$(docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' $CONTAINER_NAME 2>/dev/null | grep LIVEKIT_NODE_IP | cut -d= -f2)
    if [ "$EXISTING_IP" != "$PUBLIC_IP" ]; then
        echo "🔄 LiveKit node IP changed from '$EXISTING_IP' to '$PUBLIC_IP'. Recreating container..."
        docker stop $CONTAINER_NAME &>/dev/null
        docker rm $CONTAINER_NAME &>/dev/null
        CREATE_NEW=true
    else
        CREATE_NEW=false
        # Exists and matches, check if running
        if [ "$(docker ps -q -f name=^/${CONTAINER_NAME}$)" ]; then
            echo "✅ LiveKit server is already running with correct IP: $PUBLIC_IP"
        else
            echo "⚠️ LiveKit server exists but is stopped. Starting it..."
            docker start $CONTAINER_NAME
        fi
    fi
fi

if [ "$CREATE_NEW" = true ]; then
    # Does not exist or needs update, pull and run
    echo "📥 Creating and starting LiveKit server container..."
    docker run -d --name $CONTAINER_NAME \
      --restart unless-stopped \
      -p 7880:7880 \
      -p 7881:7881 \
      -p 7882:7882/udp \
      -e LIVEKIT_KEYS="${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}" \
      -e LIVEKIT_NODE_IP="$PUBLIC_IP" \
      livekit/livekit-server --dev

    if [ $? -eq 0 ]; then
        echo "✅ LiveKit server started successfully."
    else
        echo "❌ Failed to start LiveKit server."
        exit 1
    fi
fi

# 4. Setup .env
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️ $ENV_FILE file not found. Creating a new one..."
    touch "$ENV_FILE"
fi

# Function to update or append env var securely (cross-platform, replaces stale values)
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$ENV_FILE"; then
        # Value is already set. Let's see if it is different.
        local current_val=$(grep "^${key}=" "$ENV_FILE" | cut -d= -f2-)
        if [ "$current_val" != "$value" ]; then
            echo "🔄 Updating $key in $ENV_FILE to: $value"
            grep -v "^${key}=" "$ENV_FILE" > "${ENV_FILE}.tmp"
            echo "${key}=${value}" >> "${ENV_FILE}.tmp"
            mv "${ENV_FILE}.tmp" "$ENV_FILE"
        else
            echo "ℹ️ $key is already set to the correct value."
        fi
    else
        echo "➕ Adding $key to $ENV_FILE: $value"
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

update_env "LIVEKIT_URL" "$LIVEKIT_URL"
update_env "LIVEKIT_API_KEY" "$LIVEKIT_API_KEY"
update_env "LIVEKIT_API_SECRET" "$LIVEKIT_API_SECRET"

echo "====================================="
echo "🎉 LiveKit setup complete."
echo "====================================="
