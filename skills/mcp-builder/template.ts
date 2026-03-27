/**
 * MCP Server Template - TypeScript
 *
 * A template for creating MCP (Model Context Protocol) servers in TypeScript.
 * This server demonstrates how to create tools that can be used by AI assistants.
 *
 * Usage:
 *   npx ts-node template.ts
 *   # or
 *   npx tsx template.ts
 *
 * Requirements:
 *   npm install @modelcontextprotocol/sdk
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

interface ToolArguments {
  name?: string
  operation?: 'add' | 'subtract' | 'multiply' | 'divide'
  a?: number
  b?: number
}

const TOOLS: Tool[] = [
  {
    name: 'hello_world',
    description: 'A simple hello world tool that returns a greeting',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name to greet',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'calculate',
    description: 'Perform basic arithmetic calculations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The arithmetic operation to perform',
        },
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['operation', 'a', 'b'],
    },
  },
  {
    name: 'get_date',
    description: 'Get the current date and time',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

const server = new Server(
  { name: 'my-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as { name: string; arguments: ToolArguments }

  try {
    if (name === 'hello_world') {
      const userName = args.name || 'World'
      return {
        content: [{ type: 'text' as const, text: `Hello, ${userName}! Welcome to MCP.` }],
      }
    }

    if (name === 'calculate') {
      const { operation, a, b } = args

      if (operation === undefined || a === undefined || b === undefined) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Missing required arguments' }],
          isError: true,
        }
      }

      let result: number

      switch (operation) {
        case 'add':
          result = a + b
          break
        case 'subtract':
          result = a - b
          break
        case 'multiply':
          result = a * b
          break
        case 'divide':
          if (b === 0) {
            return {
              content: [{ type: 'text' as const, text: 'Error: Division by zero' }],
              isError: true,
            }
          }
          result = a / b
          break
        default:
          return {
            content: [{ type: 'text' as const, text: `Unknown operation: ${operation}` }],
            isError: true,
          }
      }

      return {
        content: [{ type: 'text' as const, text: `Result: ${result}` }],
      }
    }

    if (name === 'get_date') {
      const now = new Date()
      return {
        content: [
          {
            type: 'text' as const,
            text: `Current date and time: ${now.toISOString()}`,
          },
        ],
      }
    }

    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      isError: true,
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Server started')
}

main().catch(console.error)
