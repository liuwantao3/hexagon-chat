import MarkdownIt from "markdown-it"
import MarkdownItAbbr from "markdown-it-abbr"
import MarkdownItAnchor from "markdown-it-anchor"
import MarkdownItFootnote from "markdown-it-footnote"
import MarkdownItSub from "markdown-it-sub"
import MarkdownItSup from "markdown-it-sup"
import MarkdownItTasklists from "markdown-it-task-lists"
import MarkdownItTOC from "markdown-it-toc-done-right"
import MarkdownItKatex from "markdown-it-katex"
import markdownItKatexGpt from "./markdown-it-katex-gpt"
import hljs from "highlight.js"

// Store source codes for executable code blocks
export const sourceCodes: Record<string, { content: string; language: string }> = {}

export function getSourceCode(cellId: string) {
  return sourceCodes[cellId]
}

export function clearSourceCodes() {
  Object.keys(sourceCodes).forEach(key => delete sourceCodes[key])
}

// Custom plugin to handle ```latex code blocks
function latexBlockPlugin(md: MarkdownIt) {
  // Store the original fence renderer
  const defaultFenceRenderer = md.renderer.rules.fence || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  // Override the fence renderer
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const info = token.info.trim()

    // If it's a latex code block, render it with KaTeX
    if (info === 'latex') {
      // Use the same options as markdown-it-katex
      const katexOptions = {
        throwOnError: false,
        errorColor: '#cc0000',
        displayMode: true // Display mode for block equations
      }

      try {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
          // If KaTeX is loaded, use it
          if (katexModule) {
            return '<div class="katex-block">' +
              katexModule.renderToString(token.content, katexOptions) +
              '</div>'
          } else {
            // If KaTeX isn't loaded yet, return a placeholder that will be rendered client-side
            return `<div class="katex-block-ssr" data-latex="${encodeURIComponent(token.content)}"></div>`
          }
        } else {
          // Server-side rendering - just wrap in a div with a class for now
          // The actual rendering will happen client-side
          return `<div class="katex-block-ssr" data-latex="${encodeURIComponent(token.content)}"></div>`
        }
      } catch (error: any) {
        console.error('Error rendering LaTeX:', error)
        return `<pre class="katex-error">Error rendering LaTeX: ${error.message}</pre>`
      }
    }

    // Otherwise, use the default renderer
    return defaultFenceRenderer(tokens, idx, options, env, self)
  }
}

export function useMarkdown() {
  const md = new MarkdownIt({
    highlight(str, lang) {
      lang = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
    },
  })
    .use(MarkdownItAbbr)
    .use(MarkdownItAnchor)
    .use(MarkdownItFootnote)
    .use(MarkdownItSub)
    .use(MarkdownItSup)
    .use(MarkdownItTasklists)
    .use(MarkdownItTOC)
    // .use(MarkdownItKatex, {
    //   throwOnError: false,
    //   errorColor: '#cc0000',
    //   output: 'mathml'
    // })
    .use(markdownItKatexGpt, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
      ]
    })

  // Add custom fence renderer for executable code blocks
  const defaultFenceRenderer = md.renderer.rules.fence
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const language = token.info.trim()

    // Check if it's an executable language
    const executableLanguages = ['html', 'javascript', 'js', 'python', 'css']
    if (executableLanguages.includes(language)) {
      const cellId = `code-${Math.random().toString(36).slice(2, 11)}`
      sourceCodes[cellId] = {
        content: token.content,
        language
      }

      const highlighted = hljs.highlight(token.content, { language: hljs.getLanguage(language) ? language : 'plaintext', ignoreIllegals: true }).value

      // Light theme colors - subtle edit on click
      return `<div class="executable-code-block" data-cell-id="${cellId}" data-original-code="${encodeURIComponent(token.content)}" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 8px 0; background: #fafafa; position: relative;">
        <div class="code-block-header" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb;">
          <span class="language-badge" style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">${language}</span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="fold-code-btn" data-cell-id="${cellId}" style="padding: 4px 8px; font-size: 12px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <button class="save-code-btn" data-cell-id="${cellId}" data-original-code="${encodeURIComponent(token.content)}" style="padding: 4px 8px; font-size: 12px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; display: none; align-items: center; gap: 4px;" title="Save changes">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            </button>
            <button class="run-code-btn" data-cell-id="${cellId}" style="padding: 4px 8px; font-size: 12px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        </div>
        <pre 
          class="editable-code code-content" 
          contenteditable="true" 
          data-cell-id="${cellId}"
          data-original-code="${encodeURIComponent(token.content)}"
          data-language="${language}"
          style="margin: 0; padding: 12px; overflow-x: auto; background: #fafafa; outline: none; cursor: text; font-family: 'SF Mono', Monaco, Inconsolata, 'Fira Mono', monospace; font-size: 13px; line-height: 1.5;"
        ><code class="hljs language-${language}" style="font-family: inherit; font-size: inherit; line-height: inherit; color: #374151;">${highlighted}</code></pre>
        <div class="edit-hint" style="position: absolute; bottom: 8px; right: 8px; font-size: 10px; color: #9ca3af; opacity: 0; transition: opacity 0.2s; pointer-events: none;">click to edit • Ctrl+Enter to save</div>
      </div>
      <style>
        .executable-code-block:hover .edit-hint { opacity: 1; }
        .editable-code { caret-color: #3b82f6; }
      </style>`
    }

    // Use default renderer for non-executable blocks
    return defaultFenceRenderer?.(tokens, idx, options, env, self) || ''
  }

  return md
}

// Handle click events for run/save/fold buttons
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement
    
    const runBtn = target.closest('.run-code-btn') as HTMLElement
    const saveBtn = target.closest('.save-code-btn') as HTMLElement
    const foldBtn = target.closest('.fold-code-btn') as HTMLElement
    const codeBlock = target.closest('.executable-code-block') as HTMLElement
    
    if (runBtn && codeBlock) {
      e.preventDefault()
      e.stopPropagation()
      
      const pre = codeBlock.querySelector('pre') as HTMLPreElement
      const cellId = pre?.dataset.cellId || ''
      const language = pre?.dataset.language || 'javascript'
      const code = pre?.textContent || ''
      
      sourceCodes[cellId] = { content: code, language }
      
      console.log('Running code:', { cellId, language, codeLength: code.length })
      
      if (window.CodeExecutionHandler) {
        window.CodeExecutionHandler(code, language, cellId)
      } else {
        console.warn('CodeExecutionHandler not defined')
      }
    }
    
    if (saveBtn && codeBlock) {
      e.preventDefault()
      e.stopPropagation()
      
      const pre = codeBlock.querySelector('pre') as HTMLPreElement
      const cellId = pre?.dataset.cellId || ''
      const language = pre?.dataset.language || 'javascript'
      const code = pre?.textContent || ''
      
      sourceCodes[cellId] = { content: code, language }
      
      const badge = codeBlock.querySelector('.language-badge') as HTMLElement
      if (badge) badge.textContent = language
    }
    
    if (foldBtn && codeBlock) {
      e.preventDefault()
      e.stopPropagation()
      
      const pre = codeBlock.querySelector('pre') as HTMLPreElement
      if (pre) {
        pre.classList.toggle('hidden')
      }
    }
  })
}
