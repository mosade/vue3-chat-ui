export type AiChatRole = 'user' | 'assistant' | 'system' | 'error'

export type AiChatMessageStatus = 'pending' | 'streaming' | 'done' | 'error'

export interface AiChatMessage {
  id: string
  role: AiChatRole
  content: string
  status?: AiChatMessageStatus
  createdAt?: number
  meta?: Record<string, unknown>
}

export interface AiChatSendContext {
  prompt: string
  messages: AiChatMessage[]
  signal: AbortSignal
  append: (chunk: string) => void
  update: (message: Partial<AiChatMessage>) => void
}

export interface AiChatAdapter {
  send: (context: AiChatSendContext) => Promise<string | void>
}

export interface AiChatError {
  message: string
  cause?: unknown
}
