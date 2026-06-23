import { nextTick, ref, watch, type Ref } from 'vue'

export interface UseAutoScrollOptions {
  autoScroll?: Ref<boolean>
  bottomThreshold?: number
  scrollBehavior?: ScrollBehavior
  watchSource?: () => unknown
}

export interface UseAutoScrollReturn {
  viewportRef: Ref<HTMLElement | null>
  isNearBottom: Ref<boolean>
  showJumpToLatest: Ref<boolean>
  updateScrollState: () => void
  jumpToLatest: () => void
}

export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const viewportRef = ref<HTMLElement | null>(null)
  const isNearBottom = ref(true)
  const showJumpToLatest = ref(false)
  const bottomThreshold = options.bottomThreshold ?? 48
  const isProgrammaticSmoothScroll = ref(false)
  let hasUserScrollIntent = false
  let scrollAnimationFrame: number | null = null
  let scrollAnimationTargetTop = 0
  let scrollAnimationElement: HTMLElement | null = null
  let previousInlineScrollBehavior: string | null = null
  const scrollAnimationFollowRatio = 0.22
  const scrollAnimationMaxStep = 18

  const getIsNearBottom = (element: HTMLElement) =>
    element.scrollHeight - element.scrollTop - element.clientHeight <= bottomThreshold

  const stopScrollAnimation = () => {
    if (scrollAnimationFrame === null) {
      if (scrollAnimationElement && previousInlineScrollBehavior !== null) {
        scrollAnimationElement.style.scrollBehavior = previousInlineScrollBehavior
        previousInlineScrollBehavior = null
        scrollAnimationElement = null
      }
      return
    }

    window.cancelAnimationFrame(scrollAnimationFrame)
    scrollAnimationFrame = null

    if (scrollAnimationElement && previousInlineScrollBehavior !== null) {
      scrollAnimationElement.style.scrollBehavior = previousInlineScrollBehavior
      previousInlineScrollBehavior = null
      scrollAnimationElement = null
    }
  }

  const animateScrollToBottom = (element: HTMLElement) => {
    if (scrollAnimationElement !== element) {
      if (scrollAnimationElement && previousInlineScrollBehavior !== null) {
        scrollAnimationElement.style.scrollBehavior = previousInlineScrollBehavior
      }

      scrollAnimationElement = element
      previousInlineScrollBehavior = element.style.scrollBehavior
      element.style.scrollBehavior = 'auto'
    }

    scrollAnimationTargetTop = element.scrollHeight

    if (scrollAnimationFrame !== null) {
      return
    }

    const tick = () => {
      const distance = scrollAnimationTargetTop - element.scrollTop

      if (Math.abs(distance) <= 1) {
        element.scrollTop = scrollAnimationTargetTop
        scrollAnimationFrame = null
        isProgrammaticSmoothScroll.value = false
        stopScrollAnimation()
        return
      }

      const nextStep = Math.min(
        Math.max(Math.abs(distance) * scrollAnimationFollowRatio, 1),
        scrollAnimationMaxStep
      )

      element.scrollTop += Math.sign(distance) * nextStep
      scrollAnimationFrame = window.requestAnimationFrame(tick)
    }

    scrollAnimationFrame = window.requestAnimationFrame(tick)
  }

  const updateScrollState = () => {
    const element = viewportRef.value

    if (!element) {
      isNearBottom.value = true
      showJumpToLatest.value = false
      return
    }

    const nearBottom = getIsNearBottom(element)

    if (nearBottom) {
      if (isProgrammaticSmoothScroll.value && scrollAnimationFrame !== null) {
        isNearBottom.value = true
        showJumpToLatest.value = false
        return
      }

      isProgrammaticSmoothScroll.value = false
      hasUserScrollIntent = false
      isNearBottom.value = true
      showJumpToLatest.value = false
      return
    }

    if (isProgrammaticSmoothScroll.value && !hasUserScrollIntent) {
      isNearBottom.value = true
      showJumpToLatest.value = false
      return
    }

    isProgrammaticSmoothScroll.value = false
    stopScrollAnimation()
    isNearBottom.value = false
    showJumpToLatest.value = !isNearBottom.value
  }

  const jumpToLatest = () => {
    const element = viewportRef.value

    if (!element) {
      return
    }

    hasUserScrollIntent = false
    const scrollBehavior = options.scrollBehavior ?? 'smooth'

    if (scrollBehavior === 'smooth') {
      isProgrammaticSmoothScroll.value = true
      animateScrollToBottom(element)
    } else if (typeof element.scrollTo === 'function') {
      stopScrollAnimation()
      isProgrammaticSmoothScroll.value = false
      element.scrollTo({
        top: element.scrollHeight,
        behavior: scrollBehavior
      })
    } else {
      stopScrollAnimation()
      isProgrammaticSmoothScroll.value = false
      element.scrollTop = element.scrollHeight
    }

    isNearBottom.value = true
    showJumpToLatest.value = false
  }

  if (options.watchSource) {
    watch(
      options.watchSource,
      async () => {
        if (options.autoScroll?.value === false) {
          return
        }

        const shouldScroll = viewportRef.value
          ? isProgrammaticSmoothScroll.value || getIsNearBottom(viewportRef.value)
          : true

        if (!shouldScroll) {
          isProgrammaticSmoothScroll.value = false
          isNearBottom.value = false
          showJumpToLatest.value = true
          return
        }

        await nextTick()
        jumpToLatest()
      }
    )
  }

  watch(viewportRef, (element, _previousElement, onCleanup) => {
    if (!element) {
      return
    }

    const markUserScrollIntent = () => {
      hasUserScrollIntent = true
    }

    element.addEventListener('wheel', markUserScrollIntent, { passive: true })
    element.addEventListener('touchstart', markUserScrollIntent, { passive: true })
    element.addEventListener('pointerdown', markUserScrollIntent)
    element.addEventListener('keydown', markUserScrollIntent)

    onCleanup(() => {
      stopScrollAnimation()
      element.removeEventListener('wheel', markUserScrollIntent)
      element.removeEventListener('touchstart', markUserScrollIntent)
      element.removeEventListener('pointerdown', markUserScrollIntent)
      element.removeEventListener('keydown', markUserScrollIntent)
    })
  })

  return {
    viewportRef,
    isNearBottom,
    showJumpToLatest,
    updateScrollState,
    jumpToLatest
  }
}
