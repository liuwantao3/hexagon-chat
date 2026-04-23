export const sandboxExecuteTool = {
  name: 'sandbox_execute',
  description: `Execute HTML/CSS/JS code and display it in the chat. The code will be rendered inline in the chat.
  - Use this to create interactive web demos, test frontend code, and build UI prototypes
  - Returns the HTML/CSS/JS in a format that will be displayed inline in the chat
  - Supports interactive elements like buttons, forms, etc.
  - HTML: The HTML structure to render
  - CSS: Optional CSS styles to apply
  - JS: Optional JavaScript code to execute`,
  
  schema: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'HTML code to render in the sandbox' },
      css: { type: 'string', description: 'CSS code to style the HTML' },
      js: { type: 'string', description: 'JavaScript code to execute' }
    },
    required: ['html']
  },
  
  async execute(input) {
    const { html = '', css = '', js = '' } = input
    
    // Build complete HTML document with CSS and JS
    let fullHtml = html
    if (css || js) {
      const styleTag = css ? `<style>${css}</style>` : ''
      const scriptTag = js ? `<script>${js}</script><` + `/script>` : ''
      
      // If HTML is a full document, inject into body
      if (html.includes('<html') || html.includes('<head') || html.includes('<body')) {
        fullHtml = html.replace('</head>', `${styleTag}</head>`)
          .replace('</body>', `${scriptTag}</body>`)
      } else {
        // Wrap content in basic HTML structure
        fullHtml = `<!DOCTYPE html>
<html>
<head>${styleTag}</head>
<body>${html}${scriptTag}</body>
</html>`
      }
    }
    
    // Convert to data URL
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`
    
    const result = {
      success: true,
      htmlUrls: [dataUrl],
      message: 'HTML rendered in chat'
    }
    
    return JSON.stringify(result)
  }
}

export default [sandboxExecuteTool]
