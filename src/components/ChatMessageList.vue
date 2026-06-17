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

watch(
  () => props.messages.map((message) => `${message.id}:${message.content}:${message.status}`).join('|'),
  async () => {
    if (!props.autoScroll) {
      return
    }

    await nextTick()
    if (viewport.value) {
      viewport.value.scrollTop = viewport.value.scrollHeight
    }
  }
)
</script>

<template>
  <section ref="viewport" class="ai-chat__messages" aria-live="polite">
    <slot name="list" :messages="messages">
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
      </ChatMessage>
    </slot>
  </section>
</template>
