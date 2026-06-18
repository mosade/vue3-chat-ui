<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AiChat,
  ChatComposer,
  markdownParser,
  type AiChatMessage,
  type AiChatMessageSlotContext,
  type AiChatSendContext
} from '../src'
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
      '**Markdown rendering** is enabled through the parser prop. Try copy, edit, retry, regenerate, stop, and clear actions from slots.',
    status: 'done',
    sources: [
      {
        id: 'vue-api-reference',
        title: 'Vue API Reference',
        url: 'https://vuejs.org/api/',
        snippet: 'Example citation rendered from message.sources.'
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
    : {}
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
  setPhase,
  signal
}: AiChatSendContext) => {
  if (failNext.value) {
    failNext.value = false
    await wait(300, signal)
    throw new Error('Demo adapter failed on purpose. Retry the failed response.')
  }

  setPhase('reasoning')
  const thinkingTrace = appendTrace({
    kind: 'reasoning',
    title: 'Thinking summary',
    content: 'Turning the prompt into a short answer plan.',
    status: 'pending'
  })
  await wait(300, signal)
  updateTrace(thinkingTrace, {
    content: 'Plan ready: explain adapter flow, streaming, and stop behavior.',
    status: 'done'
  })

  setPhase('searching')
  const searchTrace = appendTrace({
    kind: 'search',
    title: 'Searching data',
    content: 'Checking local component docs and public type definitions.',
    status: 'pending',
    items: ['README.md', 'src/types.ts']
  })
  await wait(360, signal)
  updateTrace(searchTrace, {
    content: 'Found parser, slots, actions, and CSS preset exports.',
    status: 'done'
  })

  setPhase('answering')
  const chunks = [
    `Received: "${prompt}". `,
    'The root component owns state and dispatches five top-level slots, ',
    'while parser and preset choices stay replaceable.'
  ]

  for (const chunk of chunks) {
    await wait(260, signal)
    append(chunk)
  }

  update({
    sources: [
      {
        id: `source-${Date.now()}`,
        title: 'AiChatSendContext',
        url: 'https://github.com/',
        snippet: 'Demo source metadata is attached through context.update().'
      }
    ]
  })
}

const messageCount = computed(() => messages.value.length)
const prefillComposer = () => {
  composerInput.value = 'Summarize the new AiChat headless API with sources.'
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

const roleLabel = (message: AiChatMessage) => (message.role === 'user' ? 'You' : 'AI')
const traceSummary = (context: AiChatMessageSlotContext) =>
  context.phase ? `${context.phase}${context.status ? ` / ${context.status}` : ''}` : context.status ?? 'done'
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
          <h1>Headless AI chat component</h1>
          <p class="demo-copy">
            Five top-level slots, replaceable parser, explicit CSS presets, and
            provider-neutral state.
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
          :parser="markdownParser"
          conversation-id="default-demo"
          :on-persist="recordPersist"
          auto-focus
        >
          <template #header="{ messages: slotMessages, active, actions, showJumpToLatest, jumpToLatest }">
            <div class="demo-chat-header">
              <div>
                <strong>Support Copilot</strong>
                <span>{{ active ? 'Responding' : `${slotMessages.length} messages` }}</span>
              </div>
              <div class="demo-header-actions">
                <button
                  v-if="showJumpToLatest"
                  class="demo-inline-button"
                  type="button"
                  @click="jumpToLatest()"
                >
                  Latest
                </button>
                <button class="demo-inline-button" type="button" @click="actions.clear()">
                  Clear
                </button>
              </div>
            </div>
          </template>

          <template #empty="{ actions }">
            <div class="demo-empty">
              <strong>No messages yet</strong>
              <button class="demo-inline-button" type="button" @click="actions.send('Show the new API')">
                Ask about the API
              </button>
            </div>
          </template>

          <template #message="context">
            <article class="demo-message" :class="`demo-message--${context.message.role}`">
              <div class="demo-avatar">{{ roleLabel(context.message) }}</div>
              <div class="demo-message__body">
                <div class="demo-message__meta">
                  <strong>{{ roleLabel(context.message) }}</strong>
                  <span>{{ traceSummary(context) }}</span>
                </div>
                <div
                  v-if="context.parsed.type === 'html'"
                  class="demo-message-text"
                  v-html="context.parsed.content"
                />
                <p v-else class="demo-message-text">{{ context.parsed.content }}</p>

                <details v-if="context.traces.length" class="demo-traces">
                  <summary>Process {{ context.traces.length }}</summary>
                  <div v-for="trace in context.traces" :key="trace.id" class="demo-trace-card">
                    <span>{{ trace.kind }}</span>
                    <strong>{{ trace.title }}</strong>
                    <p v-if="trace.content">{{ trace.content }}</p>
                  </div>
                </details>

                <div v-if="context.sources.length" class="demo-sources">
                  <div v-for="source in context.sources" :key="source.id" class="demo-source-card">
                    <strong>{{ source.title }}</strong>
                    <a v-if="source.url" :href="source.url" target="_blank" rel="noreferrer">
                      {{ source.url }}
                    </a>
                    <p v-if="source.snippet">{{ source.snippet }}</p>
                  </div>
                </div>

                <div v-if="context.editing" class="demo-edit">
                  <textarea
                    aria-label="Edit draft"
                    :value="context.editDraft"
                    @input="context.editActions.update(($event.target as HTMLTextAreaElement).value)"
                  />
                  <button
                    class="demo-inline-button"
                    type="button"
                    :disabled="!context.canSaveEdit"
                    @click="context.editActions.save()"
                  >
                    Save
                  </button>
                  <button class="demo-inline-button" type="button" @click="context.editActions.cancel()">
                    Cancel
                  </button>
                </div>

                <div class="demo-message-actions">
                  <button
                    v-if="context.message.content"
                    class="demo-inline-button"
                    type="button"
                    @click="context.actions.copy()"
                  >
                    Copy
                  </button>
                  <button
                    v-if="context.message.role === 'user' && !context.editing"
                    class="demo-inline-button"
                    type="button"
                    :disabled="context.disabled || context.active"
                    @click="context.editActions.start()"
                  >
                    Edit
                  </button>
                  <button
                    v-if="context.canRetry"
                    class="demo-inline-button"
                    type="button"
                    @click="context.actions.retry()"
                  >
                    Retry
                  </button>
                  <button
                    v-if="context.canRegenerate"
                    class="demo-inline-button"
                    type="button"
                    @click="context.actions.regenerate()"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </article>
          </template>

          <template #input="{ draft, canSend, active, actions }">
            <div class="demo-input">
              <ChatComposer
                :input="draft"
                :active="active"
                :disabled="active"
                placeholder="Ask the demo adapter..."
                @update:input="actions.updateDraft"
                @submit="actions.send()"
                @stop="actions.stop()"
              />
              <span class="demo-composer-state">{{ draft.length }} chars / {{ canSend ? 'ready' : 'waiting' }}</span>
            </div>
          </template>

          <template #footer>
            Parser, actions, persistence hooks, controlled input, and CSS presets are composed explicitly.
          </template>
        </AiChat>
      </section>
    </section>

    <ShadcnDemo v-else />
  </main>
</template>
