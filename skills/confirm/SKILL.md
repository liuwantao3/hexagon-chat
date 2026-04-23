---
name: confirm
description: Ask user to confirm or deny an action before proceeding
icon: ✓
category: system
source: local
---

# Confirm

Ask the user to confirm or deny an action before proceeding. Use this when you need user approval for sensitive operations.

## Tools

- `confirm`: Ask user to confirm or deny an action

## Usage

Call this tool when you need user approval for:
- Executing potentially dangerous commands (rm, format, etc.)
- Accessing external directories or resources
- Making changes that require user consent
- Any operation that needs explicit user confirmation

The tool will display a confirmation prompt to the user with:
- A description of the action
- Options to confirm or deny

## Example

```
User: Delete all files in the project
LLM: *calls confirm tool to ask for permission*
User sees: "Are you sure you want to delete all files?"
User clicks: "Confirm" or "Cancel"
LLM: Receives the response and proceeds or stops
```