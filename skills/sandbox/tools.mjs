export const sandboxExecuteTool = {
  name: 'sandbox_execute',
  description: `Execute HTML/CSS/JS code in the sandbox. The code will be rendered in real-time in the browser.
  - Use this to create interactive web demos, test frontend code, and build UI prototypes
  - Returns the code in a format that will be automatically rendered in the sandbox panel
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
    
    const result = {
      success: true,
      html,
      css,
      js,
      message: `Code sent to sandbox. ${js ? 'JavaScript will execute in the browser.' : ''}`
    }
    
    return JSON.stringify(result)
  }
}

export default [sandboxExecuteTool]
