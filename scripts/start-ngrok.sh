#!/bin/bash

# Hexagon Chat + Ngrok Startup Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Hexagon Chat + Ngrok Setup ===${NC}"

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}ngrok not installed. Installing...${NC}"
    brew install ngrok
fi

# Detect if Docker is running
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "hexagon-chat-hexagonchat"; then
    echo -e "${YELLOW}Using Docker mode${NC}"
    MODE="docker"
    PORT=$(docker compose port hexagonchat 3000 | grep -oP ': \K\d+' || echo "3000")
elif pgrep -f "nuxt" > /dev/null || pgrep -x "node" > /dev/null; then
    echo -e "${YELLOW}Using local dev server mode${NC}"
    MODE="local"
    PORT=3000
else
    echo -e "${RED}No app detected. Please start the app first:${NC}"
    echo "  Local:  npm run dev"
    echo "  Docker: docker compose up -d"
    exit 1
fi

echo -e "${GREEN}Starting ngrok on port $PORT...${NC}"

# Kill any existing ngrok
pkill -f ngrok 2>/dev/null

# Start ngrok
ngrok http $PORT --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get URL
URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oP '"public_url":"https://[^"]+' | head -1 | grep -oP 'https://.*' || echo "")

if [ -z "$URL" ]; then
    # Alternative method
    URL=$(grep -oP 'https://[a-zA-Z0-9.-]+\.ngrok-free\.app' /tmp/ngrok.log | head -1)
fi

if [ -z "$URL" ]; then
    echo -e "${RED}Failed to get ngrok URL. Check /tmp/ngrok.log${NC}"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}=== 🎉 Access Your App ===${NC}"
echo -e "URL: ${YELLOW}$URL${NC}"
echo ""
echo "Ctrl+C to stop"
echo ""

# Wait for Ctrl+C
trap "echo -e '\n${YELLOW}Stopping...${NC}'; kill $NGROK_PID 2>/dev/null" EXIT

# Keep script running
wait