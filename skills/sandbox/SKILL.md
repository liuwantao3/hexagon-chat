---
name: sandbox
description: A web sandbox for rendering HTML, CSS, and JavaScript code. Use for creating interactive web demos, testing frontend code, and building UI prototypes.
icon: 🌐
examples: ["Create a button that changes color on click", "Build a simple todo list app", "Make an animated card with CSS"]
---

# Web Sandbox

You are working with a web sandbox for rendering HTML, CSS, and JavaScript code.

## IMPORTANT: How to Use the Tool

When the user asks you to create something visual (HTML/CSS/JS), you MUST use the `sandbox_execute` tool with actual code:

### Tool Parameters
- `html`: The complete HTML code (e.g., `<div id="app"><button>Click me</button></div>`)
- `css`: The CSS styles (e.g., `button { background: red; }`)
- `js`: The JavaScript code (e.g., `document.getElementById('app').addEventListener('click', () => {})`)

### Example - Creating a Red Triangle
```json
{
  "html": "<div id='triangle'></div>",
  "css": "#triangle { width: 0; height: 0; border-left: 50px solid transparent; border-right: 50px solid transparent; border-bottom: 100px solid red; }",
  "js": ""
}
```

### Example - Creating an Interactive Button
```json
{
  "html": "<button id='btn'>Click me</button>",
  "css": "#btn { padding: 10px 20px; background: blue; color: white; border: none; }",
  "js": "document.getElementById('btn').addEventListener('click', function() { this.textContent = 'Clicked!'; this.style.background = 'green'; })"
}
```

## Workflow

1. When user asks for visual output, use `sandbox_execute` tool
2. Pass the HTML, CSS, and JS code as parameters
3. The sandbox will render the code
4. Review the screenshot for results

## Important Rules

1. **ALWAYS use the tool** when creating HTML/CSS/JS - don't just describe it
2. Pass REAL code in the tool parameters - not empty strings
3. Use complete, runnable code - not partial snippets
4. The sandbox will show the actual rendered result