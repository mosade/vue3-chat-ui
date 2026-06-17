import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import App from './App.vue'

describe('demo App', () => {
  it('switches to the shadcn-style demo variant', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Reusable AI chat component')

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

    expect(wrapper.text()).toContain('shadcn-style workspace')
    expect(wrapper.find('.shadcn-demo .ai-chat').exists()).toBe(true)
  })

  it('does not show process traces before the user sends a message', () => {
    const wrapper = mount(App)

    expect(wrapper.text()).not.toContain('Loaded the local demo adapter')
    expect(wrapper.find('.ai-chat__traces').exists()).toBe(false)
  })

  it('shows immediate process feedback after sending a message', async () => {
    const wrapper = mount(App)

    await wrapper.find('textarea').setValue('Need process feedback')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(wrapper.text()).toContain('Need process feedback')
    expect(wrapper.text()).toContain('Thinking summary')
    expect(wrapper.find('.ai-chat__traces').exists()).toBe(true)
  })

  it('showcases newly added chat features', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Newly showcased features')
    expect(wrapper.text()).toContain('Markdown rendering')
    expect(wrapper.find('.ai-chat__sources').exists()).toBe(true)
    expect(wrapper.text()).toContain('Vue API Reference')
    expect(wrapper.text()).toContain('Persist events')

    await wrapper.find('[data-demo-prefill]').trigger('click')

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain(
      'Summarize the new AiChat features'
    )
  })
})
