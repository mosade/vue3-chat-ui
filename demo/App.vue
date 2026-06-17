<script setup lang="ts">
import { computed, ref } from 'vue'
import { AiChat, type AiChatMessage, type AiChatSendContext } from '../src'

const messages = ref<AiChatMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'This demo uses a local mock adapter. Try sending a prompt, stopping the stream, retrying an error, clearing messages, and switching the theme.',
    status: 'done'
  }
])
const compactTheme = ref(false)
const failNext = ref(false)

const themeStyle = computed(() =>
  compactTheme.value
    ? {
        '--ai-chat-bg': '#fbfbf9',
        '--ai-chat-fg': '#202124',
        '--ai-chat-muted-fg': '#6f716b',
        '--ai-chat-border': '#d9d7ce',
        '--ai-chat-user-bg': '#374151',
        '--ai-chat-user-fg': '#ffffff',
        '--ai-chat-assistant-bg': '#eef2f3',
        '--ai-chat-assistant-fg': '#172026',
        '--ai-chat-error-bg': '#fde8e8',
        '--ai-chat-error-fg': '#9f1239',
        '--ai-chat-radius': '6px',
        '--ai-chat-gap': '10px',
        '--ai-chat-font-size': '13px'
      }
    : {
        '--ai-chat-bg': '#ffffff',
        '--ai-chat-fg': '#172026',
        '--ai-chat-muted-fg': '#667085',
        '--ai-chat-border': '#cfd8dc',
        '--ai-chat-user-bg': '#0f766e',
        '--ai-chat-user-fg': '#ffffff',
        '--ai-chat-assistant-bg': '#f4f7f9',
        '--ai-chat-assistant-fg': '#172026',
        '--ai-chat-error-bg': '#fee2e2',
        '--ai-chat-error-fg': '#991b1b',
        '--ai-chat-radius': '8px',
        '--ai-chat-gap': '12px',
        '--ai-chat-font-size': '14px'
      }
)

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

const sendDemoMessage = async ({ prompt, append, signal }: AiChatSendContext) => {
  if (failNext.value) {
    failNext.value = false
    await wait(300, signal)
    throw new Error('Demo adapter failed on purpose. Press Retry last prompt.')
  }

  const chunks = [
    `Received: "${prompt}". `,
    'The component keeps provider logic outside the UI, ',
    'streams chunks into an assistant placeholder, ',
    'and preserves partial text when you stop generation.'
  ]

  for (const chunk of chunks) {
    await wait(260, signal)
    append(chunk)
  }
}

const messageCount = computed(() => messages.value.length)
</script>

<template>
  <main class="demo-shell">
    <section class="demo-workspace">
      <aside class="demo-panel" aria-label="Demo controls">
        <div>
          <p class="demo-eyebrow">vue3-ai-chat</p>
          <h1>Reusable AI chat component</h1>
          <p class="demo-copy">
            Default Vue 3 UI plus a headless state machine. This demo runs fully
            in the browser with a mock streaming adapter.
          </p>
        </div>

        <div class="demo-controls">
          <label>
            <input v-model="compactTheme" type="checkbox" />
            Compact embedded theme
          </label>
          <label>
            <input v-model="failNext" type="checkbox" />
            Make next response fail
          </label>
        </div>

        <div class="demo-stat">
          <span>Messages</span>
          <strong>{{ messageCount }}</strong>
        </div>

        <pre class="demo-preview" aria-label="Controlled messages preview">{{
          JSON.stringify(messages.slice(-3), null, 2)
        }}</pre>
      </aside>

      <section class="demo-chat" :style="themeStyle">
        <AiChat
          v-model:messages="messages"
          :adapter="{ send: sendDemoMessage }"
          auto-focus
          placeholder="Ask the demo adapter..."
        >
          <template #header="{ active }">
            <div class="demo-chat-header">
              <div>
                <strong>Support Copilot</strong>
                <span>{{ active ? 'Responding' : 'Ready' }}</span>
              </div>
              <span class="demo-live" :class="{ 'demo-live--active': active }" />
            </div>
          </template>

          <template #empty>
            <div class="demo-empty">
              <strong>No messages yet</strong>
              <span>Send a prompt to start the mock stream.</span>
            </div>
          </template>

          <template #avatar="{ message }">
            <span class="demo-avatar">{{ message.role === 'user' ? 'U' : 'AI' }}</span>
          </template>

          <template #message-content="{ message }">
            <p class="demo-message-text">{{ message.content || 'Thinking...' }}</p>
          </template>

          <template #message-actions="{ message }">
            <span>{{ message.status ?? 'done' }}</span>
          </template>

          <template #composer-prefix>
            <span class="demo-prefix" aria-hidden="true">AI</span>
          </template>

          <template #composer-actions>
            <button class="demo-inline-button" type="button" @click="failNext = true">
              Fail next
            </button>
          </template>

          <template #footer>
            Plain CSS variables, scoped slots, controlled messages, and provider-neutral send logic.
          </template>
        </AiChat>
      </section>
    </section>
  </main>
</template>
