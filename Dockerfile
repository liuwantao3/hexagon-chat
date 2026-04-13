ARG NODE_VERSION=20.19.0

FROM node:${NODE_VERSION}-slim

RUN apt-get update && apt-get install -y openssl iputils-ping net-tools

WORKDIR /app

# DATABASE_URL environment variable takes precedence over .env file configuration
ENV DATABASE_URL=file:/app/sqlite/HexagonChat.sqlite

COPY package-lock.json package.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci --legacy-peer-deps

COPY . .

RUN npm run prisma-generate

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

EXPOSE 3000

CMD ["sh", "/app/scripts/startup.sh"]
