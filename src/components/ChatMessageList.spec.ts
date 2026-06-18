import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ChatMessageList from './ChatMessageList.vue'
import type { AiChatMessage } from '../types'

const messages: AiChatMessage[] = [
  { id: 'u1', role: 'user', content: 'Hello', status: 'done' },
  { id: 'a1', role: 'assistant', content: 'Hi', status: 'done' }
]

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

describe('ChatMessageList', () => {
  it('renders empty and message slots as a standalone list building block', () => {
    const empty = mount(ChatMessageList, {
      props: { messages: [] },
      slots: {
        empty: '<p class="empty-slot">Nothing here</p>'
      }
    })

    expect(empty.find('.empty-slot').text()).toBe('Nothing here')

    const wrapper = mount(ChatMessageList, {
      props: { messages },
      slots: {
        message:
          '<template #message="{ message, index }"><article class="message-slot">{{ index }} {{ message.content }}</article></template>'
      }
    })

    expect(wrapper.findAll('.message-slot').map((item) => item.text())).toEqual([
      '0 Hello',
      '1 Hi'
    ])
  })

  it('allows the whole list body to be replaced with the list slot', () => {
    const wrapper = mount(ChatMessageList, {
      props: { messages },
      slots: {
        list:
          '<template #list="{ messages, showJumpToLatest }"><div class="list-slot">{{ messages.length }} {{ showJumpToLatest }}</div></template>'
      }
    })

    expect(wrapper.find('.list-slot').text()).toBe('2 false')
    expect(wrapper.find('.ai-chat__message').exists()).toBe(false)
  })

  it('auto-scrolls when the user is already near the bottom', async () => {
    const wrapper = mount(ChatMessageList, {
      props: { messages }
    })
    const viewport = wrapper.find('.ai-chat__messages').element

    setScrollMetrics(viewport, {
      scrollTop: 95,
      scrollHeight: 200,
      clientHeight: 100
    })

    await wrapper.setProps({
      messages: [...messages, { id: 'a2', role: 'assistant', content: 'New', status: 'done' }]
    })
    await nextTick()

    expect(viewport.scrollTop).toBe(200)
    expect(wrapper.find('[aria-label="Jump to latest message"]').exists()).toBe(false)
  })

  it('does not auto-scroll when the user is reading older messages', async () => {
    const wrapper = mount(ChatMessageList, {
      props: { messages }
    })
    const viewport = wrapper.find('.ai-chat__messages').element

    setScrollMetrics(viewport, {
      scrollTop: 20,
      scrollHeight: 300,
      clientHeight: 100
    })

    await wrapper.setProps({
      messages: [...messages, { id: 'a2', role: 'assistant', content: 'New', status: 'done' }]
    })
    await nextTick()

    expect(viewport.scrollTop).toBe(20)
    expect(wrapper.find('[aria-label="Jump to latest message"]').exists()).toBe(true)

    await wrapper.find('[aria-label="Jump to latest message"]').trigger('click')

    expect(viewport.scrollTop).toBe(300)
    expect(wrapper.find('[aria-label="Jump to latest message"]').exists()).toBe(false)
  })
})
