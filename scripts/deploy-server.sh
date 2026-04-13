#!/bin/bash

# Pull and deploy on Linux server

DOCKER_USERNAME="${1:-your-username}"
IMAGE_NAME="hexagon-chat"

echo "Logging in to Docker Hub..."
docker login

echo "Pulling custom images..."
docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:latest
docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}-code-runner:latest

echo "Tagging..."
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}:latest hexagon-chat-hexagonchat:latest
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}-code-runner:latest hexagon-chat-code-runner:latest

# Modify docker-compose.yaml to use images instead of building
echo "Updating docker-compose.yaml..."
sed -i 's/^build:$/image: ${DOCKER_USERNAME}\/${IMAGE_NAME}:latest/' docker-compose.yaml
sed -i 's/^  code-runner:$/  code-runner:\n    image: ${DOCKER_USERNAME}\/${IMAGE_NAME}-code-runner:latest/' docker-compose.yaml

echo "Creating .env file..."
cat > .env << 'EOF'
# Add your API keys here
SECRET=change-this-secret-in-production
NUXT_OPENAI_API_KEY=sk-xxx
NUXT_GEMINI_API_KEY=xxx
NUXT_MINIMAX_API_KEY=xxx
NUXT_MODEL_PROXY_URL=socks5://127.0.0.1:1080
EOF

# Start services (will auto-pull chromadb + redis)
echo "Starting services..."
docker compose up -d

echo ""
echo "=== 🎉 Deployed! ==="
echo "Web app: http://localhost:3000"
echo "ChromaDB: http://localhost:8000"
echo "Redis: localhost:6379"
echo "Check status: docker compose ps"