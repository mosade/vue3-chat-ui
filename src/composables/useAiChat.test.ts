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

  it('retries the latest failed prompt', async () => {
    const onSend = vi
      .fn<(context: AiChatSendContext) => Promise<string>>()
      .mockRejectedValueOnce(new Error('Try again'))
      .mockResolvedValueOnce('Recovered')
    const chat = useAiChat({ onSend })

    await chat.send('Original prompt')
    await chat.retry()

    expect(onSend).toHaveBeenCalledTimes(2)
    expect(chat.messages.value[chat.messages.value.length - 2]).toMatchObject({
      role: 'user',
      content: 'Original prompt'
    })
    expect(chat.messages.value[chat.messages.value.length - 1]).toMatchObject({
      role: 'assistant',
      content: 'Recovered',
      status: 'done'
    })
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
})
