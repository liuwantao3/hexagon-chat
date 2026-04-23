export const confirmTool = {
  name: 'confirm',
  description: `Ask user to confirm or deny an action.
- Use this before executing sensitive operations that require user consent
- The user will see a confirmation prompt with the action details
- Returns a confirmation request waiting for user response
- Supports dangerous commands, file modifications, external access, etc.`,

  schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Description of the action that needs confirmation'
      },
      action: {
        type: 'string',
        description: 'The action to be performed (e.g., "delete files", "execute command", "grant access")'
      },
      details: {
        type: 'string',
        description: 'Additional details about the action'
      }
    },
    required: ['message', 'action']
  },

  async execute(params) {
    const { message, action, details } = params
    
    // Return a confirmation request that includes a unique ID
    const confirmId = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const result = {
      success: true,
      confirm: true,
      confirmId,
      message,
      action,
      details: details || '',
      prompt: `Please confirm: ${action}\n${message}${details ? '\n' + details : ''}\n\nReply with "confirm" or "cancel"`
    }
    
    return JSON.stringify(result)
  }
}

export default [confirmTool]