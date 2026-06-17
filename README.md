# vue3-ai-chat

Reusable Vue 3 AI chat component and headless composable. The package ships a
default chat UI, plain CSS styling, TypeScript types, and provider-neutral send
hooks so application code can connect any backend or model provider.

## Features

- Vue 3 + TypeScript component package.
- No UI component library dependency.
- Provider-neutral `adapter` and `onSend` integration points.
- Controlled and uncontrolled message state.
- Streaming assistant output with stop and retry actions.
- Customizable rendering through slots.
- Plain CSS theme variables and stable `ai-chat` class names.
- Headless `useAiChat` composable for custom layouts.

## Install

```bash
npm install vue3-ai-chat
```

Vue is a peer dependency:

```bash
npm install vue
```

## Basic Usage

```vue
<script setup lang="ts">
import { AiChat, type AiChatAdapter } from 'vue3-ai-chat'
import 'vue3-ai-chat/style.css'

const adapter: AiChatAdapter = {
  async send({ prompt, append, signal }) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
      signal
    })

    if (!response.ok) {
      throw new Error('Chat request failed')
    }

    append(await response.text())
  }
}
</script>

<template>
  <AiChat :adapter="adapter" placeholder="Ask anything..." />
</template>
```

## Streaming Adapter

`adapter.send` receives an `AiChatSendContext`. Call `append(chunk)` as chunks
arrive. Respect `signal` to support the built-in stop action.

```ts
import type { AiChatAdapter } from 'vue3-ai-chat'

export const adapter: AiChatAdapter = {
  async send({ prompt, append, signal }) {
    const chunks = [`Question: ${prompt}\n`, 'Thinking...\n', 'Done.']

    for (const chunk of chunks) {
      if (signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, 200))
      append(chunk)
    }
  }
}
```

If `send` returns a string, the component writes it into the assistant message.
If chunks were already appended, the returned string is appended after them.

## Controlled Messages

Use `v-model:messages` when the parent owns persistence, sync, or conversation
state.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AiChat, type AiChatMessage } from 'vue3-ai-chat'

const messages = ref<AiChatMessage[]>([])
</script>

<template>
  <AiChat v-model:messages="messages" :adapter="adapter" />
</template>
```

Use `defaultMessages` for uncontrolled initial state:

```vue
<AiChat :default-messages="[{ id: 'm1', role: 'system', content: 'Welcome' }]" />
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `messages` | `AiChatMessage[]` | Controlled message list. |
| `defaultMessages` | `AiChatMessage[]` | Initial messages for uncontrolled usage. |
| `adapter` | `AiChatAdapter` | Provider-neutral send adapter. |
| `onSend` | `(context: AiChatSendContext) => Promise<string \| void>` | Direct send callback. Takes precedence over `adapter`. |
| `loading` | `boolean` | Marks the component busy from outside. |
| `disabled` | `boolean` | Disables chat controls. |
| `placeholder` | `string` | Composer placeholder. |
| `autoFocus` | `boolean` | Focuses the composer on mount. |
| `autoScroll` | `boolean` | Scrolls to new message content. Defaults to `true`. |
| `markdown` | `boolean \| function` | Reserved render hook; default rendering is safe plain text. |

## Events

| Event | Payload |
| --- | --- |
| `update:messages` | `AiChatMessage[]` |
| `send` | `prompt: string` |
| `stop` | none |
| `retry` | none |
| `clear` | none |
| `error` | `AiChatError`, `{ prompt, messages }` |

In Vue templates, `@send` maps to the same `onSend` listener key as the `onSend`
prop. Prefer `adapter` for model integration when also listening to `@send`.

## Slots

| Slot | Scope |
| --- | --- |
| `header` | `{ messages, active }` |
| `empty` | none |
| `avatar` | `{ message, index }` |
| `message` | `{ message, index, status }` |
| `message-content` | `{ message, index, status }` |
| `message-actions` | `{ message, index, status }` |
| `composer-prefix` | none |
| `composer-actions` | none |
| `footer` | `{ messages, active }` |

Example:

```vue
<AiChat :adapter="adapter">
  <template #avatar="{ message }">
    <span>{{ message.role === 'user' ? 'You' : 'AI' }}</span>
  </template>

  <template #message-content="{ message }">
    <p>{{ message.content }}</p>
  </template>
</AiChat>
```

## Headless Composable

Use `useAiChat` when you want the state machine without the default UI.

```ts
import { useAiChat } from 'vue3-ai-chat'

const chat = useAiChat({
  adapter,
  onError(error) {
    console.error(error.message)
  }
})

await chat.send('Hello')
chat.stop()
await chat.retry()
chat.clear()
```

`useAiChat` returns:

- `messages`
- `isActive`
- `error`
- `send(prompt)`
- `stop()`
- `retry()`
- `clear()`
- `setMessages(messages)`

## Types

```ts
export type AiChatRole = 'user' | 'assistant' | 'system' | 'error'
export type AiChatMessageStatus = 'pending' | 'streaming' | 'done' | 'error'

export interface AiChatMessage {
  id: string
  role: AiChatRole
  content: string
  status?: AiChatMessageStatus
  createdAt?: number
  meta?: Record<string, unknown>
}
```

## Theming

Import the stylesheet once:

```ts
import 'vue3-ai-chat/style.css'
```

Override CSS variables on any ancestor:

```css
.my-chat-theme {
  --ai-chat-bg: #ffffff;
  --ai-chat-fg: #172026;
  --ai-chat-muted-fg: #667085;
  --ai-chat-border: #cfd8dc;
  --ai-chat-user-bg: #0f766e;
  --ai-chat-user-fg: #ffffff;
  --ai-chat-assistant-bg: #f4f7f9;
  --ai-chat-assistant-fg: #172026;
  --ai-chat-error-bg: #fee2e2;
  --ai-chat-error-fg: #991b1b;
  --ai-chat-radius: 8px;
  --ai-chat-gap: 12px;
  --ai-chat-font-size: 14px;
  --ai-chat-font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
```

Stable class names use the `ai-chat` prefix, for example `.ai-chat`,
`.ai-chat__messages`, `.ai-chat__message--user`, and `.ai-chat__composer`.

## Demo

Run the local demo:

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

The demo shows controlled messages, a mock streaming adapter, stop, retry,
clear, custom slots, and runtime theme switching.

## Development

```bash
npm test
npm run typecheck
npm run build
```

The build emits library bundles, CSS, and TypeScript declaration files into
`dist/`.
