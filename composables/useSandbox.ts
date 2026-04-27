import { useStorage } from '@vueuse/core'

interface ConsoleLog {
  level: 'log' | 'warn' | 'error'
  message: string
  timestamp: number
}

interface SandboxState {
  html: string
  css: string
  js: string
}

const STORAGE_KEY = 'sandbox-state'

export const useSandbox = () => {
  const sandboxEnabled = useStorage<boolean>('sandboxEnabled', false)
  const sandboxMode = useStorage<'inline' | 'panel'>('sandboxMode', 'inline')
  const autoScreenshot = useStorage<boolean>('autoScreenshot', true)
  const includeConsole = useStorage<boolean>('includeConsole', true)
  const visionModel = useStorage<string>('visionModel', '')
  const panelWidth = useStorage<number>('sandboxPanelWidth', 800)
  const consoleHeight = useStorage<number>('sandboxConsoleHeight', 200)
  const isPanelOpen = useStorage<boolean>('sandboxPanelOpen', false)

  const state = useStorage<SandboxState>(STORAGE_KEY, {
    html: '',
    css: '',
    js: ''
  })

  const consoleLogs = ref<ConsoleLog[]>([])
  const iframeRef = ref<HTMLIFrameElement | null>(null)
  const isLoading = ref(false)

  const isEnabled = computed(() => sandboxEnabled.value)
  const isInline = computed(() => sandboxMode.value === 'inline')
  const isPanel = computed(() => sandboxMode.value === 'panel')
  const isAutoScreenshot = computed(() => autoScreenshot.value)
  const isIncludeConsole = computed(() => includeConsole.value)
  const isOpen = computed(() => isPanelOpen.value)

  const updateCode = (type: 'html' | 'css' | 'js', code: string) => {
    state.value[type] = code
    render()
  }

  const updateFromCodeBlocks = (htmlCode?: string, cssCode?: string, jsCode?: string) => {
    // If HTML contains full document, extract body content
    let processedHtml = htmlCode || ''
    let processedJs = jsCode || ''
    
    // Check if it's a full HTML document and extract body content
    if (processedHtml.includes('<body') && processedHtml.includes('</body>')) {
      const bodyMatch = processedHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      if (bodyMatch) {
        processedHtml = bodyMatch[1].trim()
      }
    }
    
    // Extract any script tags from HTML and move to JS
    if (processedHtml.includes('<script')) {
      const scriptMatches = processedHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi)
      if (scriptMatches) {
        scriptMatches.forEach(script => {
          const contentMatch = script.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
          if (contentMatch && contentMatch[1]) {
            processedJs += (processedJs ? '\n' : '') + contentMatch[1].trim()
          }
        })
        // Remove script tags from HTML
        processedHtml = processedHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      }
    }
    

    
if (processedHtml) state.value.html = processedHtml
    if (cssCode) state.value.css = cssCode
    if (processedJs) state.value.js = processedJs
    
    // Only open panel in panel mode, not in inline mode
    // In inline mode, HTML is displayed in chat via ToolCallItem
    if (sandboxMode.value === 'panel') {
      isPanelOpen.value = true
    }
    
    // Use requestAnimationFrame for more reliable rendering
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (sandboxMode.value === 'panel') {
          render()
        }
      })
    })
  }

  const reset = () => {
    state.value = { html: '', css: '', js: '' }
    consoleLogs.value = []
    requestAnimationFrame(() => {
      render()
    })
  }

  let isRendering = false
  let lastRenderedHtml = ''
  const render = (retryCount = 0) => {
    if (isRendering) {
      return
    }
    if (lastRenderedHtml === state.value.html && iframeRef.value) {
      return
    }
    
    isRendering = true
    if (!iframeRef.value) {
      const delays = [50, 100, 200, 500, 1000]
      const delay = delays[Math.min(retryCount, delays.length - 1)]
      
      if (retryCount < 10) {
        setTimeout(() => {
          render(retryCount + 1)
        }, delay)
      }
      isRendering = false
      return
    }
    renderContent()
    lastRenderedHtml = state.value.html
    isRendering = false
  }

  const renderContent = () => {
    if (!iframeRef.value) return

    const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${state.value.css}
  </style>
</head>
<body>
  ${state.value.html}
  <script>
    (function() {
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      function sendToParent(type, data) {
        try {
          parent.postMessage({
            type: type,
            ...data
          }, '*');
        } catch(e) {}
      }

      // Console capture
      console.log = function() {
        originalLog.apply(console, arguments);
        sendToParent('sandbox-console', { level: 'log', message: Array.from(arguments).map(a => String(a)).join(' ') });
      };

      console.warn = function() {
        originalWarn.apply(console, arguments);
        sendToParent('sandbox-console', { level: 'warn', message: Array.from(arguments).map(a => String(a)).join(' ') });
      };

      console.error = function() {
        originalError.apply(console, arguments);
        sendToParent('sandbox-console', { level: 'error', message: Array.from(arguments).map(a => String(a)).join(' ') });
      };

      window.onerror = function(msg, url, line, col, error) {
        sendToParent('sandbox-console', { level: 'error', message: msg + ' (line ' + line + ')' });
      };

      // User interaction capture
      document.addEventListener('click', function(e) {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        const id = target.id || '';
        const className = target.className || '';
        const text = target.textContent || '';
        sendToParent('sandbox-interaction', { 
          event: 'click', 
          tag: tagName, 
          id: id, 
          class: className,
          text: text.substring(0, 50)
        });
      }, true);

      document.addEventListener('input', function(e) {
        const target = e.target;
        sendToParent('sandbox-interaction', { 
          event: 'input', 
          tag: target.tagName.toLowerCase(),
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
  <script>
    try {
      ${state.value.js}
    } catch(e) {
      console.error(e.message);
    }
  <\/script>
</body>
</html>`

    iframeRef.value.srcdoc = content
  }

  const handleConsoleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'sandbox-console') {
      consoleLogs.value.push({
        level: event.data.level,
        message: event.data.message,
        timestamp: Date.now()
      })
    } else if (event.data?.type === 'sandbox-interaction') {
      // Log user interaction to console
      const interaction = event.data
      consoleLogs.value.push({
        level: 'log',
        message: `[${interaction.event}] ${interaction.tag}${interaction.id ? '#' + interaction.id : ''} ${interaction.text || ''}`.trim(),
        timestamp: Date.now()
      })
      
      // Call registered callback for parent to handle
      if (interactionCallback.value) {
        interactionCallback.value(interaction)
      }
    }
  }

  const interactionCallback = ref<((data: any) => void) | null>(null)

  const onInteraction = (callback: (data: any) => void) => {
    interactionCallback.value = callback
  }

  const clearConsole = () => {
    consoleLogs.value = []
  }

  const captureScreenshot = async (): Promise<string | null> => {
    if (!iframeRef.value?.contentDocument?.body) return null

    try {
      const canvas = document.createElement('canvas')
      const doc = iframeRef.value.contentDocument
      const body = doc.body
      
      canvas.width = body.scrollWidth
      canvas.height = body.scrollHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const elements = body.querySelectorAll('*')
      elements.forEach(el => {
        const rect = el.getBoundingClientRect()
        const style = iframeRef.value!.contentWindow.getComputedStyle(el)
        
        if (style.position === 'absolute' || style.position === 'fixed') {
          ctx.fillStyle = style.backgroundColor || '#ffffff'
          ctx.fillRect(rect.left, rect.top, rect.width, rect.height)
        }
      })

      return canvas.toDataURL('image/png')
    } catch (e) {
      console.error('Screenshot capture failed:', e)
      return null
    }
  }

  const getConsoleLogsAsText = () => {
    return consoleLogs.value.map(log => 
      `[${log.level.toUpperCase()}] ${log.message}`
    ).join('\n')
  }

  const setIframeRef = (el: HTMLIFrameElement | null) => {
    if (el) {
      iframeRef.value = el
      window.addEventListener('message', handleConsoleMessage)
      
      if (state.value.html || state.value.css || state.value.js) {
        nextTick(render)
      }
    }
  }

  const openPanel = () => {
    isPanelOpen.value = true
    // Try to render after panel opens
    nextTick(() => {
      if (state.value.html || state.value.css || state.value.js) {
        nextTick(render)
      }
    })
  }

  const closePanel = () => {
    isPanelOpen.value = false
  }

  const togglePanel = () => {
    isPanelOpen.value = !isPanelOpen.value
  }

  // Debounce for watch
  let watchRenderTimeout: NodeJS.Timeout | null = null
  const triggerRender = () => {
    if (watchRenderTimeout) clearTimeout(watchRenderTimeout)
    watchRenderTimeout = setTimeout(() => {
      if (iframeRef.value) {
        render()
      }
    }, 50)
  }

  // Watch for state changes (only triggers if render not already called)
  watch(() => state.value.html, (newVal, oldVal) => {
    if (newVal !== oldVal) {
      triggerRender()
    }
  })

  onUnmounted(() => {
    window.removeEventListener('message', handleConsoleMessage)
  })

  return {
    sandboxEnabled,
    sandboxMode,
    autoScreenshot,
    includeConsole,
    visionModel,
    panelWidth,
    consoleHeight,
    isPanelOpen,
    isEnabled,
    isInline,
    isPanel,
    isAutoScreenshot,
    isIncludeConsole,
    isOpen,
    state,
    consoleLogs,
    isLoading,
    iframeRef,
    setIframeRef,
    updateCode,
    updateFromCodeBlocks,
    reset,
    render,
    clearConsole,
    captureScreenshot,
    getConsoleLogsAsText,
    openPanel,
    closePanel,
    togglePanel,
    onInteraction
  }
}
