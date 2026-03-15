// Global code runner plugin - sets up event delegation for code execution
import { getSourceCode, clearSourceCodes } from '~/composables/markdown'

export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  // Track which code blocks have been expanded
  const expandedBlocks = new Set<string>()

  const injectConsoleOverride = (cellId: string) => {
    return `<script type='text/javascript'>
      (function() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = function(...args) {
          const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
          window.parent.postMessage({ type: 'console', cellId: '${cellId}', level: 'log', content: message }, '*');
          originalLog.apply(console, args);
        };

        console.error = function(...args) {
          const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
          window.parent.postMessage({ type: 'console', cellId: '${cellId}', level: 'error', content: message }, '*');
          originalError.apply(console, args);
        };

        console.warn = function(...args) {
          const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
          window.parent.postMessage({ type: 'console', cellId: '${cellId}', level: 'warn', content: message }, '*');
          originalWarn.apply(console, args);
        };
      })();
    <\/script>`
  }

  const injectStyles = () => {
    return `<style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      body { background: white; }
      @media (prefers-color-scheme: dark) { body { background: #1a1a1a; color: #e0e0e0; } }
    </style>`
  }

  const runCode = (cellId: string, code: string, language: string) => {
    // Find the executable code block
    const block = document.querySelector(`.executable-code-block[data-cell-id="${cellId}"]`)
    if (!block) return

    // Check if runner already exists
    const existingRunner = block.parentElement?.querySelector(`.code-runner-container[data-cell-id="${cellId}"]`)
    if (existingRunner) {
      // Clear console and re-run by recreating the iframe to reset all state
      const consoleContent = existingRunner.querySelector('.console-content') as HTMLElement
      if (consoleContent) {
        consoleContent.innerHTML = ''
      }
      const consoleOutput = existingRunner.querySelector('.console-output') as HTMLElement
      if (consoleOutput) {
        consoleOutput.style.display = 'none'
      }
      const clearBtn = existingRunner.querySelector('.clear-btn') as HTMLButtonElement
      if (clearBtn) {
        clearBtn.style.display = 'none'
      }
      
      // Remove old iframe and create new one to reset all state (including imported libraries)
      const oldIframe = existingRunner.querySelector('iframe')
      if (oldIframe) {
        oldIframe.remove()
      }
      const newIframe = document.createElement('iframe')
      newIframe.style.cssText = 'width: 100%; height: 400px; border: none; background: white;'
      newIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
      newIframe.setAttribute('title', 'Code Execution')
      existingRunner.insertBefore(newIframe, existingRunner.children[1])
      executeInIframe(newIframe, code, language, cellId)
      return
    }

    // Create runner container
    const runnerContainer = document.createElement('div')
    runnerContainer.className = 'code-runner-container'
    runnerContainer.setAttribute('data-cell-id', cellId)
    runnerContainer.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 8px 0; background: #fff;'

    // Create toolbar
    const toolbar = document.createElement('div')
    toolbar.style.cssText = 'display: flex; gap: 8px; padding: 8px 12px; background: #f5f5f5; border-bottom: 1px solid #e5e7eb;'
    
    const clearBtn = document.createElement('button')
    clearBtn.className = 'clear-btn'
    clearBtn.textContent = 'Clear'
    clearBtn.style.cssText = 'padding: 4px 12px; font-size: 12px; font-weight: 500; color: #666; background: #e5e7eb; border: none; border-radius: 4px; cursor: pointer; display: none;'
    clearBtn.style.display = 'none'

    toolbar.appendChild(clearBtn)

    // Create iframe
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'width: 100%; height: 400px; border: none; background: white;'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    iframe.setAttribute('title', 'Code Execution')

    // Create console output
    const consoleOutput = document.createElement('div')
    consoleOutput.className = 'console-output'
    consoleOutput.style.cssText = 'border-top: 1px solid #e5e7eb; background: #1e1e1e; max-height: 200px; overflow-y: auto; display: none;'
    
    const consoleHeader = document.createElement('div')
    consoleHeader.textContent = 'Console'
    consoleHeader.style.cssText = 'padding: 4px 12px; font-size: 12px; font-weight: 600; color: #888; background: #2d2d2d; text-transform: uppercase; letter-spacing: 0.5px;'
    
    const consoleContent = document.createElement('div')
    consoleContent.className = 'console-content'
    consoleContent.style.cssText = 'padding: 8px 12px; font-family: "SF Mono", Monaco, Inconsolata, "Fira Mono", monospace; font-size: 13px; line-height: 1.5;'
    
    consoleOutput.appendChild(consoleHeader)
    consoleOutput.appendChild(consoleContent)

    // Add to container
    runnerContainer.appendChild(toolbar)
    runnerContainer.appendChild(iframe)
    runnerContainer.appendChild(consoleOutput)

    // Insert after the code block
    block.parentElement?.insertBefore(runnerContainer, block.nextSibling)

    // Set up message handler
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'console' && event.data?.cellId === cellId) {
        consoleOutput.style.display = 'block'
        clearBtn.style.display = 'inline-block'

        const prefix = event.data.level === 'error' ? '❌ ' : event.data.level === 'warn' ? '⚠️ ' : ''
        const line = document.createElement('div')
        line.style.cssText = 'color: #d4d4d4; white-space: pre-wrap; word-break: break-all;'
        line.textContent = prefix + event.data.content
        consoleContent.appendChild(line)
      }
    }

    window.addEventListener('message', messageHandler)

    // Clear button handler
    clearBtn.addEventListener('click', () => {
      consoleContent.innerHTML = ''
      consoleOutput.style.display = 'none'
      clearBtn.style.display = 'none'
    })

    // Initial execution
    executeInIframe(iframe, code, language, cellId)
  }

  const executeInIframe = (iframe: HTMLIFrameElement, code: string, language: string, cellId: string) => {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) return

    iframeDoc.open()

    let modifiedContent = code

    if (language === 'html') {
      const headEndIndex = modifiedContent.indexOf('</head>')
      const bodyStartIndex = modifiedContent.indexOf('<body')

      if (headEndIndex !== -1) {
        modifiedContent = modifiedContent.slice(0, headEndIndex) + injectConsoleOverride(cellId) + modifiedContent.slice(headEndIndex)
      } else if (bodyStartIndex !== -1) {
        modifiedContent = '<head>' + injectConsoleOverride(cellId) + '</head>' + modifiedContent.slice(bodyStartIndex)
      } else {
        modifiedContent = '<head>' + injectConsoleOverride(cellId) + '</head><body>' + modifiedContent + '</body>'
      }
    } else {
      modifiedContent = `<!DOCTYPE html>
<html>
<head>${injectStyles()}${injectConsoleOverride(cellId)}</head>
<body>
<script>
${code}
<\/script>
</body>
</html>`
    }

    iframeDoc.write(modifiedContent)
    iframeDoc.close()
  }

  // Handle clicks on run buttons and fold buttons
  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    
    const runBtn = target.closest('.run-code-btn') as HTMLElement
    if (runBtn) {
      const cellId = runBtn.dataset.cellId
      if (cellId) {
        const sourceCode = getSourceCode(cellId)
        if (sourceCode) {
          expandedBlocks.add(cellId)
          runCode(cellId, sourceCode.content, sourceCode.language)
        }
      }
      return
    }
    
    const foldBtn = target.closest('.fold-code-btn') as HTMLElement
    if (foldBtn) {
      const cellId = foldBtn.dataset.cellId
      if (cellId) {
        const codeBlock = document.querySelector(`.executable-code-block[data-cell-id="${cellId}"]`)
        if (codeBlock) {
          const codeContent = codeBlock.querySelector('.code-content') as HTMLElement
          const isFolded = codeContent.style.display === 'none'
          codeContent.style.display = isFolded ? 'block' : 'none'
          
          const icon = foldBtn.querySelector('svg')
          if (icon) {
            if (isFolded) {
              icon.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>'
            } else {
              icon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>'
            }
          }
        }
      }
    }
  }

  // Use event delegation - listen on document
  document.addEventListener('click', handleClick)

  // Clean up on unmount
  return {
    unmount() {
      document.removeEventListener('click', handleClick)
      clearSourceCodes()
      expandedBlocks.clear()
    }
  }
})
