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
