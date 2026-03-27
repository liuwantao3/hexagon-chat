<script setup lang="ts">
const codeOutput = ref<{ [key: string]: string }>({})

const handleCodeExecution = (code: string, language: string, cellId: string) => {
  console.log('Executing code:', { language, cellId, codeLength: code.length })
  
  let result = ''
  
  if (language === 'html') {
    // For HTML, open in a new tab or display preview
    const iframe = document.createElement('iframe')
    iframe.style.width = '100%'
    iframe.style.height = '400px'
    iframe.style.border = 'none'
    iframe.style.borderRadius = '8px'
    iframe.srcdoc = code
    
    // Create or update output container
    let outputEl = document.getElementById(`output-${cellId}`)
    if (!outputEl) {
      outputEl = document.createElement('div')
      outputEl.id = `output-${cellId}`
      outputEl.className = 'code-output'
      document.querySelectorAll('.executable-code-block').forEach(block => {
        if (block.querySelector(`[data-cell-id="${cellId}"]`)) {
          block.after(outputEl)
        }
      })
    }
    outputEl.innerHTML = ''
    outputEl.appendChild(iframe)
    result = 'HTML rendered in preview'
  } else if (language === 'javascript') {
    try {
      // Execute JavaScript and capture output
      const logs: string[] = []
      const originalLog = console.log
      console.log = (...args) => logs.push(args.map(a => String(a)).join(' '))
      
      // eslint-disable-next-line no-new-func
      const fn = new Function(code)
      fn()
      
      console.log = originalLog
      result = logs.length > 0 ? logs.join('\n') : 'Code executed successfully (no output)'
    } catch (e: any) {
      result = `Error: ${e.message}`
    }
  } else if (language === 'css') {
    // Apply CSS to the page temporarily
    const style = document.createElement('style')
    style.textContent = code
    style.id = `temp-style-${cellId}`
    document.head.appendChild(style)
    result = 'CSS applied to page'
  } else {
    result = `Execution for ${language} not implemented yet`
  }
  
  codeOutput.value[cellId] = result
  console.log('Execution result:', result)
}

onMounted(() => {
  window.CodeExecutionHandler = handleCodeExecution
})

onUnmounted(() => {
  delete window.CodeExecutionHandler
})
</script>

<template>
  <div></div>
</template>