import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { spawn } from 'child_process'

const EXECUTION_TIMEOUT = 60000 // 60 seconds for complex tasks like plotting

interface ExecutionResult {
    success: boolean
    output: string
    error: string
    language: string
    executionTime: number
}

async function executeCode(code: string, language: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
        const startTime = Date.now()
        let output = ''
        let error = ''

        let command: string
        let args: string[]

        if (language === 'python') {
            command = 'python3'
            args = ['-c', code]
        } else if (language === 'javascript' || language === 'js') {
            command = 'node'
            args = ['-e', code]
        } else {
            resolve({
                success: false,
                output: '',
                error: `Unsupported language: ${language}. Supported: python, javascript`,
                language,
                executionTime: 0
            })
            return
        }

        const proc = spawn(command, args, {
            timeout: EXECUTION_TIMEOUT,
            shell: false,
            env: { ...process.env, NODE_OPTIONS: '--no-warnings' }
        })

        let timedOut = false

        const timeoutId = setTimeout(() => {
            timedOut = true
            proc.kill('SIGKILL')
            resolve({
                success: false,
                output: output || '(partial output above)',
                error: `Execution timed out after ${EXECUTION_TIMEOUT / 1000} seconds`,
                language,
                executionTime: Date.now() - startTime
            })
        }, EXECUTION_TIMEOUT)

        proc.stdout.on('data', (data) => {
            output += data.toString()
        })

        proc.stderr.on('data', (data) => {
            error += data.toString()
        })

        proc.on('close', (code) => {
            clearTimeout(timeoutId)
            const executionTime = Date.now() - startTime

            if (timedOut) return // Already resolved

            if (code === 0) {
                resolve({
                    success: true,
                    output: output || '(no output)',
                    error: '',
                    language,
                    executionTime
                })
            } else {
                resolve({
                    success: false,
                    output: output || '(no output)',
                    error: error || `Process exited with code ${code}`,
                    language,
                    executionTime
                })
            }
        })

        proc.on('error', (err) => {
            clearTimeout(timeoutId)
            const executionTime = Date.now() - startTime
            resolve({
                success: false,
                output: '',
                error: `Failed to execute: ${err.message}`,
                language,
                executionTime
            })
        })
    })
}

const executeCodeSchema = z.object({
    code: z.string().describe('The code to execute'),
    language: z.enum(['python', 'javascript', 'js']).describe('Programming language: python or javascript'),
})

export const codeExecutionTool = tool(
    async (input: { code: string; language: string }) => {
        console.log('[CodeAgent] Executing code:', { language: input.language, codeLength: input.code.length })

        const result = await executeCode(input.code, input.language)

        console.log('[CodeAgent] Execution result:', {
            success: result.success,
            executionTime: result.executionTime,
            outputLength: result.output.length,
            errorLength: result.error.length
        })

        if (result.success) {
            return `✅ Execution successful (${result.executionTime}ms)

Output:
${result.output}
`
        } else {
            return `❌ Execution failed (${result.executionTime}ms)

Error:
${result.error}

${result.output ? `Output:\n${result.output}` : ''}
`
        }
    },
    {
        name: 'execute_code',
        description: `Execute Python or JavaScript code and return the output. Use this tool when you need to:
- Perform calculations or data processing
- Run algorithms or code snippets
- Test or verify code
- Process data

The code will be executed in a sandboxed environment with a 30-second timeout.`,
        schema: executeCodeSchema,
    }
)

export const codeExecutionTools = [codeExecutionTool]
