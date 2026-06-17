<script setup lang="ts">
import { computed, ref } from 'vue'
import { AiChat, type AiChatMessage, type AiChatSendContext } from '../src'
import ShadcnDemo from './ShadcnDemo.vue'

type DemoVariant = 'default' | 'shadcn'

const activeVariant = ref<DemoVariant>('default')
const composerInput = ref('')
const persistEvents = ref<string[]>([])
const messages = ref<AiChatMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    content:
      '**Markdown rendering** is enabled in this demo. Try copy, edit, retry, regenerate, stop, and the jump-to-latest control.',
    status: 'done',
    sources: [
      {
        id: 'vue-api-reference',
        title: 'Vue API Reference',
        url: 'https://vuejs.org/api/',
        snippet: 'Used here as an example citation rendered from message.sources.'
      }
    ]
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

const sendDemoMessage = async ({
  prompt,
  append,
  update,
  appendTrace,
  updateTrace,
  signal
}: AiChatSendContext) => {
  if (failNext.value) {
    failNext.value = false
    await wait(800, signal)
    throw new Error('Demo adapter failed on purpose. Regenerate the failed response.')
  }

  const thinkingTrace = appendTrace({
    kind: 'reasoning',
    title: 'Thinking summary',
    content: 'Turning the prompt into a short answer plan.',
    status: 'pending'
  })
  await wait(580, signal)
  updateTrace(thinkingTrace, {
    content: 'Plan ready: explain adapter flow, streaming, and stop behavior.',
    status: 'done'
  })

  const searchTrace = appendTrace({
    kind: 'search',
    title: 'Searching data',
    content: 'Checking local component docs and public type definitions.',
    status: 'pending',
    items: ['README.md', 'src/types.ts']
  })
  await wait(880, signal)
  updateTrace(searchTrace, {
    content: 'Found AiChatAdapter, AiChatSendContext, slots, and CSS variables.',
    status: 'done'
  })

  const chunks = [
    `Received: "${prompt}". `,
    'The component keeps provider logic outside the UI, ',
    'streams chunks into an assistant placeholder, ',
    'and preserves partial text when you stop generation.'
  ]

  for (const chunk of chunks) {
    await wait(560, signal)
    append(chunk)
  }

  update({
    sources: [
      {
        id: `source-${Date.now()}`,
        title: 'AiChatSendContext',
        url: 'https://github.com/',
        snippet: 'Demo source metadata is attached by the adapter through context.update().'
      }
    ]
  })
}

const messageCount = computed(() => messages.value.length)
const prefillComposer = () => {
  composerInput.value = 'Summarize the new AiChat features with sources.'
}
const recordPersist = (
  nextMessages: AiChatMessage[],
  context: { conversationId?: string; reason: string }
) => {
  persistEvents.value = [
    `${context.conversationId ?? 'conversation'}:${context.reason}:${nextMessages.length}`,
    ...persistEvents.value
  ].slice(0, 5)
}
</script>

<template>
  <main class="demo-shell">
    <nav class="demo-switcher" aria-label="Demo variants">
      <button
        type="button"
        data-demo-variant="default"
        :class="{ 'demo-switcher__button--active': activeVariant === 'default' }"
        class="demo-switcher__button"
        @click="activeVariant = 'default'"
      >
        Default
      </button>
      <button
        type="button"
        data-demo-variant="shadcn"
        :class="{ 'demo-switcher__button--active': activeVariant === 'shadcn' }"
        class="demo-switcher__button"
        @click="activeVariant = 'shadcn'"
      >
        shadcn style
      </button>
    </nav>

    <section v-if="activeVariant === 'default'" class="demo-workspace">
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
          <button class="demo-inline-button" type="button" data-demo-prefill @click="prefillComposer">
            Prefill controlled composer
          </button>
        </div>

        <div class="demo-feature-list">
          <strong>Newly showcased features</strong>
          <ul>
            <li>Markdown rendering</li>
            <li>Copy, retry, edit, and regenerate actions</li>
            <li>Controlled composer input</li>
            <li>Citations from message.sources</li>
            <li>Stopped response status</li>
            <li>Bottom-aware auto-scroll</li>
          </ul>
        </div>

        <div class="demo-stat">
          <span>Messages</span>
          <strong>{{ messageCount }}</strong>
        </div>

        <div class="demo-persist" aria-label="Persist events">
          <strong>Persist events</strong>
          <span v-if="persistEvents.length === 0">No persisted changes yet</span>
          <ol v-else>
            <li v-for="event in persistEvents" :key="event">{{ event }}</li>
          </ol>
        </div>

        <pre class="demo-preview" aria-label="Controlled messages preview">{{
          JSON.stringify(messages.slice(-3), null, 2)
        }}</pre>
      </aside>

      <section class="demo-chat" :style="themeStyle">
        <AiChat
          v-model:messages="messages"
          v-model:input="composerInput"
          :adapter="{ send: sendDemoMessage }"
          conversation-id="default-demo"
          :on-persist="recordPersist"
          auto-focus
          markdown
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

          <template #message-trace="{ trace }">
            <div class="demo-trace-card">
              <span>{{ trace.kind }}</span>
              <strong>{{ trace.title }}</strong>
              <p v-if="trace.content">{{ trace.content }}</p>
            </div>
          </template>

          <template #message-source="{ source }">
            <div class="demo-source-card">
              <strong>{{ source.title }}</strong>
              <a v-if="source.url" :href="source.url" target="_blank" rel="noreferrer">
                {{ source.url }}
              </a>
              <p v-if="source.snippet">{{ source.snippet }}</p>
            </div>
          </template>

          <template #composer-prefix>
            <span class="demo-prefix" aria-hidden="true">AI</span>
          </template>

          <template #composer-actions="{ draft, canSubmit }">
            <span class="demo-composer-state">{{ draft.length }} chars</span>
            <button class="demo-inline-button" type="button" @click="failNext = true">
              Fail next
            </button>
            <span class="demo-composer-state">{{ canSubmit ? 'Ready' : 'Waiting' }}</span>
          </template>

          <template #footer>
            Markdown, citations, persistence hooks, controlled input, stopped status, and provider-neutral send logic.
          </template>
        </AiChat>
      </section>
    </section>

    <ShadcnDemo v-else />
  </main>
</template>
