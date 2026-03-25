---
name: langchain-fundamentals
description: Core LangChain concepts including create_agent, @tool decorator, middleware patterns, and structured output.
icon: 🔧
category: langchain
language: any
source: local
---

# LangChain Fundamentals

LangChain is a framework for developing applications powered by language models. This skill covers the essential patterns you need to build production applications.

## Core Concepts

### 1. The Chain

Chains combine multiple components (LLM, prompts, tools) into a single pipeline:

```typescript
import { createChain } from "@langchain/core/chains"
import { PromptTemplate } from "@langchain/core/prompts"

const chain = PromptTemplate.fromTemplate(`
  Summarize the following text:
  {text}
  
  Summary:
`)
  .pipe(yourLLM)
```

### 2. The Tool Decorator

Tools allow LLMs to interact with external systems:

```typescript
import { tool } from "@langchain/core/tools"
import { z } from "zod"

const searchTool = tool(
  async ({ query, limit = 5 }) => {
    // Your search logic here
    return searchResults
  },
  {
    name: "search",
    description: "Search for information on the web",
    schema: z.object({
      query: z.string().describe("The search query"),
      limit: z.number().optional().default(5).describe("Max results")
    })
  }
)
```

### 3. Agent Creation

```typescript
import { createAgent } from "@langchain/core/agents"

const agent = await createAgent({
  llm: yourChatModel,
  tools: [searchTool, calculatorTool],
  systemMessage: "You are a helpful research assistant."
})
```

### 4. Structured Output

Get reliable structured data from LLMs:

```typescript
import { z } from "zod"

const responseFormat = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  sentiment: z.enum(["positive", "neutral", "negative"])
})

const structuredLLM = yourLLM.withStructuredOutput(responseFormat)
const result = await structuredLLM.invoke("Analyze this text: ...")
```

### 5. Output Parsers

Parse LLM outputs into custom formats:

```typescript
import { StringOutputParser, CommaSeparatedListOutputParser } from "@langchain/core/output_parsers"

const parser = new CommaSeparatedListOutputParser()
const chain = PromptTemplate.fromTemplate("List {topic}")
  .pipe(yourLLM)
  .pipe(parser)

const results = await chain.invoke({ topic: "colors" })
// Returns: ["red", "blue", "green"]
```

## Common Patterns

### RAG (Retrieval-Augmented Generation)

```typescript
import { createRetrieverChain } from "@langchain/core/chains"
import { createHistoryAwareRetriever } from "@langchain/core/chains/history_aware"

const retrieverChain = await createRetrieverChain({
  llm: yourLLM,
  retriever: yourVectorStore.asRetriever(),
  prompt: historyAwarePrompt
})

const qaChain = await createQAChain({
  llm: yourLLM,
  combineDocumentsChain: stuffDocumentsChain
})

const chain = retrieverChain.pipe(qaChain)
```

### Memory

```typescript
import { ConversationBufferMemory } from "@langchain/core/memory"

const memory = new ConversationBufferMemory({
  chatHistory: new ChatMessageHistory(),
  memoryKey: "chat_history"
})

const chain = PromptTemplate.fromTemplate(`{chat_history}\n\nUser: {input}`)
  .pipe(yourLLM)
  .withConfig({ callbacks: [memory.callbackHandler] })
```

## Best Practices

1. **Use Structured Output** instead of parsing raw text
2. **Always define schemas** with Zod for tools
3. **Handle errors** at every step
4. **Use streaming** for better UX
5. **Cache responses** when appropriate

## Integration with Your Project

Your project already uses LangChain 1.x with `@langchain/core`. Key packages:

```bash
npm install @langchain/core @langchain/openai @langchain/anthropic
```

For advanced patterns, see `langgraph-fundamentals` skill.
