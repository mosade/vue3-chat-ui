# vue3-ai-chat

Headless Vue 3 AI chat state and slot orchestration. The package provides a
provider-neutral `useAiChat` state machine, a headerless `AiChat` root component,
replaceable content parsers, optional building blocks, and explicit CSS presets.

## Install

```bash
npm install vue3-ai-chat vue
```

## Basic Usage

```vue
<script setup lang="ts">
import { AiChat, markdownParser, type AiChatAdapter } from 'vue3-ai-chat'
import 'vue3-ai-chat/base.css'

const adapter: AiChatAdapter = {
  async send({ append }) {
    append('Hello')
  }
}
</script>

<template>
  <AiChat :adapter="adapter" :parser="markdownParser">
    <template #header="{ messages, actions }">
      <button type="button" @click="actions.clear()">Clear {{ messages.length }}</button>
    </template>

    <template #message="{ message, parsed, actions }">
      <div v-if="message.role === 'user'" class="user-message">
        {{ message.content }}
      </div>
      <div v-else-if="parsed.type === 'html'" class="assistant-message" v-html="parsed.content" />
      <p v-else class="assistant-message">{{ parsed.content }}</p>

      <button v-if="message.content" type="button" @click="actions.copy()">Copy</button>

      <ol v-if="message.sources?.length" class="message-sources">
        <li v-for="source in message.sources" :key="source.id">
          <a v-if="source.url" :href="source.url" target="_blank" rel="noreferrer">
            {{ source.title }}
          </a>
          <span v-else>{{ source.title }}</span>
        </li>
      </ol>
    </template>
  </AiChat>
</template>
```

## Core API

`AiChat` exposes only five top-level slots:

| Slot | Context |
| --- | --- |
| `header` | `AiChatRootSlotContext` |
| `empty` | `AiChatRootSlotContext` |
| `message` | `AiChatMessageSlotContext` |
| `input` | `AiChatInputSlotContext` |
| `footer` | `AiChatRootSlotContext` |

The root component owns message state, input draft state, edit state, scroll
state, and action wiring. Rendering is supplied by slots or by the exported
building blocks.

## Parsers

Default message content is parsed with the `contentParser` prop. The default
parser is `plainTextParser`, which returns safe text content. Use
`markdownParser` for the built-in minimal markdown renderer. The older `parser`
prop remains as a compatibility alias during migration:

```ts
import { markdownParser, plainTextParser } from 'vue3-ai-chat'
```

Custom parsers implement:

```ts
interface AiContentParser {
  parse: (content: string, context: AiContentParserContext) => AiContentParsed
}
```

## AiContent

`AiContent` is the standalone content renderer. It accepts raw text content and
can be used inside or outside `AiChat`:

```vue
<script setup lang="ts">
import { AiContent, markdownParser } from 'vue3-ai-chat'
</script>

<template>
  <AiContent
    :content="content"
    :parser="markdownParser"
    :streaming="streaming"
  />
</template>
```

For custom message slots, prefer rendering content explicitly:

```vue
<AiChat>
  <template #message="{ message }">
    <AiContent
      :content="message.content"
      :parser="markdownParser"
      :streaming="message.status === 'streaming'"
    />
  </template>
</AiChat>
```

`AiContent` renders content by stable blocks during streaming. Completed image
blocks keep stable keys, so appending new chunks does not remount existing image
nodes.

## Adapter

`adapter.send` receives an `AiChatSendContext`:

```ts
const adapter: AiChatAdapter = {
  async send({ prompt, append, update, setPhase, appendTrace, updateTrace, signal }) {
    setPhase('searching')
    const traceId = appendTrace({
      kind: 'search',
      title: 'Searching docs',
      status: 'pending'
    })

    await fetch('/api/search', { signal })
    updateTrace(traceId, { status: 'done' })

    setPhase('answering')
    append(`Answer for ${prompt}`)
    update({
      sources: [{ id: 'docs', title: 'Docs', url: 'https://example.com' }]
    })
  }
}
```

`phase` expresses the main assistant lifecycle. `traces` express public process
events such as reasoning summaries, search, or tool calls. `sources` express
final citations or references. These are intentionally separate fields.

## Building Blocks

The package exports optional building blocks:

```ts
import { AiContent, ChatComposer, ChatMessage, ChatMessageList } from 'vue3-ai-chat'
```

They are ordinary components for composing your own UI. They are not required by
the `AiChat` slot protocol.

## CSS Presets

The package entry does not import CSS automatically. Import one or both presets
explicitly:

```ts
import 'vue3-ai-chat/base.css'
import 'vue3-ai-chat/shadcn.css'
```

`base.css` defines stable `.ai-chat` class styling. `shadcn.css` adds a
shadcn-inspired token preset without any runtime dependency.

## Breaking Changes

- Removed the `markdown` prop. Use `parser`, `markdownParser`, or a custom parser.
- Removed the fixed toolbar. Use `header` or another slot and call `actions.clear()`.
- Removed `placeholder` from `AiChat`; placeholder belongs to `ChatComposer` or a custom `input` slot.
- Package entry no longer imports CSS. Import `vue3-ai-chat/base.css` or `vue3-ai-chat/shadcn.css`.
- Role-specific and nested message slots were removed. Use the single `message` slot and branch on `message.role`.
- `AiChatTraceKind` no longer includes `source`. Process information goes in `traces`; final references go in `message.sources`.
- `contentParser` is the preferred `AiChat` prop for the default message content renderer.
- `parser` remains a compatibility alias during migration.
- For full rendering control, use the `message` slot and render `AiContent` directly.

## Development

```bash
npm test
npm run typecheck
npm run build
```
