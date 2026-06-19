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

  const getIsNearBottom = (element: HTMLElement) =>
    element.scrollHeight - element.scrollTop - element.clientHeight <= bottomThreshold

  const updateScrollState = () => {
    const element = viewportRef.value

    if (!element) {
      isNearBottom.value = true
      showJumpToLatest.value = false
      return
    }

    isNearBottom.value = getIsNearBottom(element)
    showJumpToLatest.value = !isNearBottom.value
  }

  const jumpToLatest = () => {
    const element = viewportRef.value

    if (!element) {
      return
    }

    if (typeof element.scrollTo === 'function') {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: options.scrollBehavior ?? 'auto'
      })
    } else {
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

        const shouldScroll = viewportRef.value ? getIsNearBottom(viewportRef.value) : true

        if (!shouldScroll) {
          isNearBottom.value = false
          showJumpToLatest.value = true
          return
        }

        await nextTick()
        jumpToLatest()
      }
    )
  }

  return {
    viewportRef,
    isNearBottom,
    showJumpToLatest,
    updateScrollState,
    jumpToLatest
  }
}
