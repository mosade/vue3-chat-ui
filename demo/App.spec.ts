import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from './App.vue'

describe('demo App', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    })
  })

  it('switches to the shadcn-style demo variant', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Headless AI chat component')

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

    expect(wrapper.text()).toContain('shadcn-style workspace')
    expect(wrapper.find('.shadcn-demo .ai-chat').exists()).toBe(true)
  })

  it('renders custom shadcn message action UI', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

    expect(wrapper.find('.shadcn-message-actions').exists()).toBe(true)
    expect(wrapper.find('[data-shadcn-action="copy"]').exists()).toBe(true)
    expect(wrapper.find('[data-shadcn-action="edit"]').exists()).toBe(true)
    expect(wrapper.find('[data-shadcn-action="regenerate"]').exists()).toBe(true)
  })

  it('renders a custom shadcn edit form', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
    await wrapper.find('[data-shadcn-action="edit"]').trigger('click')

    expect(wrapper.find('.shadcn-edit-form').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Shadcn edit message"]').exists()).toBe(true)
    expect(wrapper.find('[data-shadcn-edit="save"]').exists()).toBe(true)
  })

  it('renders a custom shadcn retry action for errored responses', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
    await wrapper.find('.shadcn-demo__actions .shadcn-demo__button').trigger('click')
    await wrapper.find('textarea').setValue('Make this fail')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await new Promise((resolve) => setTimeout(resolve, 280))

    expect(wrapper.find('[data-shadcn-action="retry"]').exists()).toBe(true)
  })

  it('does not show process traces before the user sends a message', () => {
    const wrapper = mount(App)

    expect(wrapper.text()).not.toContain('Loaded the local demo adapter')
    expect(wrapper.find('.demo-traces').exists()).toBe(false)
  })

  it('shows immediate process feedback after sending a message', async () => {
    const wrapper = mount(App)

    await wrapper.find('textarea').setValue('Need process feedback')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(wrapper.text()).toContain('Need process feedback')
    expect(wrapper.text()).toContain('Thinking summary')
    expect(wrapper.find('.demo-traces').exists()).toBe(true)
  })

  it('showcases newly added chat features', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Five top-level slots')
    expect(wrapper.text()).toContain('Markdown rendering')
    expect(wrapper.find('.demo-sources').exists()).toBe(true)
    expect(wrapper.text()).toContain('Vue API Reference')
    expect(wrapper.text()).toContain('Persist events')

    await wrapper.find('[data-demo-prefill]').trigger('click')

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain(
      'Summarize the new AiChat headless API'
    )
  })
})
