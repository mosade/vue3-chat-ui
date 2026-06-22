import type { VNodeChild } from 'vue'

export type AiChatRole = 'user' | 'assistant' | 'system' | 'error'

export type AiChatMessageStatus = 'pending' | 'streaming' | 'done' | 'error' | 'stopped'

export type AiChatMessagePhase =
  | 'queued'
  | 'connecting'
  | 'waiting'
  | 'searching'
  | 'tool_calling'
  | 'reasoning'
  | 'answering'
  | 'done'
  | 'error'
  | 'stopped'

export type AiContentBlockKind = 'paragraph' | 'code' | 'image' | 'html'

export type AiContentParsed =
  | {
      type: 'text'
      content: string
    }
  | {
      type: 'html'
      content: string
    }
  | {
      type: 'vnode'
      content: VNodeChild
    }

export interface AiContentWidgetResolved {
  key?: string | number
  props?: Record<string, unknown>
}

export interface AiContentParserContext {
  streaming: boolean
  blockId?: string
  stable?: boolean
  kind?: AiContentBlockKind
  message?: AiChatMessage
}

export interface AiContentParser {
  parse: (content: string, context: AiContentParserContext) => AiContentParsed
}

export interface AiContentInlineWidget {
  name: string
  pattern: RegExp
  resolve: (
    match: RegExpExecArray,
    context: AiContentParserContext
  ) => AiContentWidgetResolved | null | undefined
  render: (props: Record<string, unknown>, context: AiContentParserContext) => VNodeChild
  fallback?: (match: RegExpExecArray, context: AiContentParserContext) => VNodeChild
}

export interface CreateMarkdownVNodeParserOptions {
  inlineWidgets?: AiContentInlineWidget[]
}

export interface AiContentBlock {
  id: string
  raw: string
  renderContent: string
  stable: boolean
  kind: AiContentBlockKind
}

export type AiChatParsedContent = AiContentParsed

export type AiChatContentParserContext = AiContentParserContext & {
  message: AiChatMessage
}

export type AiChatContentParser = AiContentParser

export type AiChatTraceKind = 'reasoning' | 'search' | 'tool'

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
  phase?: AiChatMessagePhase
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
  setPhase: (phase: AiChatMessagePhase) => void
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

export interface AiChatRootActions {
  send: (prompt: string) => Promise<void>
  stop: () => void
  clear: () => void
}

export interface AiChatMessageActions {
  copy: () => Promise<void>
  retry: () => Promise<AiChatRegeneratePayload | null>
  regenerate: () => Promise<AiChatRegeneratePayload | null>
}

export interface AiChatMessageEditActions {
  start: () => void
  update: (value: string) => void
  save: () => Promise<void>
  cancel: () => void
}

export interface AiChatInputActions {
  updateDraft: (value: string) => void
  send: () => Promise<void>
  stop: () => void
  focus: () => void
}

export interface AiChatRootSlotContext {
  messages: AiChatMessage[]
  active: boolean
  disabled: boolean
  error: AiChatError | null
  showJumpToLatest: boolean
  isNearBottom: boolean
  jumpToLatest: () => void
  actions: AiChatRootActions
}

export interface AiChatMessageSlotContext {
  message: AiChatMessage
  index: number
  parsed: AiChatParsedContent
  phase?: AiChatMessagePhase
  status?: AiChatMessageStatus
  traces: AiChatTrace[]
  sources: AiChatSource[]
  active: boolean
  disabled: boolean
  editing: boolean
  editDraft: string
  canSaveEdit: boolean
  canRetry: boolean
  canRegenerate: boolean
  actions: AiChatMessageActions
  editActions: AiChatMessageEditActions
}

export interface AiChatInputSlotContext {
  draft: string
  canSend: boolean
  active: boolean
  disabled: boolean
  actions: AiChatInputActions
}
