import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AiChat from './AiChat.vue'
import type { AiChatMessage } from '../types'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('AiChat', () => {
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

  it('emits update:messages, stop, retry, clear, and error events', async () => {
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

    await wrapper.find('[aria-label="Retry last prompt"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('retry')).toBeTruthy()

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
})
