English | [简体中文](README.zh-Hans.md)

# Hexagon Chat

`Hexagon Chat` is an open-source chatbot platform based on LLMs. It supports a wide range of language models including:

- Ollama
- OpenAI
- Azure OpenAI
- Anthropic
- Moonshot
- MiniMax
- Gemini
- Groq

`Hexagon Chat` supports multiple chat modes:

- Free chat with LLMs
- Chat with knowledge bases (RAG)
- Interactive sandbox for web development
- Web research with source citations

`Hexagon Chat` feature list:

- Ollama models management
- Knowledge bases (RAG) with Chroma/Milvus
- Chat interface
- Multiple LLM provider API keys management
- Code sandbox for HTML/CSS/JS execution
- Web researcher skill
- PDF editor skill
- MCP server builder
- PowerPoint generator
- Code execution environment
- Stories (Voice & Audio generation)
- Multi-model support with vision capabilities
- Multi-language support (i18n)
- User authentication
- Redis caching

## Quick Start

As a user of `Hexagon Chat`, please walk through the document below to ensure you have all components up and running before starting.

### Supported Vector Databases

`Hexagon Chat` supports 2 types of vector databases: Milvus and Chroma.

Please refer to the `.env.example` for configuration:

```
# Supported values: chroma, milvus
VECTOR_STORE=chroma
CHROMADB_URL=http://localhost:8000
MILVUS_URL=http://localhost:19530
```

By default `Hexagon Chat` uses Chroma. To use Milvus, set `VECTOR_STORE` to `milvus` and specify the URL.

### Use with Nuxt 3 Development Server

If you'd like to run with the latest code base and apply changes as needed:

1. Install and run Ollama server

    Follow [Ollama](https://github.com/ollama/ollama) installation. By default, it runs on http://localhost:11434.

2. Install Chroma

    Refer to [https://docs.trychroma.com/getting-started](https://docs.trychroma.com/getting-started).

    ```bash
    docker pull chromadb/chroma
    docker run -d -p 8000:8000 chromadb/chroma
    ```

3. Hexagon Setup

    3.1 Copy the `.env.example` file to `.env`:

    ```bash
    cp .env.example .env
    ```

    3.2 Install dependencies:

    ```bash
    pnpm install
    ```

    3.3 Run Prisma migrate to create database tables:

    ```bash
    pnpm prisma-migrate
    ```

4. Launch Development Server

    > Make sure both __[Ollama Server](#ollama-server)__ and __[ChromaDB](#install-chromadb-and-startup)__ are running.

    ```bash
    pnpm dev
    ```

### Use with Docker

The easiest way to use `Hexagon Chat`.

```shell
$ docker compose up
```

Since `Hexagon Chat` runs in a Docker container, set Ollama server to `http://host.docker.internal:11434` in Settings.

If launching for the first time, initialize the SQLite database:

```shell
$ docker compose exec hexagonchat npx prisma migrate dev
```

#### Prerequisites for Knowledge Bases

When using Knowledge Bases, you need a valid embedding model.

**Ollama Managed Embedding Model**

We recommend `nomic-embed-text` model. Download via Models page or CLI:

```shell
$ docker compose exec ollama ollama pull nomic-embed-text:latest
```

**OpenAI Embedding Model**

If using OpenAI, set a valid API Key in Settings. Available models:

- `text-embedding-3-large`
- `text-embedding-3-small`
- `text-embedding-ada-002`

#### Data Storage with Docker

Two types of data storage: vector data and relational data.

##### Vector data

With `docker-compose.yaml`, Chroma runs side by side with `Hexagon Chat`. Data persists in a Docker volume.

##### Relational data

Knowledge base records and files are stored in SQLite: `~/.hexagonchat/HexagonChat.sqlite`.

#### Proxy Configuration

See [docs/proxy-usage.md](docs/proxy-usage.md).

## Deployment Options

### Option 1: Local Development

```bash
# Install dependencies
pnpm install

# Start required services
docker compose up -d chromadb redis

# Run database migrations
pnpm prisma-migrate

# Start the app
pnpm dev
```

Access at: http://localhost:3000

### Option 2: Docker (Local)

```bash
# Build and start all services
docker compose up -d

# Or build first then start
docker compose build
docker compose up -d
```

Access at: http://localhost:3000

### Option 3: Deploy to Linux Server

#### A. Build & Push to Docker Hub (from your Mac)

```bash
# Build images
docker compose build

# Login to Docker Hub
docker login

# Tag and push
docker tag hexagon-chat-hexagonchat yourusername/hexagon-chat:latest
docker tag hexagon-chat-code-runner yourusername/hexagon-chat-code-runner:latest
docker push yourusername/hexagon-chat:latest
docker push yourusername/hexagon-chat-code-runner:latest
```

#### B. Pull & Run on Linux Server

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone the project
git clone https://github.com/liuwantao3/hexagon-chat.git
cd hexagon-chat

# Run deploy script
./scripts/deploy-server.sh yourusername
```

**Required environment variables:**
```bash
SECRET=your-secret-key
NUXT_OPENAI_API_KEY=sk-xxx
NUXT_GEMINI_API_KEY=xxx
NUXT_MINIMAX_API_KEY=xxx
```

### Option 4: Access from Internet (ngrok)

If running locally and want to access from internet:

```bash
# Install ngrok
brew install ngrok  # macOS
# or: https://ngrok.com/download

# Add auth token
ngrok config add-authtoken YOUR_AUTHTOKEN

# Start ngrok
ngrok http 3000
```

Or use the provided script:
```bash
./scripts/start-ngrok.sh
```

**Memory Requirements:**
- Docker deployment: ~2GB RAM (chroma + redis + app)
- 8GB server is sufficient

## Developers Guide

As Hexagon Chat is under active development, please follow these steps on every `git pull`:

1. Install dependencies: `pnpm install`
2. Prisma migrate: `pnpm prisma-migrate`