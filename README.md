# vue3-ai-chat

可复用的 Vue 3 AI 聊天组件和无头 composable。这个包提供默认聊天 UI、纯 CSS 样式、TypeScript 类型，以及与具体模型服务解耦的发送接口，方便应用接入任意后端或模型提供商。

## 功能特性

- Vue 3 + TypeScript 组件包。
- 不依赖任何 UI 组件库。
- 提供与模型服务解耦的 `adapter` 和 `onSend` 集成方式。
- 支持受控和非受控消息状态。
- 支持 assistant 流式输出、停止和重试。
- 支持公开过程 traces，用于展示模型或后端明确提供的思考摘要、搜索进度、工具过程和来源。
- 通过 slots 自定义渲染。
- 使用纯 CSS 变量和稳定的 `ai-chat` class 名称进行主题定制。
- 提供无头 `useAiChat` composable，适合构建完全自定义布局。

## 安装

```bash
npm install vue3-ai-chat
```

Vue 是 peer dependency：

```bash
npm install vue
```

## 基础用法

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

## 流式 Adapter

`adapter.send` 会收到一个 `AiChatSendContext`。当后端或模型返回片段时，调用 `append(chunk)` 追加内容。请使用 `signal` 支持内置停止操作。

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

如果 `send` 返回字符串，组件会把它写入 assistant 消息。如果已经通过 `append` 收到过片段，返回的字符串会追加到已有内容之后。

## 公开过程 Traces

有些模型服务或应用后端会返回可公开的过程事件，例如思考摘要、搜索进度、工具调用状态或来源信息。这些不是隐藏 chain-of-thought。只应展示后端明确标记为可向用户展示的 traces。

在 `AiChatSendContext` 中使用 `appendTrace` 和 `updateTrace`：

```ts
import type { AiChatAdapter } from 'vue3-ai-chat'

export const adapter: AiChatAdapter = {
  async send({ append, appendTrace, updateTrace, signal }) {
    const searchId = appendTrace({
      kind: 'search',
      title: 'Searching data',
      content: 'Checking local documentation',
      status: 'pending',
      items: ['README.md', 'src/types.ts']
    })

    await fetch('/api/search', { signal })

    updateTrace(searchId, {
      content: 'Found the component API and slot list',
      status: 'done'
    })

    append('The answer can now cite the inspected data.')
  }
}
```

支持的 trace 类型是 `reasoning`、`search`、`tool` 和 `source`。

默认 UI 会把 traces 展示在消息正文上方，并用 `<details>` 折叠：

- 全部完成时默认折叠，summary 为 `Process`。
- 有 `pending` trace 时默认展开，summary 为 `Working...`。
- 有 `error` trace 时默认展开，summary 为 `Process needs attention`。

## 受控消息

当父组件需要负责持久化、同步或会话状态时，使用 `v-model:messages`。

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

如果只需要非受控初始状态，可以使用 `defaultMessages`：

```vue
<AiChat :default-messages="[{ id: 'm1', role: 'system', content: 'Welcome' }]" />
```

## Props

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `messages` | `AiChatMessage[]` | 受控消息列表。 |
| `defaultMessages` | `AiChatMessage[]` | 非受控模式下的初始消息。 |
| `adapter` | `AiChatAdapter` | 与模型服务解耦的发送 adapter。 |
| `onSend` | `(context: AiChatSendContext) => Promise<string \| void>` | 直接发送回调。与 `adapter` 同时存在时优先使用 `onSend`。 |
| `loading` | `boolean` | 由外部标记组件忙碌中。 |
| `disabled` | `boolean` | 禁用聊天控件。 |
| `placeholder` | `string` | 输入框 placeholder。 |
| `autoFocus` | `boolean` | 组件挂载后自动聚焦输入框。 |
| `autoScroll` | `boolean` | 新消息或过程更新时自动滚动。默认值为 `true`。 |
| `markdown` | `boolean \| function` | 预留渲染 hook；默认渲染为安全纯文本。 |

## Events

| Event | Payload |
| --- | --- |
| `update:messages` | `AiChatMessage[]` |
| `send` | `prompt: string` |
| `stop` | none |
| `retry` | none |
| `clear` | none |
| `error` | `AiChatError`, `{ prompt, messages }` |

在 Vue 模板中，`@send` 会映射到与 `onSend` prop 相同的 listener key。如果你同时需要监听 `@send` 并接入模型服务，推荐使用 `adapter`。

## Slots

| Slot | 作用域 |
| --- | --- |
| `header` | `{ messages, active }` |
| `empty` | none |
| `avatar` | `{ message, index }` |
| `message` | `{ message, index, status }` |
| `message-content` | `{ message, index, status }` |
| `message-actions` | `{ message, index, status }` |
| `message-traces` | `{ message, index, traces }` |
| `message-trace` | `{ trace, message, index }` |
| `composer-prefix` | none |
| `composer-actions` | none |
| `footer` | `{ messages, active }` |

示例：

```vue
<AiChat :adapter="adapter">
  <template #avatar="{ message }">
    <span>{{ message.role === 'user' ? 'You' : 'AI' }}</span>
  </template>

  <template #message-content="{ message }">
    <p>{{ message.content }}</p>
  </template>

  <template #message-trace="{ trace }">
    <span>{{ trace.kind }}: {{ trace.title }}</span>
  </template>
</AiChat>
```

## 无头 Composable

当你只需要状态机而不使用默认 UI 时，可以使用 `useAiChat`。

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

`useAiChat` 返回：

- `messages`
- `isActive`
- `error`
- `send(prompt)`
- `stop()`
- `retry()`
- `clear()`
- `setMessages(messages)`

## 类型

```ts
export type AiChatRole = 'user' | 'assistant' | 'system' | 'error'
export type AiChatMessageStatus = 'pending' | 'streaming' | 'done' | 'error'
export type AiChatTraceKind = 'reasoning' | 'search' | 'tool' | 'source'
export type AiChatTraceStatus = 'pending' | 'done' | 'error'

export interface AiChatTrace {
  id: string
  kind: AiChatTraceKind
  title: string
  content?: string
  status?: AiChatTraceStatus
  items?: string[]
  createdAt?: number
  meta?: Record<string, unknown>
}

export interface AiChatMessage {
  id: string
  role: AiChatRole
  content: string
  status?: AiChatMessageStatus
  traces?: AiChatTrace[]
  createdAt?: number
  meta?: Record<string, unknown>
}
```

## 主题

引入一次样式文件：

```ts
import 'vue3-ai-chat/style.css'
```

在任意父级元素上覆盖 CSS 变量：

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

稳定 class 名称都使用 `ai-chat` 前缀，例如 `.ai-chat`、`.ai-chat__messages`、`.ai-chat__message--user` 和 `.ai-chat__composer`。

## Demo

运行本地 demo：

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/`。

demo 展示了受控消息、mock streaming adapter、停止、重试、清空、自定义 slots、公开过程 traces、运行时主题切换，以及一套 shadcn 风格变体。

## 开发

```bash
npm test
npm run typecheck
npm run build
```

构建会把库产物、CSS 和 TypeScript declaration 文件输出到 `dist/`。
