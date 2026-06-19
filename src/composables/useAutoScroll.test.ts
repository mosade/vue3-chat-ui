import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useAutoScroll } from './useAutoScroll'

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

describe('useAutoScroll', () => {
  it('follows updates near the bottom and exposes jump state when reading older content', async () => {
    const Harness = defineComponent({
      setup() {
        const content = ref('one')
        const autoScroll = ref(true)
        const scroll = useAutoScroll({
          autoScroll,
          watchSource: () => content.value
        })

        return { content, ...scroll }
      },
      render() {
        return h('div', [
          h(
            'section',
            {
              ref: 'viewportRef',
              class: 'viewport',
              onScroll: this.updateScrollState
            },
            this.content
          ),
          this.showJumpToLatest
            ? h('button', { class: 'jump', onClick: this.jumpToLatest }, 'Latest')
            : null
        ])
      }
    })

    const wrapper = mount(Harness)
    const viewport = wrapper.find('.viewport').element

    setScrollMetrics(viewport, {
      scrollTop: 96,
      scrollHeight: 200,
      clientHeight: 100
    })
    wrapper.vm.content = 'two'
    await nextTick()
    await nextTick()

    expect(viewport.scrollTop).toBe(200)
    expect(wrapper.find('.jump').exists()).toBe(false)

    setScrollMetrics(viewport, {
      scrollTop: 20,
      scrollHeight: 300,
      clientHeight: 100
    })
    wrapper.vm.content = 'three'
    await nextTick()
    await nextTick()

    expect(viewport.scrollTop).toBe(20)
    expect(wrapper.find('.jump').exists()).toBe(true)

    await wrapper.find('.jump').trigger('click')

    expect(viewport.scrollTop).toBe(300)
    expect(wrapper.find('.jump').exists()).toBe(false)
  })
})
