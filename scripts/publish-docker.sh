#!/bin/bash

# Build and publish to Docker Hub

DOCKER_USERNAME="your-username"
IMAGE_NAME="hexagon-chat"

echo "Logging in to Docker Hub..."
docker login

echo "Building images..."
docker compose build

echo "Tagging images..."
docker tag hexagon-chat-hexagonchat ${DOCKER_USERNAME}/${IMAGE_NAME}:latest
docker tag hexagon-chat-code-runner ${DOCKER_USERNAME}/${IMAGE_NAME}-code-runner:latest

echo "Pushing to Docker Hub..."
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}-code-runner:latest

echo "Done! Use these commands on the server:"
echo "  docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
echo "  docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}-code-runner:latest"