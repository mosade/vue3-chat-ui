import './style.css'

export type {
  AiChatAdapter,
  AiChatError,
  AiChatMessage,
  AiChatMessageStatus,
  AiChatRole,
  AiChatSendContext
} from './types'
export { useAiChat } from './composables/useAiChat'
export type { UseAiChatOptions, UseAiChatReturn } from './composables/useAiChat'
export { default as AiChat } from './components/AiChat.vue'
export { default } from './components/AiChat.vue'
