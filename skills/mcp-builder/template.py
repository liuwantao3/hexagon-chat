#!/usr/bin/env python3
"""
MCP Server Template - Python

A template for creating MCP (Model Context Protocol) servers in Python.
This server demonstrates how to create tools that can be used by AI assistants.

Usage:
    python template.py

Requirements:
    pip install mcp
"""

import json
import sys
from typing import Any

try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent, ImageContent, Resource
    from mcp.server.stdio import stdio_server
except ImportError:
    print("Error: MCP library not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

# Initialize the MCP server
server = Server("my-mcp-server")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """
    Return the list of available tools.
    Each tool has a name, description, and input schema.
    """
    return [
        Tool(
            name="hello_world",
            description="A simple hello world tool that returns a greeting",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The name to greet"
                    }
                },
                "required": ["name"]
            }
        ),
        Tool(
            name="calculate",
            description="Perform basic arithmetic calculations",
            inputSchema={
                "type": "object",
                "properties": {
                    "operation": {
                        "type": "string",
                        "enum": ["add", "subtract", "multiply", "divide"],
                        "description": "The arithmetic operation to perform"
                    },
                    "a": {"type": "number", "description": "First number"},
                    "b": {"type": "number", "description": "Second number"}
                },
                "required": ["operation", "a", "b"]
            }
        ),
        Tool(
            name="get_date",
            description="Get the current date and time",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """
    Handle tool execution requests.
    This is where you implement your tool logic.
    """
    try:
        if name == "hello_world":
            name_arg = arguments.get("name", "World")
            return [TextContent(
                type="text",
                text=f"Hello, {name_arg}! Welcome to MCP."
            )]

        elif name == "calculate":
            operation = arguments["operation"]
            a = arguments["a"]
            b = arguments["b"]

            if operation == "add":
                result = a + b
            elif operation == "subtract":
                result = a - b
            elif operation == "multiply":
                result = a * b
            elif operation == "divide":
                if b == 0:
                    return [TextContent(type="text", text="Error: Division by zero")]
                result = a / b
            else:
                return [TextContent(type="text", text=f"Unknown operation: {operation}")]

            return [TextContent(type="text", text=f"Result: {result}")]

        elif name == "get_date":
            from datetime import datetime
            now = datetime.now()
            return [TextContent(
                type="text",
                text=f"Current date and time: {now.strftime('%Y-%m-%d %H:%M:%S')}"
            )]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    """Run the MCP server using stdio transport."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
