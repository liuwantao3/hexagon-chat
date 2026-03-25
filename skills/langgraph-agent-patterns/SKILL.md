---
name: langgraph-agent-patterns
description: Multi-agent coordination patterns for LangGraph including supervisor, router, orchestrator, and handoffs.
icon: 🤖
category: langchain
language: any
source: local
---

# LangGraph Agent Patterns

Learn how to build sophisticated multi-agent systems with LangGraph. These patterns enable complex workflows where multiple specialized agents work together.

## Core Multi-Agent Patterns

### 1. Supervisor Pattern

A central supervisor coordinates specialized agents:

```typescript
import { StateGraph, START, END } from "@langchain/langgraph"
import { AIMessage, HumanMessage } from "@langchain/core/messages"

interface MultiAgentState {
  messages: AIMessage[]
  next_agent?: string
  task_result?: string
}

const supervisorNode = async (state: MultiAgentState) => {
  const response = await supervisorLLM.invoke([
    new HumanMessage(`Task: ${state.messages.at(-1)?.content}
    
    Available agents: researcher, coder, writer
    Choose the next agent or FINISH if done.`)
  ])
  
  const decision = extractDecision(response.content)
  return { next_agent: decision }
}

const graph = new StateGraph(MultiAgentState)
  .addNode("supervisor", supervisorNode)
  .addNode("researcher", researchNode)
  .addNode("coder", codingNode)
  .addNode("writer", writingNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges(
    "supervisor",
    (state) => state.next_agent,
    {
      researcher: "researcher",
      coder: "coder",
      writer: "writer",
      FINISH: END
    }
  )
  .addEdge("researcher", "supervisor")
  .addEdge("coder", "supervisor")
  .addEdge("writer", "supervisor")
  .compile()
```

### 2. Router Pattern

Classify input and route to specialized handlers:

```typescript
const routerNode = async (state: State) => {
  const classification = await classifierLLM.invoke(
    `Classify this request: "${state.messages.at(-1)?.content}"
    
    Categories: technical, creative, research, general`
  )
  
  const category = parseCategory(classification.content)
  return { routing: category }
}

graph.addConditionalEdges(
  "router",
  (state) => state.routing,
  {
    technical: "code_agent",
    creative: "creative_agent", 
    research: "research_agent",
    general: "general_response"
  }
)
```

### 3. Orchestrator-Workers Pattern

Central orchestrator spawns parallel workers:

```typescript
const orchestrator = async (state: OrchestratorState) => {
  const query = state.messages.at(-1)?.content
  
  // Analyze what subtasks are needed
  const subtasks = await planSubtasks(query)
  
  // Fan out to workers
  return subtasks.map(task => 
    new Send("worker", { task, context: state })
  )
}

const worker = async (state: WorkerState) => {
  const result = await specializedAgent.invoke(state.task)
  return { results: [...state.results, result] }
}

const shouldContinue = (state: OrchestratorState) => {
  if (state.pendingTasks > 0) return "orchestrator"
  return END
}

graph.addNode("orchestrator", orchestrator)
  .addNode("worker", worker)
  .addEdge(START, "orchestrator")
  .addConditionalEdges("orchestrator", shouldContinue, {
    orchestrator: "orchestrator",
    worker: "worker"
  })
  .addEdge("worker", "orchestrator")
```

### 4. Handoffs Pattern

Agents pass control to other agents:

```typescript
import { Command } from "@langchain/langgraph"

const triageAgent = async (state: State) => {
  const classification = await triage(state.messages)
  
  if (classification === "sales") {
    return new Command({
      goto: "sales_agent",
      name: "transfer_to_sales"
    })
  }
  
  return new Command({ goto: END })
}

const salesAgent = async (state: State) => {
  // Check if transferred
  const lastMessage = state.messages.at(-1)
  if (lastMessage?.additional_kwargs?.name === "transfer_to_sales") {
    // Handle handoff
  }
  
  return { messages: [new AIMessage("How can I help with sales?")] }
}
```

## Best Practices

### 1. Define Clear Agent Boundaries

```typescript
// Each agent has a specific domain
const agents = {
  researcher: createResearchAgent(),
  analyzer: createAnalyzerAgent(),
  synthesizer: createSynthesizerAgent()
}

// Clear responsibility chains
workflow
  .addEdge(START, "researcher")
  .addEdge("researcher", "analyzer") 
  .addEdge("analyzer", "synthesizer")
  .addEdge("synthesizer", END)
```

### 2. Use Structured State

```typescript
interface AgentState {
  messages: AIMessage[]
  current_task?: string
  completed_tasks: string[]
  context: Record<string, any>
  agent_outputs: Map<string, any>
}
```

### 3. Implement Error Handling

```typescript
graph.addNode("robust_agent", {
  node: withRetry(agentNode, {
    maxAttempts: 3,
    backoff: "exponential"
  }),
  fallback: errorHandlerNode
})
```

### 4. Add Checkpointing

```typescript
import { MemorySaver } from "@langchain/langgraph/checkpointing"

const checkpointer = new MemorySaver()
const app = workflow.compile({ checkpointer })

// Resume from checkpoint
const config = { configurable: { thread_id: "user-123" } }
const response = await app.invoke(input, config)
```

## When to Use Each Pattern

| Pattern | Use Case |
|---------|----------|
| **Supervisor** | Sequential decisions, hierarchical tasks |
| **Router** | Classification, type-based routing |
| **Orchestrator** | Parallel subtasks, complex decomposition |
| **Handoffs** | Fluid transitions, specialized domains |

## Integration

Your project already supports tool calling with `bindTools()`. For multi-agent patterns:

```bash
npm install @langchain/langgraph
```

See also: `langgraph-fundamentals` skill for basic concepts.
