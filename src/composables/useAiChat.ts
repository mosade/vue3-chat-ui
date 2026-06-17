import { computed, ref, unref, watch, type MaybeRef, type Ref } from 'vue'
import type {
  AiChatAdapter,
  AiChatError,
  AiChatMessage,
  AiChatSendContext,
  AiChatTrace
} from '../types'

export interface UseAiChatOptions {
  messages?: MaybeRef<AiChatMessage[] | undefined>
  defaultMessages?: AiChatMessage[]
  adapter?: AiChatAdapter
  onSend?: (context: AiChatSendContext) => Promise<string | void>
  onUpdateMessages?: (messages: AiChatMessage[]) => void
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
  retry: () => Promise<void>
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
  const lastPrompt = ref('')

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

  const stop = () => {
    const request = activeRequest.value
    if (!request) {
      return
    }

    request.controller.abort()
    updateMessage(request.assistantId, { status: 'done' })
    activeRequest.value = null
  }

  const send = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim()
    if (!prompt || activeRequest.value) {
      return
    }

    const sendHandler = options.onSend ?? options.adapter?.send
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
    const controller = new AbortController()

    error.value = null
    lastPrompt.value = prompt
    messages.value = [...messages.value, userMessage, assistantMessage]
    activeRequest.value = {
      controller,
      assistantId: assistantMessage.id
    }

    if (!sendHandler) {
      updateMessage(assistantMessage.id, { status: 'done' })
      activeRequest.value = null
      return
    }

    try {
      const context: AiChatSendContext = {
        prompt,
        messages: messages.value,
        signal: controller.signal,
        append: (chunk) => appendToMessage(assistantMessage.id, chunk),
        update: (message) => updateMessage(assistantMessage.id, message),
        appendTrace: (trace) => appendTraceToMessage(assistantMessage.id, trace),
        updateTrace: (id, trace) => updateTraceInMessage(assistantMessage.id, id, trace)
      }
      const result = await sendHandler(context)

      if (controller.signal.aborted) {
        updateMessage(assistantMessage.id, { status: 'done' })
        return
      }

      if (typeof result === 'string' && result.length > 0) {
        const current = messages.value.find((message) => message.id === assistantMessage.id)
        if (current?.content) {
          appendToMessage(assistantMessage.id, result)
        } else {
          updateMessage(assistantMessage.id, { content: result })
        }
      }

      updateMessage(assistantMessage.id, { status: 'done' })
    } catch (cause) {
      if (controller.signal.aborted || isAbortError(cause)) {
        updateMessage(assistantMessage.id, { status: 'done' })
        return
      }

      const normalized = normalizeError(cause)
      error.value = normalized
      updateMessage(assistantMessage.id, {
        content: normalized.message,
        status: 'error'
      })
      options.onError?.(normalized, { prompt, messages: messages.value })
    } finally {
      if (activeRequest.value?.assistantId === assistantMessage.id) {
        activeRequest.value = null
      }
    }
  }

  const retry = async () => {
    if (!lastPrompt.value || activeRequest.value) {
      return
    }

    await send(lastPrompt.value)
  }

  const clear = () => {
    if (activeRequest.value) {
      activeRequest.value.controller.abort()
      activeRequest.value = null
    }

    error.value = null
    messages.value = []
  }

  return {
    messages,
    isActive,
    error,
    send,
    stop,
    retry,
    clear,
    setMessages
  }
}
