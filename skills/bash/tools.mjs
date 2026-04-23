import { exec } from 'child_process'

const PYTHON = '/Users/arctic/miniconda3/bin/python3.11'

export const bashTool = {
  name: 'execute_on_host',
  description: `Execute shell command on the host filesystem.
- Runs commands on your machine: ls, grep, cat, git, python, node, etc.
- Example: python3 -c "print(9*8)"`,

  schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to run'
      },
      workdir: {
        type: 'string', 
        description: 'Working directory (optional)'
      }
    },
    required: ['command']
  },

  async execute(params) {
    const { command, workdir } = params
    const cwd = workdir || process.cwd()
    const serverCwd = process.cwd()
    
    console.log('[BashTool] params:', JSON.stringify(params))
    console.log('[BashTool] workdir param:', workdir)
    console.log('[BashTool] effective cwd:', cwd)
    console.log('[BashTool] server cwd:', serverCwd)

    return new Promise((resolve) => {
      let actualCmd = command
      if (typeof command === 'string' && command.startsWith('bash -c ')) {
        const inner = command.slice(8).trim()
        const match = inner.match(/^["'](.*)["']$/)
        actualCmd = match ? match[1] : inner
      }
      
      if (actualCmd.includes('python') && !actualCmd.includes(PYTHON)) {
        actualCmd = actualCmd.replace(/python3?/g, PYTHON)
      }

      console.log('[BashTool] actual command:', actualCmd)
      console.log('[BashTool] cwd:', cwd)

      exec(actualCmd, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          console.log('[BashTool] error:', error.message, 'code:', error.code)
          resolve('Error: ' + error.message)
          return
        }
        
        console.log('[BashTool] success, stdout:', stdout)
        
        resolve(JSON.stringify({
          success: true,
          markdown: (stdout || '').trim() || 'Command executed successfully'
        }))
      })
    })
  }
}

export default [bashTool]