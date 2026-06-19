<script setup lang="ts">
import { computed } from 'vue'
import { useAutoScroll } from '../composables/useAutoScroll'
import type { AiChatMessage } from '../types'

const props = withDefaults(
  defineProps<{
    messages: AiChatMessage[]
    autoScroll?: boolean
  }>(),
  {
    autoScroll: true
  }
)

const autoScroll = computed(() => props.autoScroll)
const {
  viewportRef,
  showJumpToLatest,
  jumpToLatest,
  updateScrollState
} = useAutoScroll({
  autoScroll,
  watchSource: () =>
    props.messages
      .map((message) =>
        [
          message.id,
          message.content,
          message.status,
          JSON.stringify(message.traces ?? [])
        ].join(':')
      )
      .join('|')
})
</script>

<template>
  <div class="ai-chat__messages-wrap">
    <section
      ref="viewportRef"
      class="ai-chat__messages"
      aria-live="polite"
      @scroll="updateScrollState"
    >
      <slot name="list" :messages="messages" :show-jump-to-latest="showJumpToLatest" :jump-to-latest="jumpToLatest">
        <div v-if="messages.length === 0" class="ai-chat__empty">
          <slot name="empty">
            Start a conversation
          </slot>
        </div>

        <slot
          v-for="(message, index) in messages"
          :key="message.id"
          name="message"
          :message="message"
          :index="index"
        >
          {{ message.content }}
        </slot>
      </slot>
    </section>

    <button
      v-if="showJumpToLatest"
      class="ai-chat__jump-to-latest ai-chat__button ai-chat__button--secondary"
      type="button"
      aria-label="Jump to latest message"
      @click="jumpToLatest"
    >
      New messages
    </button>
  </div>
</template>
