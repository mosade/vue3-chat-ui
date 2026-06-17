import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('demo App', () => {
  it('switches to the shadcn-style demo variant', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Reusable AI chat component')

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

    expect(wrapper.text()).toContain('shadcn-style workspace')
    expect(wrapper.find('.shadcn-demo .ai-chat').exists()).toBe(true)
  })
})
