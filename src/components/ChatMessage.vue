<script setup lang="ts">
import type { AiChatMessage } from '../types'

defineProps<{
  message: AiChatMessage
  index: number
}>()
</script>

<template>
  <article
    class="ai-chat__message"
    :class="[
      `ai-chat__message--${message.role}`,
      message.status ? `ai-chat__message--${message.status}` : ''
    ]"
  >
    <div class="ai-chat__avatar" aria-hidden="true">
      <slot name="avatar" :message="message" :index="index">
        <span>{{ message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI' : '!' }}</span>
      </slot>
    </div>

    <div class="ai-chat__message-body">
      <div class="ai-chat__message-content">
        <slot name="message-content" :message="message" :index="index" :status="message.status">
          {{ message.content }}
        </slot>
        <span v-if="message.status === 'pending'" class="ai-chat__sr-only" aria-live="polite">
          Response pending
        </span>
        <span v-if="message.status === 'streaming'" class="ai-chat__status" aria-live="polite">
          Streaming
        </span>
        <span v-if="message.status === 'error'" class="ai-chat__status" role="alert">
          Error
        </span>
      </div>

      <div class="ai-chat__message-actions">
        <slot name="message-actions" :message="message" :index="index" :status="message.status" />
      </div>
    </div>
  </article>
</template>
