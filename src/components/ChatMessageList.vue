<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import ChatMessage from './ChatMessage.vue'
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

const viewport = ref<HTMLElement | null>(null)
const showJumpToLatest = ref(false)
const bottomThreshold = 48

const isNearBottom = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= bottomThreshold

const scrollToLatest = () => {
  if (!viewport.value) {
    return
  }

  viewport.value.scrollTop = viewport.value.scrollHeight
  showJumpToLatest.value = false
}

watch(
  () =>
    props.messages
      .map((message) =>
        [
          message.id,
          message.content,
          message.status,
          JSON.stringify(message.traces ?? [])
        ].join(':')
      )
      .join('|'),
  async () => {
    if (!props.autoScroll) {
      return
    }

    const shouldScroll = viewport.value ? isNearBottom(viewport.value) : true

    if (!shouldScroll) {
      showJumpToLatest.value = true
      return
    }

    await nextTick()
    if (!viewport.value) {
      return
    }

    scrollToLatest()
  }
)
</script>

<template>
  <div class="ai-chat__messages-wrap">
    <section ref="viewport" class="ai-chat__messages" aria-live="polite">
      <slot name="list" :messages="messages" :show-jump-to-latest="showJumpToLatest" :jump-to-latest="scrollToLatest">
        <div v-if="messages.length === 0" class="ai-chat__empty">
          <slot name="empty">
            Start a conversation
          </slot>
        </div>

        <ChatMessage
          v-for="(message, index) in messages"
          :key="message.id"
          :message="message"
          :index="index"
        >
          <template #avatar="slotProps">
            <slot name="avatar" v-bind="slotProps" />
          </template>
          <template #message-content="slotProps">
            <slot name="message-content" v-bind="slotProps">
              {{ slotProps.message.content }}
            </slot>
          </template>
          <template #message-actions="slotProps">
            <slot name="message-actions" v-bind="slotProps" />
          </template>
          <template #message-traces="slotProps">
            <slot name="message-traces" v-bind="slotProps" />
          </template>
          <template #message-trace="slotProps">
            <slot name="message-trace" v-bind="slotProps" />
          </template>
          <template #message-sources="slotProps">
            <slot name="message-sources" v-bind="slotProps" />
          </template>
          <template #message-source="slotProps">
            <slot name="message-source" v-bind="slotProps" />
          </template>
        </ChatMessage>
      </slot>
    </section>

    <button
      v-if="showJumpToLatest"
      class="ai-chat__jump-to-latest ai-chat__button ai-chat__button--secondary"
      type="button"
      aria-label="Jump to latest message"
      @click="scrollToLatest"
    >
      New messages
    </button>
  </div>
</template>
