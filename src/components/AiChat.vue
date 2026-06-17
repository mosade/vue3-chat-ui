<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
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
    input?: string
    defaultInput?: string
    conversationId?: string
    adapter?: AiChatAdapter
    sendHandler?: (context: AiChatSendContext) => Promise<string | void>
    onPersist?: (
      messages: AiChatMessage[],
      context: {
        conversationId?: string
        reason: 'send' | 'stop' | 'regenerate' | 'retry' | 'edit' | 'clear' | 'set'
      }
    ) => void
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
    input: undefined,
    defaultInput: '',
    conversationId: undefined,
    adapter: undefined,
    sendHandler: undefined,
    onPersist: undefined,
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
  'update:input': [value: string]
  send: [prompt: string]
  stop: []
  regenerate: [payload: AiChatRegeneratePayload]
  clear: []
  error: [error: AiChatError, context: { prompt: string; messages: AiChatMessage[] }]
}>()

const chat = useAiChat({
  conversationId: props.conversationId,
  messages: toRef(props, 'messages'),
  defaultMessages: props.defaultMessages,
  onSend: (context) => {
    const sendHandler = props.sendHandler ?? props.adapter?.send
    return sendHandler?.(context) ?? Promise.resolve()
  },
  onUpdateMessages: (nextMessages) => emit('update:messages', nextMessages),
  onPersist: (nextMessages, context) => props.onPersist?.(nextMessages, context),
  onError: (error, context) => emit('error', error, context)
})

const isBusy = computed(() => props.loading || chat.isActive.value)
const isDisabled = computed(() => props.disabled)
const isActive = computed(() => chat.isActive.value)
const editingMessageId = ref<string | null>(null)
const editingContent = ref('')

const submit = async (prompt: string) => {
  emit('send', prompt)
  await chat.send(prompt)
}

const updateInput = (value: string) => {
  emit('update:input', value)
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

const copyMessage = async (message: AiChatMessage) => {
  await navigator.clipboard?.writeText(message.content)
}

const retry = async (message: AiChatMessage) => {
  await chat.retry(message.id)
}

const startEdit = (message: AiChatMessage) => {
  editingMessageId.value = message.id
  editingContent.value = message.content
}

const cancelEdit = () => {
  editingMessageId.value = null
  editingContent.value = ''
}

const saveEdit = async (message: AiChatMessage) => {
  const payload = await chat.editUserMessage(message.id, editingContent.value)
  if (payload) {
    cancelEdit()
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
        <form
          v-if="editingMessageId === slotProps.message.id"
          class="ai-chat__message-edit"
          @submit.prevent="saveEdit(slotProps.message)"
        >
          <textarea
            v-model="editingContent"
            class="ai-chat__composer-input"
            aria-label="Edit message content"
            rows="2"
          />
          <div class="ai-chat__message-edit-actions">
            <button
              class="ai-chat__button"
              type="button"
              aria-label="Save edited message"
              :disabled="isDisabled || isBusy || !editingContent.trim()"
              @click="saveEdit(slotProps.message)"
            >
              Save
            </button>
            <button
              class="ai-chat__button ai-chat__button--secondary"
              type="button"
              aria-label="Cancel edit"
              @click="cancelEdit"
            >
              Cancel
            </button>
          </div>
        </form>
        <slot v-else name="message" v-bind="slotProps">
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
          :can-retry="chat.canRetry(slotProps.message)"
          :actions="{
            copy: () => copyMessage(slotProps.message),
            regenerate: () => regenerate(slotProps.message),
            retry: () => retry(slotProps.message),
            edit: () => startEdit(slotProps.message)
          }"
        >
          <button
            v-if="slotProps.message.content"
            class="ai-chat__button ai-chat__button--secondary"
            type="button"
            aria-label="Copy message"
            @click="copyMessage(slotProps.message)"
          >
            Copy
          </button>
          <button
            v-if="slotProps.message.role === 'user'"
            class="ai-chat__button ai-chat__button--secondary"
            type="button"
            aria-label="Edit message"
            :disabled="isDisabled || isBusy"
            @click="startEdit(slotProps.message)"
          >
            Edit
          </button>
          <button
            v-if="chat.canRetry(slotProps.message)"
            class="ai-chat__button ai-chat__button--secondary"
            type="button"
            aria-label="Retry response"
            @click="retry(slotProps.message)"
          >
            Retry
          </button>
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
      <template #message-sources="slotProps">
        <slot name="message-sources" v-bind="slotProps" />
      </template>
      <template #message-source="slotProps">
        <slot name="message-source" v-bind="slotProps" />
      </template>
    </ChatMessageList>

    <ChatComposer
      :input="input"
      :default-input="defaultInput"
      :disabled="isDisabled || isBusy"
      :active="isActive"
      :placeholder="placeholder"
      :auto-focus="autoFocus"
      @update:input="updateInput"
      @submit="submit"
      @stop="stop"
    >
      <template #prefix="slotProps">
        <slot name="composer-prefix" v-bind="slotProps" />
      </template>
      <template #actions="slotProps">
        <slot name="composer-actions" v-bind="slotProps" />
      </template>
    </ChatComposer>

    <footer v-if="$slots.footer" class="ai-chat__footer">
      <slot name="footer" :messages="chat.messages.value" :active="isBusy" />
    </footer>
  </div>
</template>
