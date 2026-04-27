---
name: wiki-ingest
description: Analyze conversation sessions and generate wiki pages with entities, decisions, and cross-references. Use when ingesting chat sessions into a personal wiki knowledge base.
icon: 📚
category: memory
source: local
---

# Wiki Ingest

Analyze a chat session and generate complete wiki pages from it. This transforms conversations into a persistent, interlinked knowledge base.

## When to Use

- Ingesting completed chat sessions into the wiki
- Processing daily conversation logs
- Converting investigation sessions into documented findings

## Output Schema

Generate a JSON object with the following structure:

```json
{
  "sessionSummary": {
    "title": "Session Title",
    "content": "## Overview\n\nDetailed markdown content...",
    "tags": ["tag1", "tag2"],
    "confidence": 0.85
  },
  "entities": [
    {
      "name": "Entity Name",
      "slug": "entity-name",
      "category": "framework",
      "pageContent": "# Entity Name\n\n## What It Is\n\nDescription...\n\n## Usage in This Session\n\nContext...\n\n## Connections\n\nRelated entities...",
      "summary": "One-line description for index",
      "tags": ["tag1", "tag2"],
      "confidence": 0.9
    }
  ],
  "decisions": [
    {
      "title": "Decision Made",
      "slug": "decision-made",
      "pageContent": "# Decision: Using SQLite over PostgreSQL\n\n## Context\n\nWhy this decision was needed...\n\n## Decision\n\nWhat was decided...\n\n## Rationale\n\nWhy this approach was chosen...\n\n## Alternatives Considered\n\nOther options and why they weren't chosen...\n\n## Consequences\n\nFuture implications...",
      "summary": "Chose X over Y because Z",
      "tags": ["database", "architecture"]
    }
  ],
  "crossReferences": [
    {
      "fromSlug": "entity-a",
      "toSlug": "entity-b",
      "type": "uses",
      "context": "Entity A uses Entity B for authentication"
    }
  ],
  "keyDiscoveries": [
    "Discovery 1: Important finding from this session"
  ],
  "isInvestigation": true,
  "depth": "detailed"
}
```

## Page Categories

Use these categories for entity pages:

| Category | Description |
|----------|-------------|
| `language` | Programming languages (TypeScript, Python, etc.) |
| `framework` | Frameworks (React, Nuxt, Express, etc.) |
| `library` | Libraries (Prisma, Lodash, Zod, etc.) |
| `database` | Databases (PostgreSQL, SQLite, Redis, etc.) |
| `tool` | Dev tools (Docker, Git, Kubernetes, etc.) |
| `api` | APIs and protocols (REST, GraphQL, etc.) |
| `concept` | Concepts and patterns (CQRS, event sourcing, etc.) |
| `architecture` | Architectural decisions (SPA, SSR, microservices, etc.) |
| `error` | Errors encountered and how they were resolved |
| `file` | Specific files examined or created |
| `goal` | Goals discussed or set |
| `accomplishment` | Work completed |

## Cross-Reference Types

| Type | Use When |
|------|----------|
| `uses` | A mentions B in its context |
| `related-to` | Entities are conceptually related |
| `contradicts` | New information conflicts with existing |
| `elaborates` | A provides more detail about B |
| `supersedes` | A replaces or updates B |

## Guidelines

### Specificity Over Generality
- Include **specific details**: file names, line numbers, error messages, exact commands
- Include **code snippets** when relevant
- Include **exact values** not generic descriptions

### Good Example
```markdown
## Entity: Prisma ORM

## What It Is
A type-safe ORM for Node.js and TypeScript.

## Usage in This Session
Used in `server/utils/prisma.ts` for database access.
Discovered issue: need to call `prisma.$disconnect()` on shutdown.

## Connections
- Uses PostgreSQL as database
- Used by memoryService for WikiConfig storage
```

### Bad Example (Too Generic)
```markdown
## Entity: Prisma

An ORM tool we used in the project.
```

### Confidence Scoring
- 0.9-1.0: Direct statements, verified facts
- 0.7-0.9: Clear conclusions from conversation
- 0.5-0.7: Inferences, likely but not certain
- Below 0.5: Speculation, needs verification

### Investigation Detection
Set `isInvestigation: true` when:
- Deep analysis was performed
- Multiple files were examined
- Debugging involved multiple steps
- Findings have lasting value beyond this session

Set `depth: "deep-investigation"` for sessions that produced significant discoveries.

## Session Analysis Prompt

Analyze the following conversation and generate wiki pages. Be specific and detailed. Include exact file names, code snippets, error messages, and commands where relevant.

Conversation:
{{CONVERSATION}}

Respond with the JSON schema defined above.