[English](README.md) | 简体中文

# Hexagon Chat

`Hexagon Chat` 是一个基于 LLMs（大语言模型）的开源聊天机器人平台，支持多种语言模型，包括：

- Ollama
- OpenAI
- Azure OpenAI
- Anthropic
- Moonshot
- MiniMax
- Gemini
- Groq

`Hexagon Chat` 支持多种聊天模式：

- 与 LLMs 免费聊天
- 基于知识库聊天（RAG）
- 交互式沙箱开发
- 带源引用的网络研究

`Hexagon Chat` 功能列表：

- Ollama 模型管理
- 知识库（RAG）支持 Chroma/Milvus
- 聊天界面
- 多种 LLM 提供商 API 密钥管理
- HTML/CSS/JS 代码沙箱执行
- 网络研究Skill（带源引用）
- PDF 编辑器Skill
- MCP 服务器构建器
- PowerPoint 生成器
- 代码执行环境
- 故事（语音和音频生成）
- 多模型支持（包含视觉能力）
- 多语言支持（i18n）
- 用户认证
- Redis 缓存

## 快速开始

使用 `Hexagon Chat` 前，请确保所有组件已启动。

### 支持的向量数据库

`Hexagon Chat` 支持 2 种向量数据库：Milvus 和 Chroma。

配置请参阅 `.env.example`：

```
# 支持的值：chroma，milvus
VECTOR_STORE=chroma
CHROMADB_URL=http://localhost:8000
MILVUS_URL=http://localhost:19530
```

默认情况下使用 Chroma。使用 Milvus 时，设置 `VECTOR_STORE` 为 `milvus` 并指定 URL。

### 使用 Nuxt 3 开发服务器

如需在最新代码库上运行并实时应用更改：

1. 安装 Ollama 服务器

    按 [Ollama](https://github.com/ollama/ollama) 安装指南操作。默认运行在 http://localhost:11434。

2. 安装 Chroma

    参考 [https://docs.trychroma.com/getting-started](https://docs.trychroma.com/getting-started)。

    ```bash
    docker pull chromadb/chroma
    docker run -d -p 8000:8000 chromadb/chroma
    ```

3. Hexagon 设置

    3.1 复制 `.env.example` 到 `.env`：

    ```bash
    cp .env.example .env
    ```

    3.2 安装依赖：

    ```bash
    pnpm install
    ```

    3.3 运行 Prisma 创建数据库表：

    ```bash
    pnpm prisma-migrate
    ```

4. 启动开发服务器

    > 确保 __[Ollama 服务器](#ollama-server)__ 和 __[ChromaDB](#install-chromadb-and-startup)__ 正在运行。

    ```bash
    pnpm dev
    ```

### 使用 Docker

使用 `Hexagon Chat` 的最简单方式。

```shell
$ docker compose up
```

由于在 Docker 容器中运行，需将 Ollama 设置为 `http://host.docker.internal:11434`。

首次启动时初始化 SQLite 数据库：

```shell
$ docker compose exec hexagonchat npx prisma migrate dev
```

#### 知识库前置条件

使用知识库时需要有效的嵌入模型。

**Ollama 管理的嵌入模型**

推荐使用 `nomic-embed-text`。通过模型页面或 CLI 下载：

```shell
$ docker compose exec ollama ollama pull nomic-embed-text:latest
```

**OpenAI 嵌入模型**

使用 OpenAI 时在设置中填写有效 API Key。可用模型：

- `text-embedding-3-large`
- `text-embedding-3-small`
- `text-embedding-ada-002`

#### Docker 数据存储

两种数据类型：向量数据和关系数据。

##### 向量数据

使用 `docker-compose.yaml`，Chroma 与 `Hexagon Chat` 一起运行。数据保存在 Docker 卷中。

##### 关系数据

知识库记录和文件存储在 SQLite：`~/.hexagonchat/HexagonChat.sqlite`。

#### 代理配置

请参阅 [docs/proxy-usage.md](docs/proxy-usage.md)。

## 开发者指南

由于 `Hexagon Chat` 处于活跃开发中，请在每次 `git pull` 时执行：

1. 安装依赖：`pnpm install`
2. Prisma 迁移：`pnpm prisma-migrate`