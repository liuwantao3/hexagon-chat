import express from 'express'
import { executeCode, healthCheck } from './runner'
import { ExecuteRequest } from './types'

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.json())

app.get('/health', async (req, res) => {
  const dockerHealthy = await healthCheck()
  res.json({
    status: dockerHealthy ? 'healthy' : 'degraded',
    docker: dockerHealthy ? 'connected' : 'disconnected'
  })
})

app.post('/execute', async (req, res) => {
  try {
    const body = req.body as ExecuteRequest

    if (!body.code || !body.language) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: code, language'
      })
      return
    }

    const result = await executeCode(body)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({
      success: false,
      output: '',
      error: error.message || 'Internal server error',
      language: req.body.language,
      executionTime: 0
    })
  }
})

app.listen(PORT, () => {
  console.log(`Code runner service listening on port ${PORT}`)
})
