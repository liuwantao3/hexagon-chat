---
name: sandbox
description: Execute HTML/CSS/JS code in a sandbox environment. Use this to create interactive web demos, test frontend code, build UI prototypes, and interactive text-based adventure games.
icon: 🖥️
examples:
  - "Create a button that shows an alert when clicked"
  - "Build a simple counter component"
  - "Render a chart with sample data"
  - "Create an interactive text adventure game with choice buttons"
---

## Runtime Environment

Your JavaScript code runs in a **browser iframe** - NOT Node.js. This means:

### ❌ Don't Use
- Node.js APIs (`require`, `fs`, `path`, `process`, etc.)
- `import()` or `import ... from` statements
- `__dirname`, `__filename`
- ES module syntax (`export`, `export default`)

### ✅ Available (Pre-loaded)
- `window.THREE` - Three.js for 3D graphics
- `window.OrbitControls` - Camera controls for Three.js  
- `window.Matter` - 2D physics engine

### Writing Code (Three.js example)
```javascript
// Your code is automatically wrapped to load libraries first
// Just use THREE directly:
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

// ... rest of your game code
```

### How to Use Matter.js (2D Physics)
```javascript
const { Engine, Render, World, Bodies } = Matter;
// ...
```

## Interaction Feedback

When you create interactive content (buttons, forms, inputs), user interactions are automatically sent to you as silent messages. The LLM receives these interactions and can respond accordingly.

### How It Works

1. You generate HTML with interactive elements (buttons, inputs, forms)
2. User clicks a button or submits an input
3. The interaction is sent silently to the LLM as a message like:
   - `[User Action] Clicked: button#choice-1 "Go North"`
   - `[User Action] Input: input#command "explore cave"`
   - `[User Action] Submitted: form#choice-form`
3. The LLM processes the interaction and generates a response
4. **Note**: The interaction does NOT appear in the chat window - only the LLM's response does

### Best Practices for Interactive Content

- Use meaningful `id` attributes on interactive elements so the LLM can identify which element was interacted with
- Use descriptive button text that makes sense in context
- For text adventures, design clear choice buttons with IDs like `choice-north`, `choice-east`, etc.
- The LLM should design content expecting interaction feedback - it can generate the next story beat based on user choice

### Example: Text Adventure

When creating a text adventure game:
1. Generate the story intro with choice buttons
2. Use IDs like `btn-north`, `btn-south`, `btn-inventory`
3. When user clicks, LLM receives `[User Action] Clicked: button#btn-north "Go North"` and continues the story
