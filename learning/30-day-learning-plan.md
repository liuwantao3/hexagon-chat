# Hexagon Chat - 30-Day Learning Journey

This comprehensive learning plan is designed to help you thoroughly understand this Nuxt 3 LLM chat application. Each day focuses on a specific aspect with code examples, explanations, and execution flows.

---

## Prerequisites

- Node.js 18+
- Basic knowledge of Vue 3 and Nuxt 3
- Understanding of REST APIs and streaming
- Familiarity with LLM concepts

---

## Phase 1: Foundation (Days 1-7)

### Day 1: Project Setup & Architecture

**Topics:**
- Project structure overview
- Configuration files
- Dependencies and scripts

**Files to Study:**
- `package.json` - All dependencies
- `nuxt.config.ts` - Main Nuxt configuration
- `app.vue` - Root component
- `tsconfig.json` - TypeScript config

**Code Snippet - `nuxt.config.ts` key sections:**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@sidebase/nuxt-auth',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
  ],
  runtimeConfig: {
    authSecret: process.env.AUTH_SECRET,
    openaiApiKey: process.env.OPENAI_API_KEY,
    // ... other API keys
  },
  app: {
    head: {
      title: 'Hexagon Chat',
      meta: [{ name: 'description', content: 'LLM Chat Application' }]
    }
  }
})
```

**Key Concepts:**
- Nuxt 3 modules system
- Runtime config for secrets
- SSR vs client-side rendering

---

### Day 2: Routing & Pages

**Topics:**
- File-based routing
- Page components
- Navigation

**Files to Study:**
- `pages/index.vue` - Home page
- `pages/chat/index.vue` - Main chat
- `pages/login/index.vue` - Login
- `layouts/default.vue` - Main layout

**Code Snippet - Chat Page:**

```typescript
// pages/chat/index.vue
<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const { messages, sendMessage, isLoading } = useChat()
</script>

<template>
  <div class="chat-page">
    <ChatSessionList />
    <div class="chat-main">
      <ChatMessageItem
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
      <ChatInputBox @send="sendMessage" />
    </div>
  </div>
</template>
```

**Execution Flow:**
1. User navigates to `/chat`
2. `definePageMeta` middleware checks auth
3. If authenticated, page loads
4. Chat composable initializes

---

### Day 3: Components Deep Dive

**Topics:**
- Component structure
- Props and emits
- Component communication

**Files to Study:**
- `components/Chat.vue`
- `components/ChatMessageItem.vue`
- `components/ChatInputBox.vue`
- `components/ChatSessionList.vue`

**Code Snippet - ChatMessageItem:**

```typescript
// components/ChatMessageItem.vue
<script setup lang="ts">
interface Props {
  message: ChatMessage
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false
})

const emit = defineEmits<{
  edit: [message: ChatMessage]
  delete: [id: string]
  copy: [content: string]
}>()

const formattedContent = computed(() => 
  formatMarkdown(props.message.content)
)
</script>

<template>
  <div class="message-item" :class="message.role">
    <div class="message-content" v-html="formattedContent" />
    <ChatMessageActionMore 
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
    />
  </div>
</template>
```

**Key Concepts:**
- TypeScript interfaces for props
- defineEmits for events
- Computed properties for formatting

---

### Day 4: Composables & State

**Topics:**
- Vue composables
- State management
- Client-side storage

**Files to Study:**
- `composables/store.ts` - Chat settings
- `composables/clientDB.ts` - IndexedDB
- `composables/useModels.ts` - Model management

**Code Snippet - Chat Settings Storage:**

```typescript
// composables/store.ts
import { useStorage } from '@vueuse/core'

interface ChatSettings {
  model: string
  temperature: number
  maxTokens: number
  attachedMessagesCount: number
}

const chatDefaultSettings: ChatSettings = {
  model: 'gpt-4-turbo',
  temperature: 0.7,
  maxTokens: 4096,
  attachedMessagesCount: 10
}

export const useChatSettings = () => {
  const settings = useStorage<ChatSettings>('chat-settings', chatDefaultSettings)
  
  const updateModel = (model: string) => {
    settings.value.model = model
  }
  
  return { settings, updateModel }
}
```

**Code Snippet - IndexedDB (Dexie):**

```typescript
// composables/clientDB.ts
import Dexie, { type Table } from 'dexie'

export interface ChatSession {
  id?: number
  sessionId: string
  title: string
  createdAt: Date
  model: string
}

export class ChatDatabase extends Dexie {
  chatSessions!: Table<ChatSession, number>
  
  constructor() {
    super('hexagon-chat')
    this.version(1).stores({
      chatSessions: '++id, sessionId, createdAt'
    })
  }
}

export const db = new ChatDatabase()
```

**Execution Flow:**
1. useStorage syncs to localStorage
2. Dexie wraps IndexedDB
3. Both persist data across sessions

---

### Day 5: Authentication System

**Topics:**
- JWT authentication
- NextAuth.js integration
- Auth middleware

**Files to Study:**
- `server/api/auth/login.post.ts`
- `server/api/auth/signup.post.ts`
- `server/middleware/auth.ts`
- `composables/fetchWithAuth.ts`

**Code Snippet - Login API:**

```typescript
// server/api/auth/login.post.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.AUTH_SECRET,
    { expiresIn: '7d' }
  )

  return { user: { id: user.id, email: user.email }, token }
})
```

**Code Snippet - Authenticated Fetch:**

```typescript
// composables/fetchWithAuth.ts
export const useFetchWithAuth = () => {
  const auth = useAuth()
  
  const fetchWithAuth = async <T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const token = auth.value.token
    
    return await $fetch<T>(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : ''
      }
    })
  }
  
  return { fetchWithAuth }
}
```

---

### Day 6: UI & Styling

**Topics:**
- Tailwind CSS
- Component library (Nuxt UI)
- Custom styling

**Files to Study:**
- `tailwind.config.ts`
- `assets/index.scss`
- `layouts/default.vue`

**Code Snippet - Tailwind Config:**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7'
        }
      }
    }
  },
  plugins: []
} satisfies Config
```

---

### Day 7: Database (Prisma & SQLite)

**Topics:**
- Prisma ORM
- Schema definitions
- Database operations

**Files to Study:**
- `prisma/schema.prisma`
- Server API endpoints using Prisma

**Code Snippet - Prisma Schema:**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  role      Int      @default(0)
  createdAt DateTime @default(now())
  
  knowledgeBases   KnowledgeBase[]
  instructions   Instruction[]
  stories        Story[]
}

model KnowledgeBase {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  files       KnowledgeBaseFile[]
  createdAt   DateTime @default(now())
}
```

---

## Phase 2: Core Features (Days 8-14)

### Day 8: LLM Integration Basics

**Topics:**
- LangChain integration
- Model providers
- API clients

**Files to Study:**
- `server/models/` - Model implementations
- `composables/useOpenAIModels.ts`

**Code Snippet - OpenAI Model:**

```typescript
// server/models/openai.ts
import { ChatOpenAI } from '@langchain/openai'

export const createOpenAIModel = (config: ModelConfig) => {
  return new ChatOpenAI({
    model: config.modelName || 'gpt-4-turbo',
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens,
    apiKey: config.apiKey,
    configuration: {
      baseURL: config.baseURL // For proxy/custom endpoints
    }
  })
}
```

**Execution Flow:**
1. Client sends message to `/api/models/chat`
2. Server loads appropriate model based on config
3. Creates LangChain model instance
4. Invokes with messages
5. Streams response back

---

### Day 9: Chat API & Streaming

**Topics:**
- Server streaming (SSE)
- Chat endpoint implementation
- Message handling

**Files to Study:**
- `server/api/models/chat/index.post.ts`
- `composables/useChatRequest.ts`

**Code Snippet - Chat API with Streaming:**

```typescript
// server/api/models/chat/index.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { messages, model, temperature, skills } = body

  const modelInstance = await createModelInstance(model)
  
  // Set up streaming response
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      const callback = (chunk: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
      }

      try {
        // Process with skills RAG if enabled
        const processedMessages = await processWithSkills(messages, skills)
        
        // Invoke streaming
        const result = await modelInstance.invoke(processedMessages, {
          callbacks: [{ handleLLMNewToken: callback }]
        })
        
        controller.close()
      } catch (error) {
        controller.error(encoder.encode(`error: ${error.message}`))
      }
    }
  })

  return sendStream(event, stream)
})
```

---

### Day 10: Multi-Provider Support

**Topics:**
- Multiple LLM providers
- Provider abstraction
- Configuration

**Files to Study:**
- `server/models/` - All model implementations
- `components/ModelsSelectMenu.vue`
- `components/EditCloudModel.vue`

**Code Snippet - Model Factory:**

```typescript
// server/models/index.ts
import { createOpenAIModel } from './openai'
import { createAnthropicModel } from './anthropic'
import { createOllamaModel } from './ollama'
import { createGeminiModel } from './gemini'

export type ModelProvider = 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'groq'

export const createModelInstance = async (config: ModelConfig) => {
  const { provider } = config
  
  switch (provider) {
    case 'openai':
      return createOpenAIModel(config)
    case 'anthropic':
      return createAnthropicModel(config)
    case 'ollama':
      return createOllamaModel(config)
    case 'gemini':
      return createGeminiModel(config)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
```

**Providers Supported:**
- OpenAI / Azure OpenAI
- Anthropic Claude
- Ollama (local)
- Google Gemini
- Groq
- Moonshot
- MiniMax

---

### Day 11: Skills System

**Topics:**
- Skills architecture
- Skill definitions
- Skill marketplace

**Files to Study:**
- `skills/` - Skill definitions
- `server/skills/` - Skill server code
- `components/SkillMarketplace.vue`
- `components/SkillConfigModal.vue`

**Code Snippet - Skill Definition:**

```typescript
// skills/web-dev.ts
import { defineSkill } from '~/server/skills'

export default defineSkill({
  name: 'web-developer',
  description: 'Expert web developer with full-stack knowledge',
  
  systemMessage: `You are an expert web developer...`,
  
  tools: [
    {
      name: 'execute_code',
      description: 'Execute HTML/CSS/JS code in sandbox',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string', enum: ['html', 'css', 'js'] }
        }
      }
    }
  ],
  
  examples: [
    {
      input: 'Create a simple counter app',
      output: 'I\'ll create a counter app for you...'
    }
  ]
})
```

**Execution Flow:**
1. User selects skill in chat
2. Skill config loaded with system message
3. Skill tools registered
4. LLM can invoke tools
5. Results returned to chat

---

### Day 12: Code Sandbox

**Topics:**
- Live code preview
- Code execution
- Sandboxed environment

**Files to Study:**
- `components/SandboxPanel.vue`
- `components/CodeExecutor.vue`
- `composables/useSandbox.ts`

**Code Snippet - Code Executor:**

```typescript
// comosables/useSandbox.ts
export const useSandbox = () => {
  const executeCode = async (code: string, language: string) => {
    const response = await $fetch('/api/sandbox/execute', {
      method: 'POST',
      body: { code, language }
    })
    return response
  }

  const createPreview = (html: string) => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    return url
  }

  return { executeCode, createPreview }
}
```

---

### Day 13: Knowledge Bases & RAG

**Topics:**
- Vector databases
- RAG implementation
- Semantic search

**Files to Study:**
- `server/retriever/` - Retriever implementations
- `pages/knowledgebases/index.vue`
- `components/KnowledgeBaseForm.vue`

**Code Snippet - RAG Retriever:**

```typescript
// server/retriever/index.ts
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { RecursiveCharacterTextSplitter } from 'langchain/text splitter'

export const createRetriever = async (knowledgeBaseId: number) => {
  const kb = await getKnowledgeBase(knowledgeBaseId)
  
  // Load documents from KB
  const docs = await loadKnowledgeBaseFiles(kb)
  
  // Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  })
  const splitDocs = await splitter.splitDocuments(docs)
  
  // Create vector store
  const vectorStore = await Chroma.fromDocuments(
    splitDocs,
    new OpenAIEmbeddings(),
    { collectionName: kb.name }
  )
  
  return vectorStore.asRetriever()
}
```

**Knowledge Base Features:**
- ChromaDB vector storage
- File upload (PDF, DOCX, TXT)
- Semantic search
- Source citation

---

### Day 14: Custom Instructions

**Topics:**
- Instruction management
- System prompts
- User instructions

**Files to Study:**
- `pages/instructions/index.vue`
- `server/api/instruction/`
- `components/InstructionForm.vue`

**Code Snippet - Instructions API:**

```typescript
// server/api/instruction/index.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { title, content, userId } = body

  const instruction = await prisma.instruction.create({
    data: {
      title,
      content,
      userId
    }
  })

  return instruction
})
```

---

## Phase 3: Advanced Features (Days 15-21)

### Day 15: Story Generation

**Topics:**
- Story creation
- Image generation
- Audio synthesis

**Files to Study:**
- `pages/stories/index.vue`
- `server/api/stories/`
- `server/api/image/generate.post.ts`
- `server/api/audio/speech.post.ts`

**Code Snippet - Story with Image:**

```typescript
// server/api/stories/index.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { title, content, userId } = body

  const story = await prisma.story.create({
    data: { title, content, userId }
  })

  // Generate image if requested
  if (body.generateImage) {
    const imageUrl = await generateImage(content)
    story.imageUrl = imageUrl
  }

  return story
})
```

---

### Day 16: Learning System

**Topics:**
- Content generation
- Paragraph rewriting
- Clustering

**Files to Study:**
- `pages/learning/index.vue`
- `server/api/learning/`

**Code Snippet - Learning Generation:**

```typescript
// server/api/learning/generate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { topic, count } = body

  // Generate learning paragraphs using LLM
  const paragraphs = await generateLearningContent(topic, count)

  // Store in database
  const created = await prisma.learningParagraph.createMany({
    data: paragraphs.map(p => ({
      content: p.content,
      topic,
      userId: body.userId
    }))
  })

  return created
})
```

---

### Day 17: Audio Features

**Topics:**
- Text-to-speech
- Speech-to-text
- Audio streaming

**Files to Study:**
- `server/api/audio/speech.post.ts`
- `utils/audio-streamer.ts`
- `utils/audio-recorder.ts`

**Code Snippet - Text to Speech:**

```typescript
// server/api/audio/speech.post.ts
import { generateSpeech } from '~/server/utils/tts'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { text, voice, model } = body

  const audioBuffer = await generateSpeech(text, {
    voice: voice || 'alloy',
    model: model || 'tts-1'
  })

  setHeader(event, 'Content-Type', 'audio/mpeg')
  
  return sendStream(event, Buffer.from(audioBuffer))
})
```

---

### Day 18: Web Workers

**Topics:**
- Background processing
- Worker communication
- Non-blocking UI

**Files to Study:**
- `composables/useChatWorker.ts`
- `composables/worker-chatRequest.ts`

**Code Snippet - Web Worker:**

```typescript
// composables/useChatWorker.ts
export const useChatWorker = () => {
  const worker = new Worker('/workers/chat.worker.ts')
  
  const postMessage = (message: ChatRequest) => {
    return new Promise((resolve) => {
      worker.onmessage = (e) => resolve(e.data)
      worker.postMessage(message)
    })
  }

  const terminate = () => worker.terminate()

  return { postMessage, terminate }
}
```

---

### Day 19: Markdown & Rich Content

**Topics:**
- Markdown parsing
- Syntax highlighting
- LaTeX rendering

**Files to Study:**
- `composables/markdown.ts`
- `components/MarkdownPreview.vue`
- `assets/markdown.scss`

**Code Snippet - Markdown with KaTeX:**

```typescript
// composables/markdown-it-katex-gpt.ts
import MarkdownIt from 'markdown-it'
import markdownItKatex from 'markdown-it-katex'

export const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
}).use(markdownItKatex, {
  throwOnError: false,
  errorColor: '#cc0000'
})

export const formatMarkdown = (content: string) => {
  return md.render(content)
}
```

---

### Day 20: WebSocket & Real-time

**Topics:**
- Server-Sent Events
- Real-time updates
- Connection management

**Code Snippet - SSE Implementation:**

```typescript
// Real-time updates via SSE
export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init' })}\n\n`))
      
      // Listen for updates
      const listener = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      
      event.node.req.on('close', () => {
        emitter.off('update', listener)
      })
    }
  })
  
  return sendStream(event, stream)
})
```

---

### Day 21: Middleware & Security

**Topics:**
- Server middleware
- Request validation
- Security best practices

**Files to Study:**
- `server/middleware/auth.ts`
- `server/utils/validation.ts`

**Code Snippet - Auth Middleware:**

```typescript
// server/middleware/auth.ts
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  
  if (!token) {
    throw createError({ 
      statusCode: 401, 
      message: 'No token provided' 
    })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET)
    event.context.user = decoded
  } catch {
    throw createError({ 
      statusCode: 401, 
      message: 'Invalid token' 
    })
  }
})
```

---

## Phase 4: Deep Dives (Days 22-28)

### Day 22: MCP (Model Context Protocol)

**Topics:**
- MCP integration
- Tool definitions
- External services

**Files to Study:**
- `server/utils/mcp.ts`
- MCP SDK usage

**Code Snippet - MCP Client:**

```typescript
// server/utils/mcp.ts
import { Client } from '@modelcontextprotocol/sdk'

export const createMCPClient = async (config: MCPConfig) => {
  const client = new Client({
    name: 'hexagon-chat',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {},
      resources: {}
    }
  })
  
  await client.connect(config.transport)
  
  return client
}
```

---

### Day 23: Image Generation

**Topics:**
- DALL-E integration
- Image API
- Image storage

**Files to Study:**
- `server/api/image/generate.post.ts`
- `components/FileSelector.vue`

---

### Day 24: Vector Databases Deep Dive

**Topics:**
- ChromaDB
- Qdrant
- Milvus
- Similarity search

**Files to Study:**
- `server/store/chroma.ts`
- `server/store/qdrant.ts`

---

### Day 25: Proxy & API Gateway

**Topics:**
- Request proxying
- Token management
- Rate limiting

**Files to Study:**
- `server/api/proxy.ts`
- `server/utils/proxyToken.ts`

---

### Day 26: Error Handling & Logging

**Topics:**
- Error boundaries
- Logging system
- Debugging

**Files to Study:**
- Server error handling
- Client error boundaries

---

### Day 27: Performance Optimization

**Topics:**
- Caching
- Query optimization
- Bundle size

**Techniques:**
- Redis caching for responses
- Debounced API calls
- Lazy loading components

---

### Day 28: Testing

**Topics:**
- Unit tests
- Integration tests
- E2E tests

**Testing Tools:**
- Vitest
- Playwright (if available)

---

## Phase 5: Review & Deployment (Days 29-30)

### Day 29: Code Review

**Topics:**
- Architecture review
- Best practices
- Refactoring opportunities

### Day 30: Deployment

**Topics:**
- Build for production
- Environment configuration
- Monitoring

**Files to Study:**
- `nuxt.config.ts` production settings
- Docker configuration (if any)

---

## Daily Structure Recommendation

1. **Morning (1 hour):** Read the files listed for that day
2. **Afternoon (1 hour):** Study the code snippets and run them in your local environment
3. **Evening (30 min):** Review and experiment with the concepts

## Getting Help

- Check `README.md` for setup instructions
- Explore `nuxt.config.ts` for configuration options
- Review component files for usage patterns

---

## Summary

By the end of 30 days, you will understand:

- [ ] Nuxt 3 project structure and configuration
- [ ] Vue 3 composition API patterns
- [ ] Authentication and security
- [ ] LLM integration (multiple providers)
- [ ] Chat streaming and real-time features
- [ ] Skills system and MCP
- [ ] Knowledge bases and RAG
- [ ] Code sandbox execution
- [ ] Rich content (Markdown, LaTeX)
- [ ] Audio and image generation
- [ ] Vector databases
- [ ] Deployment and optimization

---

**End of Learning Plan**