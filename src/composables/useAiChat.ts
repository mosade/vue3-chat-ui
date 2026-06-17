import { computed, ref, unref, watch, type MaybeRef, type Ref } from 'vue'
import type {
  AiChatAdapter,
  AiChatError,
  AiChatMessage,
  AiChatRegeneratePayload,
  AiChatSendContext,
  AiChatTrace
} from '../types'

export interface UseAiChatOptions {
  conversationId?: string
  messages?: MaybeRef<AiChatMessage[] | undefined>
  defaultMessages?: AiChatMessage[]
  adapter?: AiChatAdapter
  onSend?: (context: AiChatSendContext) => Promise<string | void>
  onUpdateMessages?: (messages: AiChatMessage[]) => void
  onPersist?: (
    messages: AiChatMessage[],
    context: {
      conversationId?: string
      reason: 'send' | 'stop' | 'regenerate' | 'retry' | 'edit' | 'clear' | 'set'
    }
  ) => void
  onError?: (
    error: AiChatError,
    context: { prompt: string; messages: AiChatMessage[] }
  ) => void
}

export interface UseAiChatReturn {
  messages: Ref<AiChatMessage[]>
  isActive: Ref<boolean>
  error: Ref<AiChatError | null>
  send: (prompt: string) => Promise<void>
  stop: () => void
  regenerate: (messageId: string) => Promise<AiChatRegeneratePayload | null>
  canRegenerate: (message: AiChatMessage) => boolean
  retry: (messageId: string) => Promise<AiChatRegeneratePayload | null>
  canRetry: (message: AiChatMessage) => boolean
  editUserMessage: (
    messageId: string,
    prompt: string
  ) => Promise<{ message: AiChatMessage; prompt: string; messages: AiChatMessage[] } | null>
  clear: () => void
  setMessages: (messages: AiChatMessage[]) => void
}

interface ActiveRequest {
  controller: AbortController
  assistantId: string
}

const createId = () =>
  `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`

const normalizeError = (cause: unknown): AiChatError => {
  if (cause instanceof Error) {
    return { message: cause.message || 'Something went wrong', cause }
  }

  if (typeof cause === 'string') {
    return { message: cause, cause }
  }

  return { message: 'Something went wrong', cause }
}

const isAbortError = (cause: unknown) =>
  cause instanceof DOMException
    ? cause.name === 'AbortError'
    : cause instanceof Error && cause.name === 'AbortError'

export function useAiChat(options: UseAiChatOptions = {}): UseAiChatReturn {
  const internalMessages = ref<AiChatMessage[]>([...(options.defaultMessages ?? [])])
  const activeRequest = ref<ActiveRequest | null>(null)
  const error = ref<AiChatError | null>(null)

  const isControlled = computed(() => Array.isArray(unref(options.messages)))

  watch(
    () => unref(options.messages),
    (nextMessages) => {
      if (Array.isArray(nextMessages)) {
        internalMessages.value = [...nextMessages]
      }
    },
    { immediate: true }
  )

  const messages = computed<AiChatMessage[]>({
    get() {
      return internalMessages.value
    },
    set(nextMessages) {
      const normalized = [...nextMessages]

      internalMessages.value = normalized

      options.onUpdateMessages?.(normalized)
    }
  })

  const isActive = computed(() => activeRequest.value !== null)

  const setMessages = (nextMessages: AiChatMessage[]) => {
    messages.value = nextMessages
    persist('set')
  }

  const persist = (
    reason: 'send' | 'stop' | 'regenerate' | 'retry' | 'edit' | 'clear' | 'set'
  ) => {
    options.onPersist?.([...messages.value], {
      conversationId: options.conversationId,
      reason
    })
  }

  const updateMessage = (id: string, patch: Partial<AiChatMessage>) => {
    messages.value = messages.value.map((message) =>
      message.id === id ? { ...message, ...patch } : message
    )
  }

  const appendToMessage = (id: string, chunk: string) => {
    messages.value = messages.value.map((message) =>
      message.id === id
        ? {
            ...message,
            content: `${message.content}${chunk}`,
            status: 'streaming'
          }
        : message
    )
  }

  const appendTraceToMessage = (
    messageId: string,
    trace: Omit<AiChatTrace, 'id' | 'createdAt'> & Partial<Pick<AiChatTrace, 'id' | 'createdAt'>>
  ) => {
    const nextTrace: AiChatTrace = {
      ...trace,
      id: trace.id ?? createId(),
      createdAt: trace.createdAt ?? Date.now()
    }

    messages.value = messages.value.map((message) =>
      message.id === messageId
        ? {
            ...message,
            traces: [...(message.traces ?? []), nextTrace]
          }
        : message
    )

    return nextTrace.id
  }

  const updateTraceInMessage = (
    messageId: string,
    traceId: string,
    patch: Partial<AiChatTrace>
  ) => {
    messages.value = messages.value.map((message) =>
      message.id === messageId
        ? {
            ...message,
            traces: (message.traces ?? []).map((trace) =>
              trace.id === traceId ? { ...trace, ...patch, id: trace.id } : trace
            )
          }
        : message
    )
  }

  const findPrecedingUserMessage = (messageId: string) => {
    const messageIndex = messages.value.findIndex((message) => message.id === messageId)
    if (messageIndex < 0) {
      return undefined
    }

    return messages.value
      .slice(0, messageIndex)
      .reverse()
      .find((message) => message.role === 'user')
  }

  const canRegenerate = (message: AiChatMessage) =>
    message.role === 'assistant' && !activeRequest.value && Boolean(findPrecedingUserMessage(message.id))

  const canRetry = (message: AiChatMessage) =>
    message.role === 'assistant' &&
    message.status === 'error' &&
    !activeRequest.value &&
    Boolean(findPrecedingUserMessage(message.id))

  const stop = () => {
    const request = activeRequest.value
    if (!request) {
      return
    }

    request.controller.abort()
    updateMessage(request.assistantId, { status: 'stopped' })
    activeRequest.value = null
    persist('stop')
  }

  const runAssistantRequest = async (prompt: string, assistantId: string) => {
    const sendHandler = options.onSend ?? options.adapter?.send
    const controller = new AbortController()

    error.value = null
    activeRequest.value = {
      controller,
      assistantId
    }

    if (!sendHandler) {
      updateMessage(assistantId, { status: 'done' })
      activeRequest.value = null
      return
    }

    try {
      const context: AiChatSendContext = {
        prompt,
        messages: messages.value,
        signal: controller.signal,
        append: (chunk) => appendToMessage(assistantId, chunk),
        update: (message) => updateMessage(assistantId, message),
        appendTrace: (trace) => appendTraceToMessage(assistantId, trace),
        updateTrace: (id, trace) => updateTraceInMessage(assistantId, id, trace)
      }
      const result = await sendHandler(context)

      if (controller.signal.aborted) {
        updateMessage(assistantId, { status: 'stopped' })
        return
      }

      if (typeof result === 'string' && result.length > 0) {
        const current = messages.value.find((message) => message.id === assistantId)
        if (current?.content) {
          appendToMessage(assistantId, result)
        } else {
          updateMessage(assistantId, { content: result })
        }
      }

      updateMessage(assistantId, { status: 'done' })
    } catch (cause) {
      if (controller.signal.aborted || isAbortError(cause)) {
        updateMessage(assistantId, { status: 'stopped' })
        return
      }

      const normalized = normalizeError(cause)
      error.value = normalized
      updateMessage(assistantId, {
        content: normalized.message,
        status: 'error'
      })
      options.onError?.(normalized, { prompt, messages: messages.value })
    } finally {
      if (activeRequest.value?.assistantId === assistantId) {
        activeRequest.value = null
      }
    }
  }

  const send = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim()
    if (!prompt || activeRequest.value) {
      return
    }

    const userMessage: AiChatMessage = {
      id: createId(),
      role: 'user',
      content: prompt,
      status: 'done',
      createdAt: Date.now()
    }
    const assistantMessage: AiChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      status: 'pending',
      createdAt: Date.now()
    }

    messages.value = [...messages.value, userMessage, assistantMessage]
    await runAssistantRequest(prompt, assistantMessage.id)
    persist('send')
  }

  const regenerate = async (messageId: string) => {
    const target = messages.value.find((message) => message.id === messageId)
    if (!target || !canRegenerate(target)) {
      return null
    }

    const userMessage = findPrecedingUserMessage(messageId)
    if (!userMessage) {
      return null
    }

    const targetIndex = messages.value.findIndex((message) => message.id === messageId)
    const originalMessage = { ...target, traces: target.traces ? [...target.traces] : target.traces }
    const promptMessage = {
      ...userMessage,
      traces: userMessage.traces ? [...userMessage.traces] : userMessage.traces
    }

    messages.value = messages.value.slice(0, targetIndex + 1).map((message) =>
      message.id === messageId
        ? {
            ...message,
            content: '',
            status: 'pending',
            traces: []
          }
        : message
    )

    const payload: AiChatRegeneratePayload = {
      message: originalMessage,
      promptMessage,
      messages: messages.value
    }

    await runAssistantRequest(userMessage.content, messageId)
    persist('regenerate')

    return payload
  }

  const retry = async (messageId: string) => {
    const target = messages.value.find((message) => message.id === messageId)
    if (!target || !canRetry(target)) {
      return null
    }

    const userMessage = findPrecedingUserMessage(messageId)
    if (!userMessage) {
      return null
    }

    const targetIndex = messages.value.findIndex((message) => message.id === messageId)
    const originalMessage = { ...target, traces: target.traces ? [...target.traces] : target.traces }
    const promptMessage = {
      ...userMessage,
      traces: userMessage.traces ? [...userMessage.traces] : userMessage.traces
    }

    messages.value = messages.value.slice(0, targetIndex + 1).map((message) =>
      message.id === messageId
        ? {
            ...message,
            content: '',
            status: 'pending',
            traces: []
          }
        : message
    )

    const payload: AiChatRegeneratePayload = {
      message: originalMessage,
      promptMessage,
      messages: messages.value
    }

    await runAssistantRequest(userMessage.content, messageId)
    persist('retry')

    return payload
  }

  const editUserMessage = async (messageId: string, rawPrompt: string) => {
    const prompt = rawPrompt.trim()
    const targetIndex = messages.value.findIndex((message) => message.id === messageId)
    const target = messages.value[targetIndex]

    if (!prompt || activeRequest.value || !target || target.role !== 'user') {
      return null
    }

    const originalMessage = { ...target, traces: target.traces ? [...target.traces] : target.traces }
    const assistantMessage: AiChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      status: 'pending',
      createdAt: Date.now()
    }

    messages.value = [
      ...messages.value.slice(0, targetIndex),
      {
        ...target,
        content: prompt,
        status: 'done'
      },
      assistantMessage
    ]

    const payload = {
      message: originalMessage,
      prompt,
      messages: messages.value
    }

    await runAssistantRequest(prompt, assistantMessage.id)
    persist('edit')

    return payload
  }

  const clear = () => {
    if (activeRequest.value) {
      activeRequest.value.controller.abort()
      activeRequest.value = null
    }

    error.value = null
    messages.value = []
    persist('clear')
  }

  return {
    messages,
    isActive,
    error,
    send,
    stop,
    regenerate,
    canRegenerate,
    retry,
    canRetry,
    editUserMessage,
    clear,
    setMessages
  }
}
