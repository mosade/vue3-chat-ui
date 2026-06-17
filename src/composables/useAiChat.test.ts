import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useAiChat } from './useAiChat'
import type { AiChatMessage, AiChatSendContext } from '../types'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useAiChat', () => {
  it('adds user and assistant messages on send and marks completion done', async () => {
    const chat = useAiChat({
      onSend: async () => 'Hello from the assistant'
    })

    await chat.send('Hello')

    expect(chat.messages.value).toMatchObject([
      { role: 'user', content: 'Hello', status: 'done' },
      { role: 'assistant', content: 'Hello from the assistant', status: 'done' }
    ])
    expect(chat.isActive.value).toBe(false)
  })

  it('appends streamed chunks in order before marking done', async () => {
    const chat = useAiChat({
      onSend: async ({ append }) => {
        append('First ')
        append('second')
      }
    })

    await chat.send('Stream')

    expect(chat.messages.value[1]).toMatchObject({
      role: 'assistant',
      content: 'First second',
      status: 'done'
    })
  })

  it('appends and updates public trace events on the assistant message', async () => {
    const chat = useAiChat({
      onSend: async ({ appendTrace, updateTrace }) => {
        const traceId = appendTrace({
          kind: 'search',
          title: 'Searching docs',
          content: 'Looking through component documentation',
          status: 'pending'
        })

        updateTrace(traceId, {
          content: 'Found the public slot API',
          status: 'done'
        })

        return 'Trace complete'
      }
    })

    await chat.send('Show process')

    expect(chat.messages.value[1]).toMatchObject({
      role: 'assistant',
      content: 'Trace complete',
      traces: [
        {
          kind: 'search',
          title: 'Searching docs',
          content: 'Found the public slot API',
          status: 'done'
        }
      ]
    })
  })

  it('uses onSend before adapter when both are provided', async () => {
    const adapter = { send: vi.fn(async () => 'adapter') }
    const onSend = vi.fn(async () => 'callback')
    const chat = useAiChat({ adapter, onSend })

    await chat.send('Prompt')

    expect(onSend).toHaveBeenCalledOnce()
    expect(adapter.send).not.toHaveBeenCalled()
    expect(chat.messages.value[1].content).toBe('callback')
  })

  it('marks failures as error and emits a normalized error', async () => {
    const onError = vi.fn()
    const chat = useAiChat({
      onSend: async () => {
        throw new Error('Network failed')
      },
      onError
    })

    await chat.send('Will fail')

    expect(chat.messages.value[1]).toMatchObject({
      role: 'assistant',
      status: 'error',
      content: 'Network failed'
    })
    expect(onError).toHaveBeenCalledWith(
      { message: 'Network failed', cause: expect.any(Error) },
      expect.objectContaining({ prompt: 'Will fail' })
    )
  })

  it('aborts an active request without replacing streamed content with an error', async () => {
    let context: AiChatSendContext | undefined
    const chat = useAiChat({
      onSend: async (sendContext) => {
        context = sendContext
        sendContext.append('Partial')
        await new Promise<void>((resolve, reject) => {
          sendContext.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }
    })

    const sending = chat.send('Stop this')
    await nextTick()
    expect(context?.signal.aborted).toBe(false)

    chat.stop()
    await sending

    expect(context?.signal.aborted).toBe(true)
    expect(chat.messages.value[1]).toMatchObject({
      content: 'Partial',
      status: 'done'
    })
    expect(chat.isActive.value).toBe(false)
  })

  it('regenerates an assistant message from its preceding user prompt', async () => {
    const onSend = vi
      .fn<(context: AiChatSendContext) => Promise<string>>()
      .mockResolvedValueOnce('Original answer')
      .mockResolvedValueOnce('Regenerated answer')
    const chat = useAiChat({ onSend })

    await chat.send('Original prompt')
    const assistantId = chat.messages.value[1].id
    const payload = await chat.regenerate(assistantId)

    expect(onSend).toHaveBeenCalledTimes(2)
    expect(onSend.mock.calls[1][0].prompt).toBe('Original prompt')
    expect(payload).toMatchObject({
      message: {
        id: assistantId,
        role: 'assistant',
        content: 'Original answer'
      },
      promptMessage: {
        role: 'user',
        content: 'Original prompt'
      },
      messages: [
        {
          role: 'user',
          content: 'Original prompt'
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          status: 'pending',
          traces: []
        }
      ]
    })
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[1]).toMatchObject({
      id: assistantId,
      role: 'assistant',
      content: 'Regenerated answer',
      status: 'done'
    })
  })

  it('drops messages after the regenerated assistant message', async () => {
    const onSend = vi
      .fn<(context: AiChatSendContext) => Promise<string>>()
      .mockResolvedValueOnce('First answer')
      .mockResolvedValueOnce('Second answer')
      .mockResolvedValueOnce('First regenerated')
    const chat = useAiChat({ onSend })

    await chat.send('First prompt')
    const firstAssistantId = chat.messages.value[1].id
    await chat.send('Second prompt')
    await chat.regenerate(firstAssistantId)

    expect(onSend).toHaveBeenCalledTimes(3)
    expect(onSend.mock.calls[2][0].prompt).toBe('First prompt')
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[1]).toMatchObject({
      id: firstAssistantId,
      role: 'assistant',
      content: 'First regenerated',
      status: 'done'
    })
  })

  it('marks regenerated assistant messages as error when regeneration fails', async () => {
    const onSend = vi
      .fn<(context: AiChatSendContext) => Promise<string>>()
      .mockResolvedValueOnce('Original answer')
      .mockRejectedValueOnce(new Error('Regenerate failed'))
    const onError = vi.fn()
    const chat = useAiChat({ onSend, onError })

    await chat.send('Original prompt')
    const assistantId = chat.messages.value[1].id
    await chat.regenerate(assistantId)

    expect(chat.messages.value[1]).toMatchObject({
      id: assistantId,
      role: 'assistant',
      content: 'Regenerate failed',
      status: 'error'
    })
    expect(onError).toHaveBeenCalledWith(
      { message: 'Regenerate failed', cause: expect.any(Error) },
      expect.objectContaining({ prompt: 'Original prompt' })
    )
  })

  it('retries an errored assistant message from its preceding user prompt', async () => {
    const onSend = vi
      .fn<(context: AiChatSendContext) => Promise<string>>()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce('Recovered answer')
    const chat = useAiChat({ onSend })

    await chat.send('Retry prompt')
    const assistantId = chat.messages.value[1].id

    expect(chat.messages.value[1]).toMatchObject({
      role: 'assistant',
      status: 'error',
      content: 'Temporary failure'
    })
    expect(chat.canRetry(chat.messages.value[1])).toBe(true)

    const payload = await chat.retry(assistantId)

    expect(payload).toMatchObject({
      message: {
        id: assistantId,
        role: 'assistant',
        content: 'Temporary failure',
        status: 'error'
      },
      promptMessage: {
        role: 'user',
        content: 'Retry prompt'
      }
    })
    expect(onSend).toHaveBeenCalledTimes(2)
    expect(onSend.mock.calls[1][0].prompt).toBe('Retry prompt')
    expect(chat.messages.value[1]).toMatchObject({
      id: assistantId,
      role: 'assistant',
      content: 'Recovered answer',
      status: 'done'
    })
  })

  it('edits a user message, drops later messages, and resubmits it', async () => {
    const onSend = vi
      .fn<(context: AiChatSendContext) => Promise<string>>()
      .mockResolvedValueOnce('Original answer')
      .mockResolvedValueOnce('Later answer')
      .mockResolvedValueOnce('Edited answer')
    const chat = useAiChat({ onSend })

    await chat.send('Original prompt')
    const userId = chat.messages.value[0].id
    await chat.send('Later prompt')

    const payload = await chat.editUserMessage(userId, 'Edited prompt')

    expect(payload).toMatchObject({
      message: {
        id: userId,
        role: 'user',
        content: 'Original prompt'
      },
      prompt: 'Edited prompt'
    })
    expect(onSend).toHaveBeenCalledTimes(3)
    expect(onSend.mock.calls[2][0].prompt).toBe('Edited prompt')
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0]).toMatchObject({
      id: userId,
      role: 'user',
      content: 'Edited prompt',
      status: 'done'
    })
    expect(chat.messages.value[1]).toMatchObject({
      role: 'assistant',
      content: 'Edited answer',
      status: 'done'
    })
  })

  it('does not regenerate non-assistant messages or messages without a preceding user prompt', async () => {
    const onSend = vi.fn<(context: AiChatSendContext) => Promise<string>>()
    const chat = useAiChat({
      defaultMessages: [
        { id: 'system-1', role: 'system', content: 'Start' },
        { id: 'assistant-1', role: 'assistant', content: 'No prompt' },
        { id: 'user-1', role: 'user', content: 'Hello' }
      ],
      onSend
    })

    expect(chat.canRegenerate(chat.messages.value[0])).toBe(false)
    expect(chat.canRegenerate(chat.messages.value[1])).toBe(false)
    expect(chat.canRegenerate(chat.messages.value[2])).toBe(false)

    await chat.regenerate('system-1')
    await chat.regenerate('assistant-1')
    await chat.regenerate('user-1')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('clears messages and aborts an active request', async () => {
    let signal: AbortSignal | undefined
    const chat = useAiChat({
      defaultMessages: [{ id: 'm1', role: 'system', content: 'Start' }],
      onSend: async (context) => {
        signal = context.signal
        await new Promise<void>((resolve, reject) => {
          context.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }
    })

    const sending = chat.send('Active')
    await nextTick()

    chat.clear()
    await flushPromises()

    expect(signal?.aborted).toBe(true)
    expect(chat.messages.value).toEqual([])
    await sending
  })

  it('emits updates in controlled mode without mutating the input ref', async () => {
    const controlled = ref<AiChatMessage[]>([])
    const onUpdate = vi.fn((nextMessages: AiChatMessage[]) => {
      controlled.value = nextMessages
    })
    const chat = useAiChat({
      messages: controlled,
      onUpdateMessages: onUpdate,
      onSend: async () => 'Controlled response'
    })

    await chat.send('Controlled prompt')

    expect(onUpdate).toHaveBeenCalled()
    expect(controlled.value).toHaveLength(2)
    expect(chat.messages.value[1]).toMatchObject({
      role: 'assistant',
      content: 'Controlled response'
    })
  })

  it('persists message changes with the conversation id', async () => {
    const onPersist = vi.fn()
    const chat = useAiChat({
      conversationId: 'conversation-1',
      onPersist,
      onSend: async () => 'Persisted response'
    })

    await chat.send('Persist this')

    expect(onPersist).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Persist this' }),
        expect.objectContaining({ role: 'assistant', content: 'Persisted response' })
      ]),
      expect.objectContaining({
        conversationId: 'conversation-1',
        reason: 'send'
      })
    )

    chat.clear()

    expect(onPersist).toHaveBeenLastCalledWith([], {
      conversationId: 'conversation-1',
      reason: 'clear'
    })
  })
})
