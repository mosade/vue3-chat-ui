<script setup lang="ts">
import { computed, toRef } from 'vue'
import ChatComposer from './ChatComposer.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatToolbar from './ChatToolbar.vue'
import { useAiChat } from '../composables/useAiChat'
import type {
  AiChatAdapter,
  AiChatError,
  AiChatMessage,
  AiChatSendContext
} from '../types'

const props = withDefaults(
  defineProps<{
    messages?: AiChatMessage[]
    defaultMessages?: AiChatMessage[]
    adapter?: AiChatAdapter
    onSend?: (context: AiChatSendContext) => Promise<string | void>
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
    onSend: undefined,
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
  retry: []
  clear: []
  error: [error: AiChatError, context: { prompt: string; messages: AiChatMessage[] }]
}>()

const chat = useAiChat({
  messages: toRef(props, 'messages'),
  defaultMessages: props.defaultMessages,
  onSend: (context) => {
    const sendHandler = props.onSend ?? props.adapter?.send
    return sendHandler?.(context) ?? Promise.resolve()
  },
  onUpdateMessages: (nextMessages) => emit('update:messages', nextMessages),
  onError: (error, context) => emit('error', error, context)
})

const isBusy = computed(() => props.loading || chat.isActive.value)
const isDisabled = computed(() => props.disabled)
const canRetry = computed(() => chat.messages.value.some((message) => message.status === 'error'))

const submit = async (prompt: string) => {
  if (!props.onSend) {
    emit('send', prompt)
  }
  await chat.send(prompt)
}

const stop = () => {
  emit('stop')
  chat.stop()
}

const retry = async () => {
  emit('retry')
  await chat.retry()
}

const clear = () => {
  emit('clear')
  chat.clear()
}
</script>

<template>
  <div class="ai-chat" :aria-busy="isBusy">
    <header v-if="$slots.header" class="ai-chat__header">
      <slot name="header" :messages="chat.messages.value" :active="isBusy" />
    </header>

    <ChatToolbar
      :disabled="isDisabled || isBusy"
      :can-retry="canRetry"
      @retry="retry"
      @clear="clear"
    />

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
            {{ slotProps.message.content }}
          </slot>
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
    </ChatMessageList>

    <ChatComposer
      :disabled="isDisabled || isBusy"
      :active="isBusy"
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
