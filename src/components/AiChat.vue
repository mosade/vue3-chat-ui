<script setup lang="ts">
import { computed, toRef } from 'vue'
import ChatComposer from './ChatComposer.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatToolbar from './ChatToolbar.vue'
import { useAiChat } from '../composables/useAiChat'
import { renderMarkdown } from '../utils/markdown'
import type {
  AiChatAdapter,
  AiChatError,
  AiChatMessage,
  AiChatRegeneratePayload,
  AiChatSendContext
} from '../types'

const props = withDefaults(
  defineProps<{
    messages?: AiChatMessage[]
    defaultMessages?: AiChatMessage[]
    adapter?: AiChatAdapter
    sendHandler?: (context: AiChatSendContext) => Promise<string | void>
    loading?: boolean
    disabled?: boolean
    placeholder?: string
    autoFocus?: boolean
    autoScroll?: boolean
    markdown?: boolean | ((content: string, message: AiChatMessage) => unknown)
  }>(),
  {
    messages: undefined,
    defaultMessages: undefined,
    adapter: undefined,
    sendHandler: undefined,
    loading: false,
    disabled: false,
    placeholder: 'Ask anything...',
    autoFocus: false,
    autoScroll: true,
    markdown: false
  }
)

const emit = defineEmits<{
  'update:messages': [messages: AiChatMessage[]]
  send: [prompt: string]
  stop: []
  regenerate: [payload: AiChatRegeneratePayload]
  clear: []
  error: [error: AiChatError, context: { prompt: string; messages: AiChatMessage[] }]
}>()

const chat = useAiChat({
  messages: toRef(props, 'messages'),
  defaultMessages: props.defaultMessages,
  onSend: (context) => {
    const sendHandler = props.sendHandler ?? props.adapter?.send
    return sendHandler?.(context) ?? Promise.resolve()
  },
  onUpdateMessages: (nextMessages) => emit('update:messages', nextMessages),
  onError: (error, context) => emit('error', error, context)
})

const isBusy = computed(() => props.loading || chat.isActive.value)
const isDisabled = computed(() => props.disabled)
const isActive = computed(() => chat.isActive.value)

const submit = async (prompt: string) => {
  emit('send', prompt)
  await chat.send(prompt)
}

const stop = () => {
  emit('stop')
  chat.stop()
}

const clear = () => {
  emit('clear')
  chat.clear()
}

const regenerate = async (message: AiChatMessage) => {
  const payload = await chat.regenerate(message.id)
  if (payload) {
    emit('regenerate', payload)
  }
}

const renderMessageContent = (message: AiChatMessage) => {
  if (typeof props.markdown === 'function') {
    return String(props.markdown(message.content, message))
  }

  if (props.markdown) {
    return renderMarkdown(message.content)
  }

  return message.content
}
</script>

<template>
  <div class="ai-chat" :aria-busy="isBusy">
    <header v-if="$slots.header" class="ai-chat__header">
      <slot name="header" :messages="chat.messages.value" :active="isBusy" />
    </header>

    <ChatToolbar :disabled="isDisabled || isBusy" @clear="clear" />

    <ChatMessageList :messages="chat.messages.value" :auto-scroll="autoScroll">
      <template #empty>
        <slot name="empty" />
      </template>
      <template #avatar="slotProps">
        <slot name="avatar" v-bind="slotProps" />
      </template>
      <template #message-content="slotProps">
        <slot name="message" v-bind="slotProps">
          <slot name="message-content" v-bind="slotProps">
            <span
              v-if="markdown"
              class="ai-chat__markdown"
              v-html="renderMessageContent(slotProps.message)"
            />
            <template v-else>
              {{ renderMessageContent(slotProps.message) }}
            </template>
          </slot>
        </slot>
      </template>
      <template #message-actions="slotProps">
        <slot
          name="message-actions"
          v-bind="slotProps"
          :can-regenerate="chat.canRegenerate(slotProps.message)"
          :actions="{ regenerate: () => regenerate(slotProps.message) }"
        >
          <button
            v-if="chat.canRegenerate(slotProps.message)"
            class="ai-chat__button ai-chat__button--secondary"
            type="button"
            aria-label="Regenerate response"
            @click="regenerate(slotProps.message)"
          >
            Regenerate
          </button>
        </slot>
      </template>
      <template #message-traces="slotProps">
        <slot name="message-traces" v-bind="slotProps" />
      </template>
      <template #message-trace="slotProps">
        <slot name="message-trace" v-bind="slotProps" />
      </template>
    </ChatMessageList>

    <ChatComposer
      :disabled="isDisabled || isBusy"
      :active="isActive"
      :placeholder="placeholder"
      :auto-focus="autoFocus"
      @submit="submit"
      @stop="stop"
    >
      <template #prefix>
        <slot name="composer-prefix" />
      </template>
      <template #actions>
        <slot name="composer-actions" />
      </template>
    </ChatComposer>

    <footer v-if="$slots.footer" class="ai-chat__footer">
      <slot name="footer" :messages="chat.messages.value" :active="isBusy" />
    </footer>
  </div>
</template>
