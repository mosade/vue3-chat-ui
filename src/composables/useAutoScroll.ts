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
  const shouldFollowLatest = ref(true)
  const isProgrammaticSmoothScroll = ref(false)
  let hasUserScrollIntent = false
  let scrollAnimationFrame: number | null = null
  let scrollAnimationTargetTop = 0
  let scrollAnimationVelocity = 0
  let scrollAnimationElement: HTMLElement | null = null
  let previousInlineScrollBehavior: string | null = null
  const scrollAnimationSpring = 0.055
  const scrollAnimationDamping = 0.82
  const scrollAnimationMaxVelocity = 14

  const getIsNearBottom = (element: HTMLElement) =>
    element.scrollHeight - element.scrollTop - element.clientHeight <= bottomThreshold

  const getScrollBottom = (element: HTMLElement) =>
    Math.max(element.scrollHeight - element.clientHeight, 0)

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
    scrollAnimationVelocity = 0

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

    scrollAnimationTargetTop = getScrollBottom(element)

    if (scrollAnimationFrame !== null) {
      return
    }

    const tick = () => {
      const distance = scrollAnimationTargetTop - element.scrollTop

      if (Math.abs(distance) <= 1) {
        element.scrollTop = scrollAnimationTargetTop
        scrollAnimationFrame = null
        scrollAnimationVelocity = 0
        isProgrammaticSmoothScroll.value = shouldFollowLatest.value
        stopScrollAnimation()
        return
      }

      scrollAnimationVelocity =
        (scrollAnimationVelocity + distance * scrollAnimationSpring) * scrollAnimationDamping
      scrollAnimationVelocity = Math.sign(scrollAnimationVelocity) * Math.min(
        Math.abs(scrollAnimationVelocity),
        scrollAnimationMaxVelocity
      )

      if (Math.abs(scrollAnimationVelocity) < 0.5) {
        scrollAnimationVelocity = Math.sign(distance) * 0.5
      }

      element.scrollTop += scrollAnimationVelocity
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

      isProgrammaticSmoothScroll.value = shouldFollowLatest.value
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
    shouldFollowLatest.value = false
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
    shouldFollowLatest.value = true
    const scrollBehavior = options.scrollBehavior ?? 'smooth'

    if (scrollBehavior === 'smooth') {
      isProgrammaticSmoothScroll.value = true
      animateScrollToBottom(element)
    } else if (typeof element.scrollTo === 'function') {
      stopScrollAnimation()
      isProgrammaticSmoothScroll.value = false
      element.scrollTo({
        top: getScrollBottom(element),
        behavior: scrollBehavior
      })
    } else {
      stopScrollAnimation()
      isProgrammaticSmoothScroll.value = false
      element.scrollTop = getScrollBottom(element)
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
          ? (isProgrammaticSmoothScroll.value && !hasUserScrollIntent) ||
            getIsNearBottom(viewportRef.value)
          : true

        if (!shouldScroll) {
          isProgrammaticSmoothScroll.value = false
          shouldFollowLatest.value = false
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
