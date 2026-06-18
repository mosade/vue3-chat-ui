<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, ref } from 'vue'
import {
  AiChat,
  AiContent,
  type AiChatMessage,
  type AiChatSendContext,
  type AiContentParser
} from '../src'
import markdownExample from '../docs/markdown-example.md?raw'
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
      '**AiContent rendering** is enabled through the contentParser prop. Completed blocks keep stable keys while streaming, including image blocks like ![Vue](https://vuejs.org/logo.svg).',
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
const failNext = ref(false)
const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

const demoContentParser: AiContentParser = {
  parse: (content) => ({
    type: 'html',
    content: markdownIt.render(content)
  })
}

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
  const response = `Received: "${prompt}".\n\n${markdownExample}`
  const chunks = response.match(/[\s\S]{1,520}/g) ?? []

  for (const chunk of chunks) {
    await wait(20, signal)
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

const messageCount = computed(() => messages.value.length)
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

    <section v-if="activeVariant === 'default'" class="google-demo">
      <section class="google-hero">
        <p class="google-eyebrow">Clean white demo</p>
        <h1>Ask AiChat</h1>
        <p>
          A Google-style surface for the headless slot API: bright, quiet, and centered
          around the prompt.
        </p>
        <div class="google-actions">
          <button class="demo-inline-button" type="button" data-demo-prefill @click="prefillComposer">
            Prefill prompt
          </button>
          <button class="demo-inline-button" type="button" @click="failNext = true">
            Fail next
          </button>
          <span>{{ messageCount }} messages</span>
        </div>
      </section>

      <section class="google-chat">
        <AiChat
          v-model:messages="messages"
          v-model:input="composerInput"
          :adapter="{ send: sendDemoMessage }"
          :content-parser="demoContentParser"
          conversation-id="default-demo"
          :on-persist="recordPersist"
          auto-focus
        >
          <template #header="{ messages: slotMessages, active, actions, showJumpToLatest, jumpToLatest }">
            <div class="google-chat-header">
              <div>
                <strong>AiChat</strong>
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
            <div class="google-empty">
              <strong>How can AiChat help?</strong>
              <button class="demo-inline-button" type="button" @click="actions.send('Show the new API')">
                Ask about the API
              </button>
            </div>
          </template>

          <template #message="context">
            <article class="demo-message" :class="`demo-message--${context.message.role}`">
              <div class="demo-message__body">
                <div class="demo-message__meta">
                  <strong>{{ context.message.role === 'user' ? 'You' : 'AiChat' }}</strong>
                  <span>{{ context.phase ?? context.status ?? 'done' }}</span>
                </div>
                <AiContent
                  class="demo-message-text"
                  :content="context.message.content"
                  :parser="demoContentParser"
                  :streaming="context.status === 'streaming'"
                />

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
            <div class="google-input">
              <textarea
                aria-label="Message prompt"
                rows="1"
                :value="draft"
                :disabled="active"
                placeholder="Ask anything"
                @input="actions.updateDraft(($event.target as HTMLTextAreaElement).value)"
                @keydown.enter.exact.prevent="actions.send()"
              />
              <button
                v-if="active"
                class="google-send"
                type="button"
                aria-label="Stop response"
                @click="actions.stop()"
              >
                Stop
              </button>
              <button
                v-else
                class="google-send"
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
            <span>AiContent blocks, sources, traces, persistence: {{ persistEvents[0] ?? 'ready' }}</span>
          </template>
        </AiChat>
      </section>
    </section>

    <ShadcnDemo v-else />
  </main>
</template>
