---
name: display-image
description: Display images in the chat window
icon: 🖼️
category: system
source: local
---

# Display Image

Display image files in the chat window. Use this tool to show users generated images after they've been created.

## Tools

- `display_image`: Display an image file in the chat

## Usage

After generating images (e.g., plots, charts, screenshots), call this tool to display them in the chat.

**Important:** 
- Only display images that actually exist on the filesystem
- Provide the full path or relative path to the image file
- This tool converts images to base64 for display in the chat

## Example

```
User: Plot sin(x) and cos(x)
LLM: *calls execute_on_host to generate plot*
LLM: *calls display_image to show the plot*
LLM: Here's the plot you requested...
```