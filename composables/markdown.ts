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
    const executableLanguages = ['html', 'javascript', 'js']
    if (executableLanguages.includes(language)) {
      const cellId = `code-${Math.random().toString(36).slice(2, 11)}`
      sourceCodes[cellId] = {
        content: token.content,
        language
      }

      const highlighted = hljs.highlight(token.content, { language: hljs.getLanguage(language) ? language : 'plaintext', ignoreIllegals: true }).value

      // Light theme colors
      return `<div class="executable-code-block" data-cell-id="${cellId}" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 8px 0; background: #fafafa;">
        <div class="code-block-header" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb;">
          <span class="language-badge" style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">${language}</span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="fold-code-btn" data-cell-id="${cellId}" style="padding: 4px 8px; font-size: 12px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <button class="run-code-btn" data-cell-id="${cellId}" style="padding: 4px 8px; font-size: 12px; font-weight: 500; color: #6b7280; background: transparent; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        </div>
        <pre class="code-content" data-cell-id="${cellId}" style="margin: 0; padding: 12px; overflow-x: auto; background: #fafafa;"><code class="hljs language-${language}" style="font-family: 'SF Mono', Monaco, Inconsolata, 'Fira Mono', monospace; font-size: 13px; line-height: 1.5; color: #374151;">${highlighted}</code></pre>
      </div>`
    }

    // Use default renderer for non-executable blocks
    return defaultFenceRenderer?.(tokens, idx, options, env, self) || ''
  }

  return md
}
