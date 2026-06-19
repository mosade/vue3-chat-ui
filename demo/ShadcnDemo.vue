<script setup lang="ts">
import { computed, ref } from 'vue'
import { AiChat, AiContent, type AiChatMessage, type AiChatSendContext } from '../src'

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
const lastError = ref('')

const messageCount = computed(() => messages.value.length)
const statusLabel = computed(() => (lastError.value ? 'Needs attention' : 'Ready'))

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

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })

const sendDeepseekMessage = async ({ prompt, append, setPhase, signal }: AiChatSendContext) => {
  lastError.value = ''
  setPhase('answering')
  await wait(80, signal)
  append(`Demo response for: ${prompt}`)
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
        <div class="deepseek-demo__suggestions" aria-label="Prompt suggestions">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion.title"
            class="deepseek-suggestion"
            type="button"
            data-deepseek-suggestion
            @click="messages.push({
              id: `suggestion-${Date.now()}`,
              role: 'user',
              content: suggestion.prompt,
              status: 'done'
            })"
          >
            {{ suggestion.title }}
          </button>
        </div>
        <AiChat
          v-model:messages="messages"
          class="ai-chat--shadcn"
          :adapter="{ send: sendDeepseekMessage }"
          auto-focus
        >
          <template #header="{ active, actions }">
            <div class="deepseek-chat-header">
              <div>
                <strong>Assistant</strong>
                <span>{{ active ? 'Responding' : `${messageCount} messages` }}</span>
              </div>
              <button class="deepseek-button deepseek-button--secondary" type="button" @click="actions.clear()">
                Clear
              </button>
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
