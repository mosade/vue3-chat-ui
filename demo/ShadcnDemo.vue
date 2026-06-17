<script setup lang="ts">
import { computed, ref } from 'vue'
import { AiChat, type AiChatMessage, type AiChatSendContext } from '../src'

const shadcnMessages = ref<AiChatMessage[]>([
  {
    id: 'shadcn-welcome',
    role: 'assistant',
    content:
      'This variant keeps the same AiChat component and restyles it with slots plus CSS variables for a shadcn-inspired product surface.',
    status: 'done'
  },
  {
    id: 'shadcn-user',
    role: 'user',
    content: 'Show me how the component adapts to another design system.',
    status: 'done'
  },
  {
    id: 'shadcn-assistant',
    role: 'assistant',
    content:
      'The message list, composer, toolbar, and state machine are unchanged. This view customizes message actions for copy, edit, retry, and regenerate.',
    status: 'done'
  }
])
const shadcnFailNext = ref(false)

const shadcnMessageCount = computed(() => shadcnMessages.value.length)

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

const sendShadcnMessage = async ({
  prompt,
  append,
  appendTrace,
  updateTrace,
  signal
}: AiChatSendContext) => {
  if (shadcnFailNext.value) {
    shadcnFailNext.value = false
    await wait(240, signal)
    throw new Error('The shadcn-style adapter returned a demo error.')
  }

  const traceId = appendTrace({
    kind: 'tool',
    title: 'Reading workspace',
    content: 'Inspecting package exports, demo state, and style tokens.',
    status: 'pending',
    items: ['src/index.ts', 'demo/style.css']
  })
  await wait(220, signal)
  updateTrace(traceId, {
    content: 'Workspace inspection complete. No external provider is required.',
    status: 'done'
  })

  appendTrace({
    kind: 'source',
    title: 'Source notes',
    content: 'This is a mock trace supplied by adapter code, not hidden reasoning.',
    status: 'done',
    items: ['AiChatSendContext.appendTrace', 'AiChatSendContext.updateTrace']
  })

  const chunks = [
    `Prompt received: ${prompt}. `,
    'This view uses a restrained neutral palette, thin borders, compact spacing, ',
    'and slot-rendered action buttons to demonstrate custom UI control.'
  ]

  for (const chunk of chunks) {
    await wait(220, signal)
    append(chunk)
  }
}
</script>

<template>
  <section class="shadcn-demo">
    <header class="shadcn-demo__topbar">
      <div>
        <p class="shadcn-demo__eyebrow">vue3-ai-chat slots + variables</p>
        <h1>shadcn-style workspace</h1>
        <p>
          A second demo surface using the same component API with custom
          message action controls for copy, edit, retry, and regenerate.
        </p>
      </div>

      <div class="shadcn-demo__actions">
        <span class="shadcn-demo__badge">Mock adapter</span>
        <button type="button" class="shadcn-demo__button" @click="shadcnFailNext = true">
          Fail next
        </button>
      </div>
    </header>

    <section class="shadcn-demo__grid">
      <aside class="shadcn-demo__sidebar" aria-label="Conversation metadata">
        <div class="shadcn-demo__section">
          <span class="shadcn-demo__label">Conversation</span>
          <strong>Component styling audit</strong>
          <p>
            This isolated demo component owns its state, adapter, and slot-rendered
            action bar while using the shared AiChat implementation.
          </p>
        </div>

        <div class="shadcn-demo__metrics">
          <div>
            <span>Messages</span>
            <strong>{{ shadcnMessageCount }}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{{ shadcnFailNext ? 'Fail armed' : 'Ready' }}</strong>
          </div>
        </div>

        <pre class="shadcn-demo__state">{{
          JSON.stringify(shadcnMessages.slice(-4), null, 2)
        }}</pre>
      </aside>

      <section class="shadcn-demo__chat">
        <AiChat
          v-model:messages="shadcnMessages"
          :adapter="{ send: sendShadcnMessage }"
          placeholder="Message the shadcn-style assistant..."
        >
          <template #header="{ active }">
            <div class="shadcn-chat-header">
              <div>
                <strong>Design System Assistant</strong>
                <span>{{ active ? 'Streaming response' : 'Ready for prompt' }}</span>
              </div>
              <span class="shadcn-demo__badge" :data-active="active">
                {{ active ? 'Live' : 'Idle' }}
              </span>
            </div>
          </template>

          <template #empty>
            <div class="shadcn-empty">
              <strong>No messages</strong>
              <span>Start a conversation to test the shadcn-style skin.</span>
            </div>
          </template>

          <template #avatar="{ message }">
            <span class="shadcn-avatar">{{ message.role === 'user' ? 'ME' : 'AI' }}</span>
          </template>

          <template #message-content="{ message }">
            <p class="shadcn-message-copy">{{ message.content || 'Thinking...' }}</p>
          </template>

          <template #message-actions="{ message, canRegenerate, canRetry, actions }">
            <div class="shadcn-message-actions">
              <span class="shadcn-message-status">{{ message.status ?? 'done' }}</span>
              <button
                v-if="message.content"
                type="button"
                class="shadcn-message-action"
                data-shadcn-action="copy"
                @click="actions.copy()"
              >
                Copy
              </button>
              <button
                v-if="message.role === 'user'"
                type="button"
                class="shadcn-message-action"
                data-shadcn-action="edit"
                @click="actions.edit()"
              >
                Edit
              </button>
              <button
                v-if="canRetry"
                type="button"
                class="shadcn-message-action"
                data-shadcn-action="retry"
                @click="actions.retry()"
              >
                Retry
              </button>
              <button
                v-if="canRegenerate"
                type="button"
                class="shadcn-message-action"
                data-shadcn-action="regenerate"
                @click="actions.regenerate()"
              >
                Regenerate
              </button>
            </div>
          </template>

          <template #message-trace="{ trace }">
            <div class="shadcn-trace-row">
              <span class="shadcn-trace-row__kind">{{ trace.kind }}</span>
              <div>
                <strong>{{ trace.title }}</strong>
                <p v-if="trace.content">{{ trace.content }}</p>
                <small v-if="trace.items?.length">{{ trace.items.join(' / ') }}</small>
              </div>
              <span v-if="trace.status" class="shadcn-message-status">{{ trace.status }}</span>
            </div>
          </template>

          <template #composer-prefix>
            <span class="shadcn-composer-prefix">⌘</span>
          </template>

          <template #composer-actions>
            <button
              class="shadcn-demo__button shadcn-demo__button--ghost"
              type="button"
              @click="shadcnFailNext = true"
            >
              Error
            </button>
          </template>

          <template #footer>
            Isolated shadcn-style demo component with custom message action UI.
          </template>
        </AiChat>
      </section>
    </section>
  </section>
</template>
