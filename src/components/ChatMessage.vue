<script setup lang="ts">
import { computed } from 'vue'
import type {
  AiChatMessage,
  AiChatMessageActions,
  AiChatMessageEditActions,
  AiChatMessagePhase,
  AiChatMessageStatus,
  AiChatParsedContent,
  AiChatSource,
  AiChatTrace
} from '../types'

const props = defineProps<{
  message: AiChatMessage
  index: number
  parsed: AiChatParsedContent
  phase?: AiChatMessagePhase
  status?: AiChatMessageStatus
  traces?: AiChatTrace[]
  sources?: AiChatSource[]
  active?: boolean
  disabled?: boolean
  editing?: boolean
  editDraft?: string
  canSaveEdit?: boolean
  canRetry?: boolean
  canRegenerate?: boolean
  actions?: AiChatMessageActions
  editActions?: AiChatMessageEditActions
}>()

const messageTraces = computed(() => props.traces ?? props.message.traces ?? [])
const messageSources = computed(() => props.sources ?? props.message.sources ?? [])
const messageStatus = computed(() => props.status ?? props.message.status)

const traceLabel = (trace: AiChatTrace) => {
  if (trace.kind === 'reasoning') return 'Thinking'
  if (trace.kind === 'search') return 'Searching data'
  if (trace.kind === 'tool') return 'Tool'
  return 'Process'
}

const tracesOpen = (traces: AiChatTrace[]) =>
  traces.some((trace) => trace.status === 'pending' || trace.status === 'error')

const tracesSummary = (traces: AiChatTrace[]) => {
  if (traces.some((trace) => trace.status === 'error')) return 'Process needs attention'
  if (traces.some((trace) => trace.status === 'pending')) return 'Working...'
  return 'Process'
}
</script>

<template>
  <article
    class="ai-chat__message"
    :class="[
      `ai-chat__message--${message.role}`,
      messageStatus ? `ai-chat__message--${messageStatus}` : ''
    ]"
  >
    <div class="ai-chat__avatar" aria-hidden="true">
      <slot name="avatar" :message="message" :index="index">
        <span>{{ message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI' : '!' }}</span>
      </slot>
    </div>

    <div class="ai-chat__message-body">
      <details
        v-if="messageTraces.length"
        class="ai-chat__traces"
        aria-label="Response process"
        :open="tracesOpen(messageTraces)"
      >
        <summary class="ai-chat__traces-summary">
          <span>{{ tracesSummary(messageTraces) }}</span>
          <span class="ai-chat__traces-count">{{ messageTraces.length }}</span>
        </summary>
        <div>
          <div
            v-for="trace in messageTraces"
            :key="trace.id"
            class="ai-chat__trace"
            :class="[
              `ai-chat__trace--${trace.kind}`,
              trace.status ? `ai-chat__trace--${trace.status}` : ''
            ]"
          >
            <div class="ai-chat__trace-header">
              <span class="ai-chat__trace-kind">{{ traceLabel(trace) }}</span>
              <span v-if="trace.status" class="ai-chat__trace-status">{{ trace.status }}</span>
            </div>
            <strong class="ai-chat__trace-title">{{ trace.title }}</strong>
            <p v-if="trace.content" class="ai-chat__trace-content">{{ trace.content }}</p>
            <ul v-if="trace.items?.length" class="ai-chat__trace-items">
              <li v-for="item in trace.items" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </details>

      <div class="ai-chat__message-content">
        <span
          v-if="parsed.type === 'html'"
          class="ai-chat__content-html"
          v-html="parsed.content"
        />
        <template v-else>
          {{ parsed.content }}
        </template>
        <span v-if="messageStatus === 'pending'" class="ai-chat__sr-only" aria-live="polite">
          Response pending
        </span>
        <span v-if="messageStatus === 'streaming'" class="ai-chat__status" aria-live="polite">
          Streaming
        </span>
        <span v-if="messageStatus === 'error'" class="ai-chat__status" role="alert">
          Error
        </span>
        <span v-if="messageStatus === 'stopped'" class="ai-chat__status">
          Stopped
        </span>
      </div>

      <div v-if="messageSources.length" class="ai-chat__sources" aria-label="Sources">
        <div>
          <div
            v-for="(source, sourceIndex) in messageSources"
            :key="source.id"
            class="ai-chat__source"
          >
            <span class="ai-chat__source-index">{{ source.index ?? sourceIndex + 1 }}</span>
            <a
              v-if="source.url"
              class="ai-chat__source-title"
              :href="source.url"
              target="_blank"
              rel="noreferrer"
            >
              {{ source.title }}
            </a>
            <strong v-else class="ai-chat__source-title">{{ source.title }}</strong>
            <span v-if="source.snippet" class="ai-chat__source-snippet">{{ source.snippet }}</span>
          </div>
        </div>
      </div>

      <div class="ai-chat__message-actions">
        <button
          v-if="message.content && actions"
          class="ai-chat__button ai-chat__button--secondary"
          type="button"
          aria-label="Copy message"
          @click="actions.copy()"
        >
          Copy
        </button>
        <button
          v-if="message.role === 'user' && editActions"
          class="ai-chat__button ai-chat__button--secondary"
          type="button"
          aria-label="Edit message"
          :disabled="disabled || active"
          @click="editActions.start()"
        >
          Edit
        </button>
        <button
          v-if="canRetry && actions"
          class="ai-chat__button ai-chat__button--secondary"
          type="button"
          aria-label="Retry response"
          @click="actions.retry()"
        >
          Retry
        </button>
        <button
          v-if="canRegenerate && actions"
          class="ai-chat__button ai-chat__button--secondary"
          type="button"
          aria-label="Regenerate response"
          @click="actions.regenerate()"
        >
          Regenerate
        </button>
      </div>
    </div>
  </article>
</template>
