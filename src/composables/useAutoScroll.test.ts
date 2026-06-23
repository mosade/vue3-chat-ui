import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

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

    await vi.runAllTimersAsync()

    expect(viewport.scrollTop).toBe(100)
    expect(wrapper.find('.jump').exists()).toBe(false)

    setScrollMetrics(viewport, {
      scrollTop: 20,
      scrollHeight: 300,
      clientHeight: 100
    })
    await wrapper.find('.viewport').trigger('wheel')
    wrapper.vm.content = 'three'
    await nextTick()
    await nextTick()

    expect(viewport.scrollTop).toBe(20)
    expect(wrapper.find('.jump').exists()).toBe(true)

    await wrapper.find('.jump').trigger('click')
    await vi.runAllTimersAsync()

    expect(viewport.scrollTop).toBe(200)
    expect(wrapper.find('.jump').exists()).toBe(false)
  })

  it('keeps following smooth updates while scrollTop is between animated positions', async () => {
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
    const viewport = wrapper.find('.viewport').element as HTMLElement

    setScrollMetrics(viewport, {
      scrollTop: 96,
      scrollHeight: 200,
      clientHeight: 100
    })

    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo

    wrapper.vm.content = 'two'
    await nextTick()
    await nextTick()
    await vi.advanceTimersByTimeAsync(16)

    expect(scrollTo).not.toHaveBeenCalled()
    expect(viewport.scrollTop).toBeGreaterThan(96)
    expect(viewport.scrollTop).toBeLessThan(200)
    const beforeScrollEvent = viewport.scrollTop

    await wrapper.find('.viewport').trigger('scroll')
    await vi.advanceTimersByTimeAsync(16)

    expect(viewport.scrollTop).toBeGreaterThan(beforeScrollEvent)

    setScrollMetrics(viewport, {
      scrollTop: 120,
      scrollHeight: 240,
      clientHeight: 100
    })

    wrapper.vm.content = 'three'
    await nextTick()
    await nextTick()

    await vi.runAllTimersAsync()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(viewport.scrollTop).toBe(140)
    expect(wrapper.find('.jump').exists()).toBe(false)
  })

  it('retargets smooth scrolling without a large jump during streaming updates', async () => {
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
        return h('section', {
          ref: 'viewportRef',
          class: 'viewport',
          onScroll: this.updateScrollState
        }, this.content)
      }
    })

    const wrapper = mount(Harness)
    const viewport = wrapper.find('.viewport').element as HTMLElement

    setScrollMetrics(viewport, {
      scrollTop: 96,
      scrollHeight: 200,
      clientHeight: 100
    })

    wrapper.vm.content = 'two'
    await nextTick()
    await nextTick()
    await vi.advanceTimersByTimeAsync(16)

    const beforeRetarget = viewport.scrollTop

    setScrollMetrics(viewport, {
      scrollTop: beforeRetarget,
      scrollHeight: 240,
      clientHeight: 100
    })

    wrapper.vm.content = 'three'
    await nextTick()
    await nextTick()
    await vi.advanceTimersByTimeAsync(16)

    expect(viewport.scrollTop - beforeRetarget).toBeLessThan(20)
  })

  it('keeps scroll velocity moving when streaming content extends the target', async () => {
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
        return h('section', {
          ref: 'viewportRef',
          class: 'viewport',
          onScroll: this.updateScrollState
        }, this.content)
      }
    })

    const wrapper = mount(Harness)
    const viewport = wrapper.find('.viewport').element as HTMLElement

    setScrollMetrics(viewport, {
      scrollTop: 112,
      scrollHeight: 260,
      clientHeight: 100
    })

    wrapper.vm.content = 'two'
    await nextTick()
    await nextTick()
    await vi.advanceTimersByTimeAsync(16)

    const firstFrame = viewport.scrollTop
    await vi.advanceTimersByTimeAsync(16)

    const secondFrame = viewport.scrollTop
    const stepBeforeRetarget = secondFrame - firstFrame

    setScrollMetrics(viewport, {
      scrollTop: secondFrame,
      scrollHeight: 340,
      clientHeight: 100
    })

    wrapper.vm.content = 'three'
    await nextTick()
    await nextTick()
    await vi.advanceTimersByTimeAsync(16)

    const stepAfterRetarget = viewport.scrollTop - secondFrame

    expect(stepAfterRetarget).toBeGreaterThan(stepBeforeRetarget)
  })

  it('continues auto-scrolling when a large chunk arrives after settling at the bottom', async () => {
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
          h('section', {
            ref: 'viewportRef',
            class: 'viewport',
            onScroll: this.updateScrollState
          }, this.content),
          this.showJumpToLatest
            ? h('button', { class: 'jump', onClick: this.jumpToLatest }, 'Latest')
            : null
        ])
      }
    })

    const wrapper = mount(Harness)
    const viewport = wrapper.find('.viewport').element as HTMLElement

    setScrollMetrics(viewport, {
      scrollTop: 96,
      scrollHeight: 200,
      clientHeight: 100
    })

    wrapper.vm.content = 'two'
    await nextTick()
    await nextTick()
    await vi.runAllTimersAsync()

    expect(viewport.scrollTop).toBe(100)

    setScrollMetrics(viewport, {
      scrollTop: 100,
      scrollHeight: 620,
      clientHeight: 100
    })

    wrapper.vm.content = 'large chunk'
    await nextTick()
    await nextTick()
    await vi.advanceTimersByTimeAsync(16)

    expect(viewport.scrollTop).toBeGreaterThan(100)
    expect(wrapper.find('.jump').exists()).toBe(false)
  })

  it('disables css smooth behavior while running the javascript scroll animation', async () => {
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
        return h('section', {
          ref: 'viewportRef',
          class: 'viewport',
          onScroll: this.updateScrollState
        }, this.content)
      }
    })

    const wrapper = mount(Harness)
    const viewport = wrapper.find('.viewport').element as HTMLElement
    viewport.style.scrollBehavior = 'smooth'

    setScrollMetrics(viewport, {
      scrollTop: 96,
      scrollHeight: 200,
      clientHeight: 100
    })

    wrapper.vm.content = 'two'
    await nextTick()
    await nextTick()

    expect(viewport.style.scrollBehavior).toBe('auto')

    await vi.runAllTimersAsync()

    expect(viewport.scrollTop).toBe(100)
    expect(viewport.style.scrollBehavior).toBe('smooth')
  })
})
