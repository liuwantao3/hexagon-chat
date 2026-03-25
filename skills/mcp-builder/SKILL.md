---
name: mcp-builder
description: Build MCP (Model Context Protocol) servers to create tools in any language. Supports Python and TypeScript.
icon: 🔧
---

# MCP Server Builder

Build Model Context Protocol (MCP) servers to create reusable tools that work with your AI assistant. MCP allows you to create tools in **any language** (Python, TypeScript, etc.).

## What is MCP?

MCP (Model Context Protocol) is a standardized protocol for connecting AI assistants to external tools and data sources. It provides:
- **Language-agnostic** - Write tools in any language
- **Standardized interface** - Same tool format across all languages
- **Hot reloading** - Update tools without restarting

## When to Use

Use this skill when you need to:
- Create custom tools that require Python libraries
- Integrate with existing Python/other language codebases
- Build reusable tool libraries
- Access data sources not available via JavaScript

## Architecture

```
Your Project          MCP Server (any language)
    │                        │
    │  ──JSON-RPC──►        │
    │  ◄──Results──          │
    │                        │
    └────────────────────────┘
         STDIO Transport
```

## Quick Start

### Option 1: Python Server

```bash
pip install mcp
```

```python
# server.py
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("my-tools")

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="my_tool",
            description="Does something useful",
            inputSchema={
                "type": "object",
                "properties": {
                    "param": {"type": "string"}
                }
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "my_tool":
        return [TextContent(type="text", text=f"Result: {arguments['param']}")]
```

### Option 2: TypeScript Server

```bash
npm install @modelcontextprotocol/sdk
```

```typescript
// server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"

const server = new Server(
  { name: "my-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "my_tool",
    description: "Does something useful",
    inputSchema: {
      type: "object",
      properties: {
        param: { type: "string" }
      }
    }
  }]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "my_tool") {
    return { content: [{ type: "text", text: `Result: ${request.params.arguments.param}` }] }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
```

## Configuration

Add your MCP server to `.mcp-servers.json`:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "python",
      "args": ["/path/to/server.py"]
    }
  }
}
```

## Examples

### Web Search (Python)

```python
import requests
from mcp.server import Server

server = Server("web-search")

@server.list_tools()
async def list_tools():
    return [{
        "name": "search",
        "description": "Search the web",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"}
            }
        }
    }]

@server.call_tool()
async def call_tool(name, arguments):
    if name == "search":
        # Use any Python library
        result = requests.get(f"https://api.example.com?q={arguments['query']}")
        return {"text": result.json()}
```

### File Operations (Python)

```python
from mcp.server import Server
import os

server = Server("file-tools")

@server.list_tools()
async def list_tools():
    return [
        {"name": "read_file", "description": "Read a file", "inputSchema": {...}},
        {"name": "list_dir", "description": "List directory", "inputSchema": {...}}
    ]

@server.call_tool()
async def call_tool(name, arguments):
    if name == "read_file":
        with open(arguments["path"]) as f:
            return {"text": f.read()}
```

## Best Practices

1. **Error Handling** - Always wrap in try/catch and return meaningful errors
2. **Type Safety** - Use input schemas for validation
3. **Logging** - Add logging for debugging
4. **Timeouts** - Set reasonable timeouts for long operations
5. **Resource Limits** - Limit file sizes, search results, etc.

## Testing

```bash
# Test your MCP server
npx @modelcontextprotocol/sdk test --server python server.py
```
