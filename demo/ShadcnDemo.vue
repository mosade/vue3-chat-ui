<script setup lang="ts">
import { computed, ref } from 'vue'
import { AiChat, type AiChatMessage, type AiChatSendContext } from '../src'

const shadcnMessages = ref<AiChatMessage[]>([
  {
    id: 'shadcn-welcome',
    role: 'assistant',
    content:
      'This variant keeps the same AiChat state orchestration and restyles it with slots plus the shadcn CSS preset.',
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
      'The root slots own header, messages, input, and footer. Traces describe process; sources describe final references.',
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
  setPhase,
  signal
}: AiChatSendContext) => {
  if (shadcnFailNext.value) {
    shadcnFailNext.value = false
    await wait(240, signal)
    throw new Error('The shadcn-style adapter returned a demo error.')
  }

  setPhase('tool_calling')
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

  setPhase('answering')
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
        <p class="shadcn-demo__eyebrow">vue3-ai-chat preset</p>
        <h1>shadcn preset</h1>
        <p>
          A plain preset view using the exported base building blocks and shadcn CSS preset.
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
            This isolated demo keeps custom markup minimal so the preset styles remain visible.
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
          class="ai-chat--shadcn"
          :adapter="{ send: sendShadcnMessage }"
        >
          <template #header="{ active, actions }">
            <div class="shadcn-chat-header">
              <div>
                <strong>Design System Assistant</strong>
                <span>{{ active ? 'Streaming response' : 'Ready for prompt' }}</span>
              </div>
              <div class="shadcn-demo__actions">
                <span class="shadcn-demo__badge" :data-active="active">
                  {{ active ? 'Live' : 'Idle' }}
                </span>
                <button class="shadcn-demo__button shadcn-demo__button--ghost" type="button" @click="actions.clear()">
                  Clear
                </button>
              </div>
            </div>
          </template>

          <template #empty="{ actions }">
            <div class="shadcn-empty">
              <strong>No messages</strong>
              <button class="shadcn-demo__button" type="button" @click="actions.send('Audit this UI')">
                Start audit
              </button>
            </div>
          </template>

          <template #footer>
            Pure preset surface with default messages, actions, and composer.
          </template>
        </AiChat>
      </section>
    </section>
  </section>
</template>
