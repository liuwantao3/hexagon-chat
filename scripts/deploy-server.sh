#!/bin/bash

# Pull and deploy on Linux server

DOCKER_USERNAME="${1:-your-username}"
IMAGE_NAME="hexagon-chat"

echo "Logging in to Docker Hub..."
docker login

echo "Pulling images..."
docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:latest
docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}-code-runner:latest

echo "Tagging for docker-compose..."
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}:latest hexagon-chat-hexagonchat:latest
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}-code-runner:latest hexagon-chat-code-runner:latest

echo "Creating .env file..."
cat > .env << 'EOF'
# Add your API keys here
NUXT_OPENAI_API_KEY=sk-xxx
NUXT_GEMINI_API_KEY=xxx
NUXT_MINIMAX_API_KEY=xxx
NUXT_MODEL_PROXY_URL=socks5://127.0.0.1:1080
EOF

# Start services
echo "Starting services..."
docker compose up -d

echo ""
echo "=== 🎉 Deployed! ==="
echo "Check status: docker compose ps"
echo "View logs: docker compose logs -f"