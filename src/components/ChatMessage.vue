<script setup lang="ts">
import type { AiChatMessage, AiChatTrace } from '../types'

defineProps<{
  message: AiChatMessage
  index: number
}>()

const traceLabel = (trace: AiChatTrace) => {
  if (trace.kind === 'reasoning') return 'Thinking'
  if (trace.kind === 'search') return 'Searching data'
  if (trace.kind === 'tool') return 'Tool'
  return 'Source'
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
      message.status ? `ai-chat__message--${message.status}` : ''
    ]"
  >
    <div class="ai-chat__avatar" aria-hidden="true">
      <slot name="avatar" :message="message" :index="index">
        <span>{{ message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI' : '!' }}</span>
      </slot>
    </div>

    <div class="ai-chat__message-body">
      <details
        v-if="message.traces?.length"
        class="ai-chat__traces"
        aria-label="Response process"
        :open="tracesOpen(message.traces)"
      >
        <summary class="ai-chat__traces-summary">
          <span>{{ tracesSummary(message.traces) }}</span>
          <span class="ai-chat__traces-count">{{ message.traces.length }}</span>
        </summary>
        <slot name="message-traces" :message="message" :index="index" :traces="message.traces">
          <div
            v-for="trace in message.traces"
            :key="trace.id"
            class="ai-chat__trace"
            :class="[
              `ai-chat__trace--${trace.kind}`,
              trace.status ? `ai-chat__trace--${trace.status}` : ''
            ]"
          >
            <slot name="message-trace" :trace="trace" :message="message" :index="index">
              <div class="ai-chat__trace-header">
                <span class="ai-chat__trace-kind">{{ traceLabel(trace) }}</span>
                <span v-if="trace.status" class="ai-chat__trace-status">{{ trace.status }}</span>
              </div>
              <strong class="ai-chat__trace-title">{{ trace.title }}</strong>
              <p v-if="trace.content" class="ai-chat__trace-content">{{ trace.content }}</p>
              <ul v-if="trace.items?.length" class="ai-chat__trace-items">
                <li v-for="item in trace.items" :key="item">{{ item }}</li>
              </ul>
            </slot>
          </div>
        </slot>
      </details>

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

      <div v-if="message.sources?.length" class="ai-chat__sources" aria-label="Sources">
        <slot name="message-sources" :message="message" :index="index" :sources="message.sources">
          <div
            v-for="(source, sourceIndex) in message.sources"
            :key="source.id"
            class="ai-chat__source"
          >
            <slot
              name="message-source"
              :source="source"
              :message="message"
              :index="index"
              :source-index="sourceIndex"
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
            </slot>
          </div>
        </slot>
      </div>

      <div class="ai-chat__message-actions">
        <slot name="message-actions" :message="message" :index="index" :status="message.status" />
      </div>
    </div>
  </article>
</template>
