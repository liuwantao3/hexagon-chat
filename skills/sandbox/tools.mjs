const interactionCaptureCode = `
<script>
(function() {
  function sendToParent(type, data) {
    try {
      parent.postMessage({ type: type, ...data }, '*');
    } catch(e) {}
  }

  document.addEventListener('click', function(e) {
    var target = e.target;
    sendToParent('sandbox-interaction', {
      event: 'click',
      tag: target.tagName ? target.tagName.toLowerCase() : '',
      id: target.id || '',
      class: target.className || '',
      text: target.textContent ? target.textContent.substring(0, 50) : ''
    });
  }, true);

  document.addEventListener('input', function(e) {
    var target = e.target;
    sendToParent('sandbox-interaction', {
      event: 'input',
      tag: target.tagName ? target.tagName.toLowerCase() : '',
      id: target.id || '',
      value: target.value ? target.value.substring(0, 50) : ''
    });
  }, true);

  document.addEventListener('submit', function(e) {
    sendToParent('sandbox-interaction', { event: 'submit' });
    e.preventDefault();
  }, true);
})();
<\/script>
`;

export const sandboxExecuteTool = {
  name: 'sandbox_execute',
  description: `Execute HTML/CSS/JS code and display it in the chat. The code will be rendered inline in the chat.
  - Use this to create interactive web demos, test frontend code, build UI prototypes, and interactive text adventures
  - Returns the HTML/CSS/JS in a format that will be displayed inline in the chat
  - Supports interactive elements like buttons, forms, etc.
  - **User interactions are automatically sent back to the LLM as silent messages**
  - Design interactive elements with meaningful 'id' attributes for clear interaction feedback
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
    
    // Build complete HTML document with CSS, JS, and interaction capture
    let fullHtml = html
    if (css || js) {
      const styleTag = css ? `<style>${css}</style>` : ''
      const scriptTag = js ? `<script>${js}<\/script>` : ''
      
      // If HTML is a full document, inject into body
      if (html.includes('<html') || html.includes('<head') || html.includes('<body')) {
        fullHtml = html.replace('</head>', `${styleTag}${interactionCaptureCode}</head>`)
          .replace('</body>', `${scriptTag}</body>`)
      } else {
        // Wrap content in basic HTML structure
        fullHtml = `<!DOCTYPE html>
<html>
<head>${styleTag}${interactionCaptureCode}</head>
<body>${html}${scriptTag}</body>
</html>`;
      }
    } else {
      // Just HTML, no CSS/JS - still need interaction capture
      if (html.includes('<html') || html.includes('<head') || html.includes('<body')) {
        fullHtml = html.replace('</head>', `${interactionCaptureCode}</head>`)
      } else {
        fullHtml = `<!DOCTYPE html>
<html>
<head>${interactionCaptureCode}</head>
<body>${html}</body>
</html>`;
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
