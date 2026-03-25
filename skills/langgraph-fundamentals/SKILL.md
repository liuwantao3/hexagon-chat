---
name: langgraph-fundamentals
description: Core LangGraph concepts including StateGraph, nodes, edges, Command patterns, and Send for dynamic workflows.
icon: 🔗
category: langchain
language: any
source: local
---

# LangGraph Fundamentals

LangGraph is a library for building stateful, multi-actor applications with LLMs. This skill covers the core concepts you need to build production-grade agentic systems.

## Core Concepts

### 1. StateGraph

The fundamental building block - a directed graph where nodes are functions and edges control execution flow.

```typescript
import { StateGraph, START, END } from "@langchain/langgraph"
import { AIMessage } from "@langchain/core/messages"

// Define your state
interface AgentState {
  messages: AIMessage[]
  next_action?: string
}

// Create the graph
const workflow = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addEdge(START, "agent")
  .addEdge("agent", END)
  .compile()
```

### 2. Nodes

Nodes are Python functions (or async functions) that:
- Receive the current state
- Perform computations
- Return state updates

```typescript
function agentNode(state: AgentState) {
  const result = llm.invoke(state.messages)
  return { messages: [result] }
}
```

### 3. Edges

Edges control flow between nodes:

**Static edges** - Always follow the same path:
```typescript
.addEdge("nodeA", "nodeB")
```

**Conditional edges** - Choose path based on state:
```typescript
.addConditionalEdges(
  "router",
  (state) => state.next_action,
  {
    "search": "search_node",
    "compute": "compute_node",
    "respond": END
  }
)
```

### 4. Command Pattern

For human-in-the-loop workflows:
```typescript
import { Command } from "@langchain/langgraph"

// Inside a node, interrupt and wait for human input
return new Command({
  goto: "human_review",
  resume: { human_input: "approved" }  // Value passed when human responds
})
```

### 5. Send (Dynamic Workflows)

For fan-out/fan-in patterns:
```typescript
.addNode("researcher", researchNode)

// In researchNode:
const queries = ["topic1", "topic2", "topic3"]
return queries.map(q => 
  new Send("analyst", { query: q, messages: [] })
)

// This spawns multiple analyst nodes in parallel
```

## Common Patterns

### ReAct Agent
```typescript
const reactGraph = new StateGraph(AgentState)
  .addNode("agent", reactAgent)
  .addNode("tools", toolNode)
  .addConditionalEdges("agent", shouldContinue, {
    "continue": "tools",
    "end": END
  })
  .addEdge("tools", "agent")
  .addEdge(START, "agent")
  .compile()
```

### Router Pattern
```typescript
.addNode("router", classifyIntent)
.addConditionalEdges("router", routeDecision, {
  "greeting": END,
  "question": "answer_node",
  "task": "task_node"
})
```

## Best Practices

1. **State Management**
   - Keep state minimal - only store what's needed
   - Use Pydantic models for complex state
   - Consider checkpointers for persistence

2. **Error Handling**
   ```typescript
   .addNode("robust_agent", {
     node: agentWithRetry,
     retryPolicy: {
       maxAttempts: 3,
       backoff: "exponential"
     }
   })
   ```

3. **Memory Integration**
   ```typescript
   import { MemorySaver }
   const checkpointer = new MemorySaver()
   const app = graph.compile({ checkpointer })
   ```

## Your Project Integration

Your project uses LangChain 1.x with `@langchain/core`. Use `@langchain/langgraph` for advanced agent patterns:

```bash
npm install @langchain/langgraph
```

For TypeScript LangGraph, check: `https://github.com/langchain-ai/langgraphjs`
