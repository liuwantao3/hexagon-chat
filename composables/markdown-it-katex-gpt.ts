import MarkdownIt from 'markdown-it'
import katex from 'katex'

interface Delimiter {
    left: string
    right: string
    display: boolean
}

interface Options {
    delimiters: Delimiter[]
}

const defaultOptions: Options = {
    delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
    ]
}

function escapedBracketRule(options: Options) {
    return (state: MarkdownIt.StateInline, silent: boolean): boolean => {
        const max = state.posMax
        const start = state.pos

        for (const { left, right, display } of options.delimiters) {

            if (!state.src.slice(start).startsWith(left)) continue

            let pos = start + left.length

            while (pos < max) {
                if (state.src.slice(pos).startsWith(right)) {
                    break
                }
                pos++
            }

            if (pos >= max) continue

            if (!silent) {
                const content = state.src.slice(start + left.length, pos)
                try {
                    const renderedContent = katex.renderToString(content, {
                        throwOnError: false,
                        displayMode: display
                    })
                    const token = state.push('html_inline', '', 0)
                    token.content = renderedContent
                } catch (e) {
                    console.error(e)
                }
            }

            state.pos = pos + right.length
            return true
        }
        return false
    }
}

export default function (md: MarkdownIt, options: Options = defaultOptions): void {
    md.inline.ruler.after('text', 'escaped_bracket', escapedBracketRule(options))
}
