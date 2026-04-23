export const summarizeTool = {
  name: 'summarize',
  description: `Summarize the conversation history into a comprehensive summary.
- Creates a structured summary of the entire conversation
- Includes: goals, instructions, discoveries, accomplishments, relevant files
- Use when user asks to summarize or for building a memory system
- The summary is generated based on the conversation context`,

  schema: {
    type: 'object',
    properties: {
      focus: {
        type: 'string',
        description: 'Optional focus area for the summary (e.g., "code changes", "decisions made")'
      },
      format: {
        type: 'string',
        enum: ['brief', 'detailed'],
        description: 'Summary format: brief or detailed'
      }
    }
  },

  async execute(params) {
    const { focus, format = 'detailed' } = params
    
    // Return a prompt that instructs the LLM to generate a comprehensive summary
    // The LLM has access to all previous messages in its context window
    const summaryPrompt = format === 'brief' 
      ? `Provide a brief summary of the conversation in 2-3 sentences.`
      : `Create a comprehensive summary of the conversation with the following sections:

## Goal
What goal(s) is the user trying to accomplish?

## Instructions
What important instructions did the user give?

## Discoveries
What notable things were learned during the conversation?

## Accomplished
What work has been completed?

## Relevant Files/Directories
A structured list of important files and directories mentioned or modified.

## Pending Tasks
What tasks remain to be done?

Please analyze the conversation history and fill in each section with relevant details.`

    const result = {
      success: true,
      summarize: true,
      focus: focus || 'general',
      format,
      prompt: summaryPrompt,
      note: 'This summary is generated based on the conversation context available to the LLM. All previous messages are included in the context window.'
    }
    
    return JSON.stringify(result)
  }
}

export default [summarizeTool]