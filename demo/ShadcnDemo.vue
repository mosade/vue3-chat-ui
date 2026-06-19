<script setup lang="ts">
import { computed, ref } from 'vue'
import { AiChat, AiContent, type AiChatMessage, type AiChatSendContext } from '../src'

type DeepseekStatus = 'idle' | 'ready' | 'connecting' | 'streaming' | 'error' | 'stopped'
type DeepseekRole = 'user' | 'assistant' | 'system'

const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions'

const messages = ref<AiChatMessage[]>([
  {
    id: 'deepseek-welcome',
    role: 'assistant',
    content:
      'Hi, I am your DeepSeek assistant. Add an API key, pick a model, and send a prompt when you are ready.',
    status: 'done'
  }
])
const apiKey = ref('')
const model = ref('deepseek-v4-flash')
const temperature = ref(0.7)
const streamEnabled = ref(true)
const connectionStatus = ref<DeepseekStatus>('idle')
const lastError = ref('')

const messageCount = computed(() => messages.value.length)
const statusLabel = computed(() => {
  if (lastError.value) return 'Needs attention'
  if (connectionStatus.value === 'connecting') return 'Connecting'
  if (connectionStatus.value === 'streaming') return 'Streaming'
  return 'Ready'
})

const suggestions = [
  {
    title: 'Writing assistant',
    prompt: 'Rewrite this product update so it is clear, concise, and customer-friendly.'
  },
  {
    title: 'Code review',
    prompt: 'Review this Vue component for bugs, edge cases, and maintainability issues.'
  },
  {
    title: 'Analyze a decision',
    prompt: 'Compare two implementation options and recommend the pragmatic path.'
  }
]

const toDeepseekMessages = (sourceMessages: AiChatMessage[], prompt: string) => [
  ...sourceMessages
    .filter((message): message is AiChatMessage & { role: DeepseekRole } =>
      ['user', 'assistant', 'system'].includes(message.role)
    )
    .filter((message) => message.content.trim())
    .map((message) => ({ role: message.role, content: message.content })),
  { role: 'user' as const, content: prompt }
]

const readDeepseekStream = async (
  response: Response,
  append: AiChatSendContext['append']
) => {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('DeepSeek streaming response did not include a readable body.')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      for (const line of event.split('\n')) {
        const trimmedLine = line.trim()
        if (!trimmedLine.startsWith('data:')) continue

        const data = trimmedLine.slice(5).trim()
        if (!data || data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed?.choices?.[0]?.delta?.content
          if (delta) append(delta)
        } catch {
          // Ignore malformed SSE events and continue reading the stream.
        }
      }
    }
  }
}

const sendDeepseekMessage = async ({
  prompt,
  messages: contextMessages,
  append,
  appendTrace,
  updateTrace,
  setPhase,
  signal
}: AiChatSendContext) => {
  const trimmedKey = apiKey.value.trim()

  if (!trimmedKey) {
    lastError.value = 'Enter a DeepSeek API key to send a request.'
    connectionStatus.value = 'error'
    throw new Error(lastError.value)
  }

  lastError.value = ''
  connectionStatus.value = 'connecting'
  setPhase('connecting')
  const traceId = appendTrace({
    kind: 'tool',
    title: 'Calling DeepSeek',
    content: `Sending request to ${model.value}`,
    status: 'pending'
  })

  try {
    const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model.value,
        messages: toDeepseekMessages(contextMessages, prompt),
        temperature: temperature.value,
        stream: streamEnabled.value
      }),
      signal
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `DeepSeek request failed with status ${response.status}`)
    }

    setPhase('answering')

    if (!streamEnabled.value) {
      const data = await response.json()
      append(data?.choices?.[0]?.message?.content ?? '')
      connectionStatus.value = 'ready'
      updateTrace(traceId, { status: 'done', content: 'DeepSeek response received.' })
      return
    }

    connectionStatus.value = 'streaming'
    await readDeepseekStream(response, append)
    connectionStatus.value = 'ready'
    updateTrace(traceId, { status: 'done', content: 'DeepSeek stream completed.' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      connectionStatus.value = 'stopped'
      updateTrace(traceId, { status: 'error', content: 'Request stopped by the user.' })
      throw error
    }

    const message = error instanceof Error ? error.message : 'DeepSeek request failed.'
    lastError.value = message
    connectionStatus.value = 'error'
    updateTrace(traceId, { status: 'error', content: message })
    throw error
  }
}
</script>

<template>
  <section class="deepseek-demo">
    <section class="deepseek-demo__hero">
      <div>
        <p class="deepseek-demo__eyebrow">shadcn/ui style, local CSS</p>
        <h1>DeepSeek Assistant</h1>
        <p>
          A minimal chatbot surface for direct DeepSeek API experiments in the browser.
        </p>
      </div>

      <div class="deepseek-status" :data-state="lastError ? 'error' : 'ready'">
        <span>{{ statusLabel }}</span>
        <strong>{{ model }}</strong>
      </div>
    </section>

    <section class="deepseek-demo__layout">
      <section class="deepseek-demo__chat">
        <AiChat
          v-model:messages="messages"
          class="ai-chat--shadcn"
          :adapter="{ send: sendDeepseekMessage }"
          auto-focus
        >
          <template #header="{ active, actions }">
            <div class="deepseek-chat-top">
              <div class="deepseek-chat-header">
                <div>
                  <strong>Assistant</strong>
                  <span>{{ active ? 'Responding' : `${messageCount} messages` }}</span>
                </div>
                <button class="deepseek-button deepseek-button--secondary" type="button" @click="actions.clear()">
                  Clear
                </button>
              </div>
              <div class="deepseek-demo__suggestions" aria-label="Prompt suggestions">
                <button
                  v-for="suggestion in suggestions"
                  :key="suggestion.title"
                  class="deepseek-suggestion"
                  type="button"
                  data-deepseek-suggestion
                  :disabled="active"
                  @click="actions.send(suggestion.prompt)"
                >
                  {{ suggestion.title }}
                </button>
              </div>
            </div>
          </template>

          <template #empty="{ actions }">
            <div class="deepseek-empty">
              <strong>What can I help with?</strong>
              <button
                class="deepseek-suggestion"
                type="button"
                @click="actions.send(suggestions[0].prompt)"
              >
                {{ suggestions[0].title }}
              </button>
            </div>
          </template>

          <template #message="context">
            <article class="deepseek-message" :class="`deepseek-message--${context.message.role}`">
              <div class="deepseek-message__meta">
                <strong>{{ context.message.role === 'user' ? 'You' : 'DeepSeek' }}</strong>
                <span>{{ context.phase ?? context.status ?? 'done' }}</span>
              </div>
              <AiContent class="deepseek-message__content" :content="context.message.content" />
              <div class="deepseek-message__actions">
                <button
                  v-if="context.message.content"
                  class="deepseek-button deepseek-button--ghost"
                  type="button"
                  @click="context.actions.copy()"
                >
                  Copy
                </button>
                <button
                  v-if="context.canRetry"
                  class="deepseek-button deepseek-button--ghost"
                  type="button"
                  aria-label="Retry response"
                  @click="context.actions.retry()"
                >
                  Retry
                </button>
                <button
                  v-if="context.canRegenerate"
                  class="deepseek-button deepseek-button--ghost"
                  type="button"
                  @click="context.actions.regenerate()"
                >
                  Regenerate
                </button>
              </div>
            </article>
          </template>

          <template #input="{ draft, canSend, active, actions }">
            <div class="deepseek-composer">
              <textarea
                aria-label="Message prompt"
                rows="1"
                :value="draft"
                :disabled="active"
                placeholder="Message DeepSeek..."
                @input="actions.updateDraft(($event.target as HTMLTextAreaElement).value)"
                @keydown.enter.exact.prevent="actions.send()"
              />
              <button
                v-if="active"
                class="deepseek-button deepseek-button--primary"
                type="button"
                aria-label="Stop response"
                @click="actions.stop()"
              >
                Stop
              </button>
              <button
                v-else
                class="deepseek-button deepseek-button--primary"
                type="button"
                aria-label="Send message"
                :disabled="!canSend"
                @click="actions.send()"
              >
                Send
              </button>
            </div>
          </template>

          <template #footer>
            Browser-side key entry is for local demos only.
          </template>
        </AiChat>
      </section>

      <aside class="deepseek-demo__settings" aria-label="DeepSeek settings">
        <div class="deepseek-demo__panel">
          <span class="deepseek-demo__label">Connection</span>
          <label class="deepseek-field">
            <span>API key</span>
            <input
              v-model="apiKey"
              data-deepseek-api-key
              type="password"
              placeholder="sk-..."
              autocomplete="off"
            />
          </label>
          <label class="deepseek-field">
            <span>Model</span>
            <select v-model="model" data-deepseek-model>
              <option value="deepseek-v4-flash">deepseek-v4-flash</option>
              <option value="deepseek-v4-pro">deepseek-v4-pro</option>
            </select>
          </label>
          <label class="deepseek-field">
            <span>Temperature {{ temperature.toFixed(1) }}</span>
            <input
              v-model.number="temperature"
              data-deepseek-temperature
              type="range"
              min="0"
              max="2"
              step="0.1"
            />
          </label>
          <label class="deepseek-check">
            <input v-model="streamEnabled" data-deepseek-stream type="checkbox" />
            <span>Stream responses</span>
          </label>
          <p v-if="lastError" class="deepseek-error">{{ lastError }}</p>
        </div>
      </aside>
    </section>
  </section>
</template>
