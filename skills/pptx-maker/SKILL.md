---
name: pptx-maker
description: Create and edit PowerPoint presentations using Python MCP server. Create slides, add text, images, and more.
icon: 📊
category: custom
language: python
source: local
---

# PowerPoint Maker

Create professional PowerPoint presentations using Python tools via MCP (Model Context Protocol).

## Architecture

This skill uses a **Python MCP server** to provide PPTX tools:
- Python runs as a separate process via stdio
- Communicates with your project using JSON-RPC
- Uses `python-pptx` for PPTX manipulation

## Setup

Python dependencies are required:

```bash
pip install mcp python-pptx Pillow
```

The MCP server is configured in `.mcp-servers.json` and loads automatically.

## Tools Available

| Tool | Description |
|------|-------------|
| `create_presentation` | Create a new PPTX file |
| `add_slide` | Add a slide with layout (title, title_content, two_content, blank) |
| `add_text` | Add text to the current slide |
| `add_bullet_points` | Add bullet list to the current slide |
| `add_image` | Add an image to the current slide |
| `save_presentation` | Save the presentation to a file path |
| `get_info` | Get information about the presentation |
| `preview_slides` | Generate PNG preview images of slides for in-browser display |
| `open_presentation` | Open the presentation in desktop app (PowerPoint/Keynote) - for user to edit |

## Usage Example

```
User: Create a presentation titled "AI Trends" with 3 slides

Assistant calls:
1. create_presentation(title="AI Trends")
2. add_slide(layout="title", title="AI Trends")
3. add_text(text="Introduction", position="content")
4. add_bullet_points(items=["Point 1", "Point 2", "Point 3"])
5. add_slide(layout="title", title="Slide 2")
6. add_text(text="More content here", position="content")
7. add_slide(layout="title", title="Slide 3")
8. add_text(text="Conclusion", position="content")
9. save_presentation(path="/path/to/slides.pptx")
```

### Preview & Open Flow

#### For newly created presentations (in-session):
```
User: Show me a preview of the slides

Assistant calls:
1. preview_slides() → Returns PNG previews for all slides
2. User sees preview modal with slide thumbnails
3. User clicks "Open in App" → Opens in PowerPoint/Keynote
```

#### For existing PPTX files on disk (show in browser):
```
User: Show/preview /path/to/file.pptx in browser

Assistant calls:
1. open_presentation(path="/path/to/file.pptx") → Copies file to temp location
2. preview_slides() → Returns PNG previews for in-browser display
```

#### Open in desktop app for editing:
```
User: Open /path/to/file.pptx in PowerPoint/Keynote

Assistant calls:
1. open_presentation(path="/path/to/file.pptx") → Opens in desktop app
```

**Important:** 
- For **browser preview**: call BOTH `open_presentation` THEN `preview_slides`
- For **desktop editing**: call `open_presentation` only

## Implementation Details

- Based on `mcp-builder` template
- State persistence via temp file (`/tmp/_pptx_maker_current.pptx`)
- Python 3.9+ compatible
- Error handling with helpful messages

## Files

- `server.py` - Python MCP server implementation
- `SKILL.md` - This documentation
