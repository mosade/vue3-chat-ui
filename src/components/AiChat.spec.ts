import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AiChat from './AiChat.vue'
import AiContent from './AiContent.vue'
import type { AiChatMessage } from '../types'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))
const mockScrollAnimation = () => {
  vi.useFakeTimers()
  let rafTime = performance.now()

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => {
      rafTime += 16
      callback(rafTime)
    }, 16)
  )
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    window.clearTimeout(handle)
  })
}

const setScrollMetrics = (
  element: Element,
  metrics: { scrollTop: number; scrollHeight: number; clientHeight: number }
) => {
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value: metrics.scrollTop
  })
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: metrics.scrollHeight
  })
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: metrics.clientHeight
  })
}

describe('AiChat', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders the default empty state and default message fallback', () => {
    const empty = mount(AiChat)

    expect(empty.text()).toContain('Start a conversation')

    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'u1', role: 'user', content: 'Hello', status: 'done' },
          { id: 'a1', role: 'assistant', content: 'Hi there', status: 'done' }
        ]
      }
    })

    expect(wrapper.find('.ai-chat__message--user').text()).toContain('Hello')
    expect(wrapper.find('.ai-chat__message--assistant').text()).toContain('Hi there')
  })

  it('distributes root state and actions through slots', async () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'a1', role: 'assistant', content: 'Hello', status: 'done' }
        ]
      },
      slots: {
        header:
          '<template #header="{ messages, active, actions }"><button class="clear" @click="actions.clear()">Clear {{ messages.length }} {{ active }}</button></template>',
        empty:
          '<template #empty="{ messages, active, disabled, actions }"><button class="empty-send" :disabled="disabled || active" @click="actions.send(\'Hello\')">Empty {{ messages.length }}</button></template>',
        input:
          '<template #input="{ draft, canSend, actions }"><input aria-label="Slot input" :value="draft" @input="actions.updateDraft($event.target.value)" /><button class="send" :disabled="!canSend" @click="actions.send()">Send</button></template>'
      }
    })

    expect(wrapper.find('.clear').text()).toContain('1')
    await wrapper.find('.clear').trigger('click')
    expect(wrapper.find('.empty-send').text()).toContain('Empty 0')
  })

  it('renders the single message slot with parsed content and actions', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'u1', role: 'user', content: 'User text', status: 'done' },
          { id: 'a1', role: 'assistant', content: 'Assistant text', status: 'done' }
        ]
      },
      slots: {
        message:
          '<template #message="{ message, parsed }"><p :class="`message-card message-card--${message.role}`">{{ message.id }} {{ parsed.content }}</p></template>'
      }
    })

    expect(wrapper.find('.message-card--user').text()).toContain('u1 User text')
    expect(wrapper.find('.message-card--assistant').text()).toContain('a1 Assistant text')
  })

  it('collects and renders the message slot at the AiChat root instead of forwarding it through child components', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'u1', role: 'user', content: 'Root user', status: 'done' },
          { id: 'a1', role: 'assistant', content: 'Root assistant', status: 'done' }
        ]
      },
      slots: {
        message:
          '<template #message="{ message }"><article :class="`root-message root-message--${message.role}`">{{ message.content }}</article></template>'
      },
      global: {
        stubs: {
          ChatMessageList: {
            props: ['messages'],
            template: '<section class="stub-list"><slot /></section>'
          },
          ChatMessage: {
            template: '<article class="stub-message">fallback</article>'
          }
        }
      }
    })

    expect(wrapper.find('.root-message--user').text()).toBe('Root user')
    expect(wrapper.find('.root-message--assistant').text()).toBe('Root assistant')
    expect(wrapper.find('.stub-message').exists()).toBe(false)
  })

  it('uses the parser prop before rendering message slots', () => {
    const wrapper = mount(AiChat, {
      props: {
        parser: {
          parse: (content: string) => ({ type: 'html' as const, content: `<strong>${content}</strong>` })
        },
        defaultMessages: [
          { id: 'a1', role: 'assistant', content: 'Parsed', status: 'done' }
        ]
      },
      slots: {
        message:
          '<template #message="{ parsed }"><div class="parsed" v-html="parsed.content" /></template>'
      }
    })

    expect(wrapper.find('.parsed strong').text()).toBe('Parsed')
  })

  it('passes contentParser to the default message renderer', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'a1', role: 'assistant', content: 'Hello', status: 'done' }
        ],
        contentParser: {
          parse: (content: string) => ({
            type: 'html',
            content: `<strong>${content}</strong>`
          })
        }
      }
    })

    expect(wrapper.find('.ai-content strong').text()).toBe('Hello')
  })

  it('keeps parser as a legacy alias for contentParser', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'a1', role: 'assistant', content: 'Legacy', status: 'done' }
        ],
        parser: {
          parse: (content: string) => ({
            type: 'html',
            content: `<em>${content}</em>`
          })
        }
      }
    })

    expect(wrapper.find('.ai-content em').text()).toBe('Legacy')
  })

  it('allows custom message slots to use AiContent directly', () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'a1', role: 'assistant', content: 'Slot content', status: 'streaming' }
        ]
      },
      slots: {
        message:
          `<template #message="{ message }"><AiContent class="slot-content" :content="message.content" :streaming="message.status === 'streaming'" /></template>`
      },
      global: {
        components: {
          AiContent
        }
      }
    })

    expect(wrapper.find('.slot-content').text()).toContain('Slot content')
  })

  it('exposes edit state and edit actions through the message slot', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce('Original answer')
      .mockResolvedValueOnce('Edited answer')
    const wrapper = mount(AiChat, {
      props: {
        adapter: { send }
      },
      slots: {
        message:
          '<template #message="{ message, editing, editDraft, canSaveEdit, editActions }"><div><p>{{ message.content }}</p><input v-if="editing" aria-label="Edit draft" :value="editDraft" @input="editActions.update($event.target.value)" /><button v-if="message.role === \'user\' && !editing" class="edit" @click="editActions.start()">Edit</button><button v-if="editing" class="save" :disabled="!canSaveEdit" @click="editActions.save()">Save</button></div></template>',
        input:
          '<template #input="{ actions }"><button class="send" @click="actions.updateDraft(\'Original prompt\'); actions.send()">Send</button></template>'
      }
    })

    await wrapper.find('.send').trigger('click')
    await flushPromises()
    await wrapper.find('.edit').trigger('click')
    await wrapper.find('[aria-label="Edit draft"]').setValue('Edited prompt')
    await wrapper.find('.save').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0].prompt).toBe('Edited prompt')
    expect(wrapper.text()).toContain('Edited answer')
  })

  it('exposes top-level scroll state and jump action to root slots', async () => {
    const wrapper = mount(AiChat, {
      props: {
        defaultMessages: [
          { id: 'a1', role: 'assistant', content: 'One', status: 'done' }
        ]
      },
      slots: {
        header:
          '<template #header="{ showJumpToLatest, isNearBottom, jumpToLatest }"><button class="jump" @click="jumpToLatest()">{{ showJumpToLatest }} {{ isNearBottom }}</button></template>'
      }
    })

    expect(wrapper.find('.jump').exists()).toBe(true)
  })

  it('auto-scrolls streamed content while the user is near the bottom', async () => {
    mockScrollAnimation()
    const wrapper = mount(AiChat, {
      props: {
        messages: [
          { id: 'u1', role: 'user', content: 'Prompt', status: 'done' },
          { id: 'a1', role: 'assistant', content: 'Partial', status: 'streaming' }
        ]
      }
    })
    const viewport = wrapper.find('.ai-chat__messages').element

    setScrollMetrics(viewport, {
      scrollTop: 96,
      scrollHeight: 200,
      clientHeight: 100
    })

    await wrapper.setProps({
      messages: [
        { id: 'u1', role: 'user', content: 'Prompt', status: 'done' },
        {
          id: 'a1',
          role: 'assistant',
          content: 'Partial response keeps growing',
          status: 'streaming'
        }
      ]
    })
    await nextTick()
    await vi.runAllTimersAsync()

    expect(viewport.scrollTop).toBe(200)
    expect(wrapper.find('.jump').exists()).toBe(false)
  })

  it('does not auto-scroll streamed content when the user is reading older messages', async () => {
    mockScrollAnimation()
    const wrapper = mount(AiChat, {
      props: {
        messages: [
          { id: 'u1', role: 'user', content: 'Prompt', status: 'done' },
          { id: 'a1', role: 'assistant', content: 'Partial', status: 'streaming' }
        ]
      },
      slots: {
        header:
          '<template #header="{ showJumpToLatest, jumpToLatest }"><button v-if="showJumpToLatest" class="jump" @click="jumpToLatest()">Latest</button></template>'
      }
    })
    const viewport = wrapper.find('.ai-chat__messages').element

    setScrollMetrics(viewport, {
      scrollTop: 20,
      scrollHeight: 300,
      clientHeight: 100
    })

    await wrapper.setProps({
      messages: [
        { id: 'u1', role: 'user', content: 'Prompt', status: 'done' },
        {
          id: 'a1',
          role: 'assistant',
          content: 'Partial response keeps growing',
          status: 'streaming'
        }
      ]
    })
    await nextTick()

    expect(viewport.scrollTop).toBe(20)
    expect(wrapper.find('.jump').exists()).toBe(true)

    await wrapper.find('.jump').trigger('click')
    await vi.runAllTimersAsync()

    expect(viewport.scrollTop).toBe(300)
    expect(wrapper.find('.jump').exists()).toBe(false)
  })

  it('submits default composer input and supports controlled input', async () => {
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
    await textarea.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Changed prompt' })
    )
    expect(wrapper.emitted('send')?.[0]).toEqual(['Changed prompt'])
    expect(wrapper.emitted('update:input')?.at(-1)).toEqual([''])
    expect(wrapper.text()).toContain('Answer')
  })

  it('emits update:messages, stop, clear, error, and regenerate events from slot actions', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce('Original answer')
      .mockResolvedValueOnce('Regenerated answer')
    const wrapper = mount(AiChat, {
      props: { adapter: { send } },
      slots: {
        header:
          '<template #header="{ actions }"><button class="clear" @click="actions.clear()">Clear</button></template>',
        message:
          '<template #message="{ message, canRegenerate, actions }"><div><p>{{ message.content }}</p><button v-if="message.content" class="copy" @click="actions.copy()">Copy</button><button v-if="canRegenerate" class="regenerate" @click="actions.regenerate()">Again</button></div></template>',
        input:
          '<template #input="{ actions }"><button class="send" @click="actions.updateDraft(\'Prompt\'); actions.send()">Send</button></template>'
      }
    })

    await wrapper.find('.send').trigger('click')
    await flushPromises()
    await wrapper.find('.copy').trigger('click')
    await wrapper.find('.regenerate').trigger('click')
    await flushPromises()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Prompt')
    expect(send).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Regenerated answer')
    expect(wrapper.emitted('update:messages')).toBeTruthy()
    expect(wrapper.emitted('regenerate')?.[0][0]).toMatchObject({
      promptMessage: { role: 'user', content: 'Prompt' }
    })

    await wrapper.find('.clear').trigger('click')
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
    await wrapper.find('.send').trigger('click')
    await nextTick()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    await wrapper.vm.$emit('stop')
    holdRequest?.()
  })

  it('emits errors from failed requests', async () => {
    const wrapper = mount(AiChat, {
      props: {
        adapter: {
          send: async () => {
            throw new Error('No connection')
          }
        }
      },
      slots: {
        input:
          '<template #input="{ actions }"><button class="send" @click="actions.updateDraft(\'Fail\'); actions.send()">Send</button></template>'
      }
    })

    await wrapper.find('.send').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('error')?.[0][0]).toMatchObject({ message: 'No connection' })
  })
})
