import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AiChat from './AiChat.vue'
import type { AiChatMessage, AiChatRegeneratePayload } from '../types'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('AiChat', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    })
  })

  it('renders the empty state', () => {
    const wrapper = mount(AiChat)

    expect(wrapper.text()).toContain('Start a conversation')
  })

  it('renders user and assistant messages', () => {
    const messages: AiChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Hello', status: 'done' },
      { id: 'a1', role: 'assistant', content: 'Hi there', status: 'done' }
    ]

    const wrapper = mount(AiChat, {
      props: { defaultMessages: messages }
    })

    expect(wrapper.find('.ai-chat__message--user').text()).toContain('Hello')
    expect(wrapper.find('.ai-chat__message--assistant').text()).toContain('Hi there')
  })

  it('renders message content as safe plain text by default', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          {
            id: 'a1',
            role: 'assistant',
            content: '**Bold** <img src=x onerror=alert(1)>',
            status: 'done'
          }
        ]
      }
    })

    const content = wrapper.find('.ai-chat__message-content')

    expect(content.html()).toContain('**Bold**')
    expect(content.find('strong').exists()).toBe(false)
    expect(content.find('img').exists()).toBe(false)
  })

  it('renders basic markdown when markdown is enabled and escapes unsafe html', () => {
    const wrapper = mount(AiChat, {
      props: {
        markdown: true,
        defaultMessages: [
          {
            id: 'a1',
            role: 'assistant',
            content:
              '**Bold** and `code`\n[Vue](https://vuejs.org) <img src=x onerror=alert(1)>',
            status: 'done'
          }
        ]
      }
    })

    const content = wrapper.find('.ai-chat__message-content')

    expect(content.find('strong').text()).toBe('Bold')
    expect(content.find('code').text()).toBe('code')
    expect(content.find('a').attributes('href')).toBe('https://vuejs.org')
    expect(content.find('br').exists()).toBe(true)
    expect(content.find('img').exists()).toBe(false)
    expect(content.html()).toContain('&lt;img')
  })

  it('uses custom markdown renderer output when markdown is a function', () => {
    const wrapper = mount(AiChat, {
      props: {
        markdown: (content: string, message: AiChatMessage) =>
          `<p data-message="${message.id}">${content.toUpperCase()}</p>`,
        defaultMessages: [
          {
            id: 'a1',
            role: 'assistant',
            content: 'custom renderer',
            status: 'done'
          }
        ]
      }
    })

    const paragraph = wrapper.find('.ai-chat__message-content p')

    expect(paragraph.attributes('data-message')).toBe('a1')
    expect(paragraph.text()).toBe('CUSTOM RENDERER')
  })

  it('renders public reasoning and search traces for assistant messages', () => {
    const messages: AiChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'Answer',
        status: 'done',
        traces: [
          {
            id: 't1',
            kind: 'reasoning',
            title: 'Thinking',
            content: 'Planning a concise answer',
            status: 'done'
          },
          {
            id: 't2',
            kind: 'search',
            title: 'Searching data',
            content: 'Checked component docs',
            status: 'done',
            items: ['README.md', 'src/types.ts']
          }
        ]
      }
    ]

    const wrapper = mount(AiChat, {
      props: { defaultMessages: messages }
    })

    expect(wrapper.find('.ai-chat__traces').exists()).toBe(true)
    expect(wrapper.find('.ai-chat__traces').element.compareDocumentPosition(
      wrapper.find('.ai-chat__message-content').element
    )).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(wrapper.find('.ai-chat__traces').attributes('open')).toBeUndefined()
    expect(wrapper.text()).toContain('Thinking')
    expect(wrapper.text()).toContain('Planning a concise answer')
    expect(wrapper.text()).toContain('Searching data')
    expect(wrapper.text()).toContain('README.md')
  })

  it('renders citations from assistant message sources', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          {
            id: 'a1',
            role: 'assistant',
            content: 'Answer with sources',
            status: 'done',
            sources: [
              {
                id: 's1',
                title: 'Vue Documentation',
                url: 'https://vuejs.org',
                snippet: 'Vue is a JavaScript framework.'
              }
            ]
          }
        ]
      }
    })

    const source = wrapper.find('.ai-chat__source')

    expect(wrapper.find('.ai-chat__sources').exists()).toBe(true)
    expect(source.text()).toContain('Vue Documentation')
    expect(source.text()).toContain('Vue is a JavaScript framework.')
    expect(source.find('a').attributes('href')).toBe('https://vuejs.org')
  })

  it('expands trace details while traces are pending or errored', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          {
            id: 'a1',
            role: 'assistant',
            content: 'Answer',
            traces: [
              {
                id: 'pending-trace',
                kind: 'reasoning',
                title: 'Thinking',
                status: 'pending'
              }
            ]
          },
          {
            id: 'a2',
            role: 'assistant',
            content: 'Another answer',
            traces: [
              {
                id: 'error-trace',
                kind: 'search',
                title: 'Search failed',
                status: 'error'
              }
            ]
          }
        ]
      }
    })

    const traces = wrapper.findAll('.ai-chat__traces')

    expect(traces).toHaveLength(2)
    expect(traces[0].attributes('open')).toBeDefined()
    expect(traces[1].attributes('open')).toBeDefined()
    expect(wrapper.text()).toContain('Working...')
    expect(wrapper.text()).toContain('Process needs attention')
  })

  it('submits composer input with Enter', async () => {
    const send = vi.fn(async () => 'Answer')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } }
    })
    const textarea = wrapper.find('textarea')

    await textarea.setValue('What is Vue?')
    await textarea.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'What is Vue?' })
    )
    expect(wrapper.emitted('send')?.[0]).toEqual(['What is Vue?'])
    expect(wrapper.text()).toContain('Answer')
  })

  it('inserts newline with Shift+Enter', async () => {
    const send = vi.fn(async () => 'Answer')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } }
    })
    const textarea = wrapper.find('textarea')

    await textarea.setValue('Line one')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })

    expect(send).not.toHaveBeenCalled()
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Line one')
  })

  it('supports controlled composer input', async () => {
    const send = vi.fn(async () => 'Answer')
    const wrapper = mount(AiChat, {
      props: {
        input: 'Prefilled prompt',
        adapter: { send },
        'onUpdate:input': (value: string) => wrapper.setProps({ input: value })
      }
    })

    const textarea = wrapper.find('textarea')

    expect((textarea.element as HTMLTextAreaElement).value).toBe('Prefilled prompt')

    await textarea.setValue('Changed prompt')

    expect(wrapper.emitted('update:input')?.[0]).toEqual(['Changed prompt'])

    await textarea.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Changed prompt' })
    )
    expect(wrapper.emitted('update:input')?.at(-1)).toEqual([''])
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('exposes composer draft and actions to composer slots', async () => {
    const send = vi.fn(async () => 'Slot answer')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } },
      slots: {
        'composer-actions':
          '<template #composer-actions="{ draft, canSubmit, actions }"><button class="slot-submit" type="button" :disabled="!canSubmit" @click="actions.submit()">Send {{ draft }}</button></template>'
      }
    })

    await wrapper.find('textarea').setValue('Slot prompt')
    await wrapper.find('.slot-submit').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Slot prompt' })
    )
  })

  it('disables controls while disabled', () => {
    const wrapper = mount(AiChat, {
      props: { disabled: true }
    })

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-label="Send message"]').attributes('disabled')).toBeDefined()
  })

  it('disables composer input while a request is active', async () => {
    const wrapper = mount(AiChat, {
      props: {
        adapter: {
          send: () => new Promise(() => undefined)
        }
      }
    })

    await wrapper.find('textarea').setValue('Hold open')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-label="Stop response"]').exists()).toBe(true)
  })

  it('marks a stopped response distinctly from a completed response', async () => {
    const wrapper = mount(AiChat, {
      props: {
        adapter: {
          send: ({ append, signal }) => {
            append('Partial answer')
            return new Promise<void>((resolve, reject) => {
              signal.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'))
              })
            })
          }
        }
      }
    })

    await wrapper.find('textarea').setValue('Stop please')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await wrapper.find('[aria-label="Stop response"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ai-chat__message--stopped').exists()).toBe(true)
    expect(wrapper.text()).toContain('Stopped')
  })

  it('does not show stop controls for external loading alone', () => {
    const wrapper = mount(AiChat, {
      props: { loading: true }
    })

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-label="Stop response"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Send message"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Send message"]').attributes('disabled')).toBeDefined()
  })

  it('emits update:messages, stop, clear, and error events', async () => {
    const send = vi.fn(async () => {
      throw new Error('No connection')
    })
    const wrapper = mount(AiChat, {
      props: { adapter: { send } }
    })

    await wrapper.find('textarea').setValue('Fail')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.emitted('update:messages')).toBeTruthy()
    expect(wrapper.emitted('error')?.[0][0]).toMatchObject({ message: 'No connection' })

    await wrapper.find('[aria-label="Clear messages"]').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()

    let holdRequest: ((value: void) => void) | undefined
    await wrapper.setProps({
      adapter: {
        send: vi.fn(
          () =>
          new Promise<void>((resolve) => {
            holdRequest = resolve
          })
        )
      }
    })
    await wrapper.find('textarea').setValue('Hold')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await wrapper.find('[aria-label="Stop response"]').trigger('click')
    holdRequest?.()
    await flushPromises()

    expect(wrapper.emitted('stop')).toBeTruthy()
  })

  it('regenerates an assistant message from its message action', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce('Original answer')
      .mockResolvedValueOnce('Follow-up answer')
      .mockResolvedValueOnce('Regenerated answer')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } }
    })

    await wrapper.find('textarea').setValue('Regenerate this')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await wrapper.find('textarea').setValue('Follow-up prompt')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const regenerateButton = wrapper.findAll('[aria-label="Regenerate response"]')[0]
    expect(regenerateButton.exists()).toBe(true)

    await regenerateButton.trigger('click')
    await flushPromises()

    const payload = wrapper.emitted('regenerate')?.[0][0] as AiChatRegeneratePayload
    expect(payload).toMatchObject({
      message: {
        role: 'assistant',
        content: 'Original answer'
      },
      promptMessage: {
        role: 'user',
        content: 'Regenerate this'
      },
      messages: [
        {
          role: 'user',
          content: 'Regenerate this'
        },
        {
          role: 'assistant',
          content: '',
          status: 'pending',
          traces: []
        }
      ]
    })
    expect(payload.messages).toHaveLength(2)
    expect(send).toHaveBeenCalledTimes(3)
    expect(send.mock.calls[2][0].prompt).toBe('Regenerate this')
    expect(wrapper.text()).toContain('Regenerated answer')
    expect(wrapper.text()).not.toContain('Original answer')
    expect(wrapper.text()).not.toContain('Follow-up answer')
  })

  it('exposes regenerate actions to message action slots', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce('Original answer')
      .mockResolvedValueOnce('Slot regenerated')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } },
      slots: {
        'message-actions':
          '<template #message-actions="{ canRegenerate, actions }"><button v-if="canRegenerate" class="slot-regenerate" @click="actions.regenerate()">Again</button></template>'
      }
    })

    await wrapper.find('textarea').setValue('Use slot')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await wrapper.find('.slot-regenerate').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Slot regenerated')
  })

  it('copies message content from the default message action', async () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [{ id: 'a1', role: 'assistant', content: 'Copy this', status: 'done' }]
      }
    })

    await wrapper.find('[aria-label="Copy message"]').trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy this')
  })

  it('retries an errored assistant response from its default message action', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('Retry answer')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } }
    })

    await wrapper.find('textarea').setValue('Retry in UI')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await wrapper.find('[aria-label="Retry response"]').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0].prompt).toBe('Retry in UI')
    expect(wrapper.text()).toContain('Retry answer')
    expect(wrapper.text()).not.toContain('First failure')
  })

  it('edits a user message from the default action and resubmits it', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce('Original answer')
      .mockResolvedValueOnce('Edited answer')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } }
    })

    await wrapper.find('textarea').setValue('Original prompt')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await wrapper.find('[aria-label="Edit message"]').trigger('click')
    const editInput = wrapper.find('[aria-label="Edit message content"]')
    await editInput.setValue('Edited prompt')
    await wrapper.find('[aria-label="Save edited message"]').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0].prompt).toBe('Edited prompt')
    expect(wrapper.text()).toContain('Edited prompt')
    expect(wrapper.text()).toContain('Edited answer')
    expect(wrapper.text()).not.toContain('Original answer')
  })

  it('supports sendHandler as the request callback while still emitting send events', async () => {
    const sendHandler = vi.fn(async () => 'Answer from handler')
    const wrapper = mount(AiChat, {
      props: { sendHandler }
    })

    await wrapper.find('textarea').setValue('Use handler')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(sendHandler).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Use handler' })
    )
    expect(wrapper.emitted('send')?.[0]).toEqual(['Use handler'])
    expect(wrapper.text()).toContain('Answer from handler')
  })

  it('does not treat onSend as a request callback prop', async () => {
    const onSend = vi.fn(async () => 'Unexpected callback')
    const wrapper = mount(AiChat, {
      props: { onSend }
    })

    await wrapper.find('textarea').setValue('Event only')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(onSend).toHaveBeenCalledWith('Event only')
    expect(wrapper.text()).not.toContain('Unexpected callback')
  })

  it('renders customization slots', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [{ id: 'a1', role: 'assistant', content: 'Slot text' }]
      },
      slots: {
        header: '<h2>Custom header</h2>',
        empty: '<p>Custom empty</p>',
        avatar: '<template #avatar="{ message }"><span class="avatar-slot">{{ message.role }}</span></template>',
        'message-content':
          '<template #message-content="{ message }"><strong class="content-slot">{{ message.content }}</strong></template>',
        'message-actions':
          '<template #message-actions="{ message }"><button class="action-slot">{{ message.id }}</button></template>',
        'composer-prefix': '<span class="prefix-slot">Prefix</span>',
        'composer-actions': '<button class="composer-action-slot">Extra</button>',
        footer: '<p>Custom footer</p>'
      }
    })

    expect(wrapper.text()).toContain('Custom header')
    expect(wrapper.find('.avatar-slot').text()).toBe('assistant')
    expect(wrapper.find('.content-slot').text()).toBe('Slot text')
    expect(wrapper.find('.action-slot').text()).toBe('a1')
    expect(wrapper.find('.prefix-slot').exists()).toBe(true)
    expect(wrapper.find('.composer-action-slot').exists()).toBe(true)
    expect(wrapper.text()).toContain('Custom footer')
  })

  it('renders custom trace slots', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          {
            id: 'a1',
            role: 'assistant',
            content: 'Slot trace text',
            traces: [
              {
                id: 'trace-1',
                kind: 'tool',
                title: 'Tool call',
                content: 'Reading data',
                status: 'done'
              }
            ]
          }
        ]
      },
      slots: {
        'message-trace':
          '<template #message-trace="{ trace }"><span class="trace-slot">{{ trace.kind }}: {{ trace.title }}</span></template>'
      }
    })

    expect(wrapper.find('.trace-slot').text()).toBe('tool: Tool call')
  })
})
