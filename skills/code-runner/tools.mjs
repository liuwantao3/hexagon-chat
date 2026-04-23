const CODE_RUNNER_URL = process.env.CODE_RUNNER_URL || 'http://localhost:8080'

console.log('[CodeRunner Skill] CODE_RUNNER_URL:', CODE_RUNNER_URL)

export const executeCodeInDockerTool = {
  name: 'execute_code_in_docker',
  description: `Execute code in a secure Docker-based sandbox. Supports bash, Python, and Node.js.
- Each execution runs in an isolated container with network access
- Memory limit: 256MB, CPU limit: 1 core
- Default timeout: 30 seconds (max 60 seconds)
- For Python/Node packages: use bash to run 'pip install' or 'npm install' first
- Returns stdout/stderr output and execution time
- Note: This runs in Docker, so filesystem is the container's, not the host's`,

  schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code or command to execute'
      },
      language: {
        type: 'string',
        enum: ['bash', 'sh', 'python', 'python3', 'javascript', 'node'],
        description: 'Programming language: bash, python, python3, javascript, or node'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (optional, default: 30000, max: 60000)',
        maximum: 60000
      }
    },
    required: ['code', 'language']
  },

  async execute({ code, language, timeout = 30000 }) {
    console.log('[CodeRunner Skill] execute called with:', { language, codeLength: code?.length, timeout })
    try {
      const response = await fetch(`${CODE_RUNNER_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          language,
          timeout: Math.min(timeout, 60000)
        })
      })

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `HTTP error: ${response.status} ${response.statusText}`
        })
      }

      const result = await response.json()

      console.log('[CodeRunner] Result:', {
        success: result.success,
        outputLength: result.output?.length,
        images: result.images?.length,
        imageDetails: result.images?.map((img) => ({ filename: img.filename, mimeType: img.mimeType, dataLength: img.data?.length }))
      })

      if (result.success) {
        const response = {
          success: true,
          markdown: `✅ Execution successful (${result.executionTime}ms)\n\nOutput:\n\`\`\`\n${result.output}\n\`\`\``,
          imageUrls: []
        }
        
        if (result.images && result.images.length > 0) {
          for (const img of result.images) {
            const dataUrl = `data:${img.mimeType};base64,${img.data}`
            console.log('[CodeRunner] Image added:', img.filename, 'size:', dataUrl.length)
            response.imageUrls.push(dataUrl)
          }
        }
        
        console.log('[CodeRunner] Final response imageUrls count:', response.imageUrls.length)
        return JSON.stringify(response)
      } else {
        return JSON.stringify({
          success: false,
          error: result.error,
          output: result.output,
          markdown: `❌ Execution failed (${result.executionTime}ms)\n\nError:\n${result.error}\n${result.output ? `\nOutput:\n\`\`\`\n${result.output}\n\`\`\`` : ''}`
        })
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to execute code: ${error.message}`,
        hint: 'Make sure the code-runner service is running and accessible'
      })
    }
  }
}

export default [executeCodeInDockerTool]
