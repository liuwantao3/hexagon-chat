---
name: summarize
description: Summarize the conversation history into a comprehensive summary
icon: 📝
category: system
source: local
---

# Summarize

Summarize the conversation history into a comprehensive summary. Use this to:
- Create a memory of what has been discussed
- Condense long conversations
- Prepare context for new sessions

## Tools

- `summarize`: Generate a comprehensive summary of the conversation

## Summary Format

The summary includes these sections:

### Goal
What goal(s) is the user trying to accomplish?

### Instructions
What important instructions did the user give?

### Discoveries
What notable things were learned during the conversation?

### Accomplished
What work has been completed?

### Relevant Files/Directories
A structured list of important files and directories mentioned or modified.

### Pending Tasks
What tasks remain to be done?

## Usage

Call this tool when:
- User asks to summarize the conversation
- You need to provide context for a new topic
- Building a memory system for the conversation

The summary is returned as structured markdown that can be easily reviewed.