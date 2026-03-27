export const sandboxExecuteTool = {
  name: 'sandbox_execute',
  description: 'Execute HTML/CSS/JS code in the sandbox. The code will be rendered and you can see the results.',
  
  schema: {
    html: { type: 'string', description: 'HTML code to render in the sandbox' },
    css: { type: 'string', description: 'CSS code to style the HTML' },
    js: { type: 'string', description: 'JavaScript code to execute' },
    js_code: { type: 'string', description: 'Alternative field for JavaScript code' }
  },
  
  async execute({ html, css, js, js_code }) {
    const finalJs = js || js_code || ''
    const finalHtml = html || ''
    const finalCss = css || ''
    
    console.log('Sandbox execute called with:', { html: finalHtml, css: finalCss, js: finalJs })
    
    return JSON.stringify({
      success: true,
      message: 'Code executed in sandbox.',
      html: finalHtml,
      css: finalCss,
      code: finalJs
    })
  }
}

export const sandboxGetStateTool = {
  name: 'sandbox_get_state',
  description: 'Get the current state of the sandbox including HTML, CSS, and JavaScript.',
  
  async execute({}) {
    return JSON.stringify({
      state: 'Use this to retrieve current sandbox code for reference',
      note: 'State is maintained in the sandbox panel'
    })
  }
}

export const sandboxResetTool = {
  name: 'sandbox_reset',
  description: 'Reset the sandbox to empty state. Use this to start fresh.',
  
  async execute({}) {
    return JSON.stringify({
      success: true,
      message: 'Sandbox has been reset.',
      reset: true
    })
  }
}

export default [sandboxExecuteTool, sandboxGetStateTool, sandboxResetTool]