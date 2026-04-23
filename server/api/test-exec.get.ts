import { exec } from 'child_process'

const PYTHON = '/Users/arctic/miniconda3/bin/python3.11'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const cmd = query.cmd || 'echo hello'
  
  // Replace python with full path
  const actualCmd = cmd.replace(/python3?/g, PYTHON)
  
  console.log('[TestExec] cmd:', cmd, '-> actual:', actualCmd)
  
  return new Promise((resolve) => {
    exec(actualCmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ error: error.message, code: error.code })
      } else {
        resolve({ code: 0, stdout, stderr })
      }
    })
  })
})