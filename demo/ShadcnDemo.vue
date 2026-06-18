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
        <p class="shadcn-demo__eyebrow">vue3-ai-chat slots + presets</p>
        <h1>shadcn-style workspace</h1>
        <p>
          A second demo surface using the same component API with custom
          message and action rendering.
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
            This isolated demo owns its state, adapter, and slot-rendered action bar.
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

          <template #message="context">
            <article class="shadcn-message" :data-role="context.message.role">
              <div class="shadcn-avatar">{{ context.message.role === 'user' ? 'ME' : 'AI' }}</div>
              <div class="shadcn-message__body">
                <p class="shadcn-message-copy">{{ context.parsed.content || 'Thinking...' }}</p>
                <div v-if="context.traces.length" class="shadcn-trace-row">
                  <span class="shadcn-trace-row__kind">{{ context.traces[0].kind }}</span>
                  <div>
                    <strong>{{ context.traces[0].title }}</strong>
                    <p v-if="context.traces[0].content">{{ context.traces[0].content }}</p>
                  </div>
                </div>
                <div v-if="context.editing" class="shadcn-edit-form">
                  <textarea
                    class="shadcn-edit-form__input"
                    aria-label="Shadcn edit message"
                    :value="context.editDraft"
                    rows="3"
                    @input="context.editActions.update(($event.target as HTMLTextAreaElement).value)"
                  />
                  <div class="shadcn-edit-form__actions">
                    <button
                      class="shadcn-message-action"
                      type="button"
                      data-shadcn-edit="save"
                      :disabled="!context.canSaveEdit"
                      @click="context.editActions.save()"
                    >
                      Save
                    </button>
                    <button
                      class="shadcn-message-action"
                      type="button"
                      data-shadcn-edit="cancel"
                      @click="context.editActions.cancel()"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div class="shadcn-message-actions">
                  <span class="shadcn-message-status">{{ context.phase ?? context.status ?? 'done' }}</span>
                  <button
                    v-if="context.message.content"
                    type="button"
                    class="shadcn-message-action"
                    data-shadcn-action="copy"
                    @click="context.actions.copy()"
                  >
                    Copy
                  </button>
                  <button
                    v-if="context.message.role === 'user' && !context.editing"
                    type="button"
                    class="shadcn-message-action"
                    data-shadcn-action="edit"
                    @click="context.editActions.start()"
                  >
                    Edit
                  </button>
                  <button
                    v-if="context.canRetry"
                    type="button"
                    class="shadcn-message-action"
                    data-shadcn-action="retry"
                    @click="context.actions.retry()"
                  >
                    Retry
                  </button>
                  <button
                    v-if="context.canRegenerate"
                    type="button"
                    class="shadcn-message-action"
                    data-shadcn-action="regenerate"
                    @click="context.actions.regenerate()"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </article>
          </template>

          <template #input="{ draft, canSend, active, actions }">
            <div class="shadcn-composer">
              <span class="shadcn-composer-prefix">⌘</span>
              <textarea
                class="ai-chat__composer-input"
                aria-label="Message prompt"
                rows="2"
                :value="draft"
                :disabled="active"
                placeholder="Message the shadcn-style assistant..."
                @input="actions.updateDraft(($event.target as HTMLTextAreaElement).value)"
                @keydown.enter.exact.prevent="actions.send()"
              />
              <button
                v-if="active"
                class="shadcn-demo__button shadcn-demo__button--ghost"
                type="button"
                @click="actions.stop()"
              >
                Stop
              </button>
              <button
                v-else
                class="shadcn-demo__button"
                type="button"
                :disabled="!canSend"
                @click="actions.send()"
              >
                Send
              </button>
            </div>
          </template>

          <template #footer>
            Isolated shadcn-style demo component with custom message action UI.
          </template>
        </AiChat>
      </section>
    </section>
  </section>
</template>
