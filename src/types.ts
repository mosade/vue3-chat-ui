export type AiChatRole = 'user' | 'assistant' | 'system' | 'error'

export type AiChatMessageStatus = 'pending' | 'streaming' | 'done' | 'error' | 'stopped'

export type AiChatTraceKind = 'reasoning' | 'search' | 'tool' | 'source'

export type AiChatTraceStatus = 'pending' | 'done' | 'error'

export interface AiChatTrace {
  id: string
  kind: AiChatTraceKind
  title: string
  content?: string
  status?: AiChatTraceStatus
  items?: string[]
  createdAt?: number
  meta?: Record<string, unknown>
}

export interface AiChatSource {
  id: string
  title: string
  url?: string
  snippet?: string
  index?: number
  meta?: Record<string, unknown>
}

export interface AiChatMessage {
  id: string
  role: AiChatRole
  content: string
  status?: AiChatMessageStatus
  sources?: AiChatSource[]
  traces?: AiChatTrace[]
  createdAt?: number
  meta?: Record<string, unknown>
}

export interface AiChatSendContext {
  prompt: string
  messages: AiChatMessage[]
  signal: AbortSignal
  append: (chunk: string) => void
  update: (message: Partial<AiChatMessage>) => void
  appendTrace: (trace: Omit<AiChatTrace, 'id' | 'createdAt'> & Partial<Pick<AiChatTrace, 'id' | 'createdAt'>>) => string
  updateTrace: (id: string, trace: Partial<AiChatTrace>) => void
}

export interface AiChatRegeneratePayload {
  message: AiChatMessage
  promptMessage: AiChatMessage
  messages: AiChatMessage[]
}

export interface AiChatAdapter {
  send: (context: AiChatSendContext) => Promise<string | void>
}

export interface AiChatError {
  message: string
  cause?: unknown
}
