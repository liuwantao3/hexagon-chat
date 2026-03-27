import {
  type CodeExecutionTool,
  type FunctionDeclarationsTool as GoogleGenerativeAIFunctionDeclarationsTool,
  type GoogleSearchRetrievalTool,
} from "@google/generative-ai"
import type { BindToolsInput } from "@langchain/core/language_models/chat_models"

export type GoogleGenerativeAIToolType =
  | BindToolsInput
  | GoogleGenerativeAIFunctionDeclarationsTool
  | CodeExecutionTool
  | GoogleSearchRetrievalTool
