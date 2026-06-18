# vue3-ai-chat 组件详细指南

这份文档覆盖公开组件、props、事件、slots、hooks 和核心类型。README 适合作为快速入口；
需要集成或封装组件时，以本文档为 API 参考。

## 导出总览

```ts
import {
  AiChat,
  AiContent,
  ChatComposer,
  ChatMessage,
  ChatMessageList,
  markdownParser,
  plainTextParser,
  useAiChat
} from 'vue3-ai-chat'
```

类型从同一个入口导出：

```ts
import type {
  AiChatAdapter,
  AiChatMessage,
  AiChatSendContext,
  AiContentParser,
  AiChatRootSlotContext,
  AiChatMessageSlotContext,
  AiChatInputSlotContext,
  UseAiChatOptions,
  UseAiChatReturn
} from 'vue3-ai-chat'
```

## AiChat

`AiChat` 是默认聊天根组件。它负责消息状态、请求生命周期、输入草稿、编辑状态、
滚动状态和 slot 编排。

### Props

| Prop | Type | Default | 说明 |
| --- | --- | --- | --- |
| `messages` | `AiChatMessage[] \| undefined` | `undefined` | 受控消息列表。配合 `v-model:messages` 使用。 |
| `defaultMessages` | `AiChatMessage[] \| undefined` | `undefined` | 非受控模式下的初始消息。 |
| `input` | `string \| undefined` | `undefined` | 受控输入草稿。配合 `v-model:input` 使用。 |
| `defaultInput` | `string` | `''` | 非受控模式下的初始输入草稿。 |
| `conversationId` | `string \| undefined` | `undefined` | 透传给 `onPersist` 的会话标识。 |
| `adapter` | `AiChatAdapter \| undefined` | `undefined` | 请求适配器。`adapter.send(context)` 负责生成回复。 |
| `sendHandler` | `(context: AiChatSendContext) => Promise<string \| void>` | `undefined` | 直接传入发送函数。优先级高于 `adapter.send`。 |
| `onPersist` | `(messages, context) => void` | `undefined` | 消息变更后的持久化回调。 |
| `loading` | `boolean` | `false` | 外部 loading 状态，会参与禁用发送。 |
| `disabled` | `boolean` | `false` | 禁用交互。 |
| `autoFocus` | `boolean` | `false` | 默认输入框挂载后自动聚焦。 |
| `autoScroll` | `boolean` | `true` | 发送完成后自动滚动到底部。 |
| `contentParser` | `AiContentParser \| undefined` | `undefined` | 推荐的默认消息内容 parser。 |
| `parser` | `AiContentParser` | `plainTextParser` | 兼容入口；未提供 `contentParser` 时使用。 |

### Events

| Event | Payload | 触发时机 |
| --- | --- | --- |
| `update:messages` | `AiChatMessage[]` | 内部消息列表变化。 |
| `update:input` | `string` | 输入草稿变化。 |
| `send` | `prompt: string` | 用户触发发送时，调用请求前。 |
| `stop` | none | 用户触发停止时。 |
| `regenerate` | `AiChatRegeneratePayload` | 重新生成成功创建 payload 后。 |
| `clear` | none | 用户触发清空时。 |
| `error` | `(error: AiChatError, context)` | 请求抛出非 abort 错误时。 |

### Slots

`AiChat` 只有五个顶层 slots。默认 UI 可以完全被这些 slots 替换。

| Slot | Context | 用途 |
| --- | --- | --- |
| `header` | `AiChatRootSlotContext` | 顶部工具栏、标题、全局操作。 |
| `empty` | `AiChatRootSlotContext` | 空状态。 |
| `message` | `AiChatMessageSlotContext` | 单条消息渲染。 |
| `input` | `AiChatInputSlotContext` | 输入区。 |
| `footer` | `AiChatRootSlotContext` | 底部说明或状态。 |

#### Root slot context

```ts
interface AiChatRootSlotContext {
  messages: AiChatMessage[]
  active: boolean
  disabled: boolean
  error: AiChatError | null
  showJumpToLatest: boolean
  isNearBottom: boolean
  jumpToLatest: () => void
  actions: {
    send: (prompt: string) => Promise<void>
    stop: () => void
    clear: () => void
  }
}
```

#### Message slot context

```ts
interface AiChatMessageSlotContext {
  message: AiChatMessage
  index: number
  parsed: AiChatParsedContent
  phase?: AiChatMessagePhase
  status?: AiChatMessageStatus
  traces: AiChatTrace[]
  sources: AiChatSource[]
  active: boolean
  disabled: boolean
  editing: boolean
  editDraft: string
  canSaveEdit: boolean
  canRetry: boolean
  canRegenerate: boolean
  actions: AiChatMessageActions
  editActions: AiChatMessageEditActions
}
```

推荐在自定义 message slot 中显式使用 `AiContent`：

```vue
<template #message="{ message, status, actions }">
  <AiContent
    :content="message.content"
    :parser="markdownParser"
    :streaming="status === 'streaming'"
  />

  <button v-if="message.content" type="button" @click="actions.copy()">
    复制
  </button>
</template>
```

#### Input slot context

```ts
interface AiChatInputSlotContext {
  draft: string
  canSend: boolean
  active: boolean
  disabled: boolean
  actions: {
    updateDraft: (value: string) => void
    send: () => Promise<void>
    stop: () => void
    focus: () => void
  }
}
```

## AiContent

`AiContent` 是独立内容渲染组件。它只负责把原始字符串渲染成安全文本或 parser 返回的 HTML。

### Props

| Prop | Type | Default | 说明 |
| --- | --- | --- | --- |
| `content` | `string` | `''` | 原始文本内容。 |
| `parser` | `AiContentParser` | `plainTextParser` | 内容 parser。 |
| `streaming` | `boolean` | `false` | 是否处于流式输出中。 |

### 渲染策略

`AiContent` 会调用 `createAiContentBlocks(content, { streaming })`，把内容拆成：

- stable blocks：已完成内容块，解析结果会缓存。
- live block：流式尾部内容，只更新这一块。

这样可以避免每个 chunk 都重建整段 HTML。对图片尤其重要：完整图片 block 会用
`image:${url}:${alt}` 作为稳定 key，后续内容追加不会 remount 已有图片节点。

### Parser

```ts
interface AiContentParser {
  parse: (content: string, context: AiContentParserContext) => AiContentParsed
}

interface AiContentParserContext {
  streaming: boolean
  blockId?: string
  stable?: boolean
  kind?: AiContentBlockKind
  message?: AiChatMessage
}

type AiContentParsed =
  | { type: 'text'; content: string }
  | { type: 'html'; content: string }
```

接入 `markdown-it` 示例：

```ts
import MarkdownIt from 'markdown-it'
import type { AiContentParser } from 'vue3-ai-chat'

const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

export const parser: AiContentParser = {
  parse: (content) => ({
    type: 'html',
    content: markdownIt.render(content)
  })
}
```

## ChatComposer

默认输入组件，可单独使用。

### Props

| Prop | Type | Default | 说明 |
| --- | --- | --- | --- |
| `input` | `string \| undefined` | `undefined` | 受控输入。 |
| `defaultInput` | `string` | `''` | 非受控初始输入。 |
| `disabled` | `boolean` | `false` | 禁用输入和提交。 |
| `active` | `boolean` | `false` | 表示请求进行中，按钮切换为 Stop。 |
| `placeholder` | `string` | `'Ask anything...'` | textarea placeholder。 |
| `autoFocus` | `boolean` | `false` | 挂载后自动聚焦。 |

### Events

| Event | Payload | 说明 |
| --- | --- | --- |
| `update:input` | `string` | 输入变化。 |
| `submit` | `prompt: string` | 用户提交。Enter 提交，Shift+Enter 换行。 |
| `stop` | none | active 状态下点击 Stop。 |

### Slots

| Slot | Context | 说明 |
| --- | --- | --- |
| `prefix` | `{ draft, canSubmit, actions }` | 输入框前置区域。 |
| `actions` | `{ draft, canSubmit, actions }` | 自定义操作按钮区域。 |

`actions` 包含：

```ts
{
  submit: () => void
  stop: () => void
  focus: () => void
}
```

### Expose

```ts
{
  focus: () => void
  submit: () => void
}
```

## ChatMessage

默认消息组件，可单独使用，也作为 `AiChat` 默认 message fallback。

### Props

| Prop | Type | 说明 |
| --- | --- | --- |
| `message` | `AiChatMessage` | 当前消息。 |
| `index` | `number` | 消息索引。 |
| `parsed` | `AiChatParsedContent` | 兼容字段；默认内容实际由 `AiContent` 渲染。 |
| `contentParser` | `AiContentParser \| undefined` | 传给内部 `AiContent`。 |
| `phase` | `AiChatMessagePhase \| undefined` | 消息阶段。 |
| `status` | `AiChatMessageStatus \| undefined` | 消息状态。 |
| `traces` | `AiChatTrace[] \| undefined` | 过程信息。 |
| `sources` | `AiChatSource[] \| undefined` | 引用来源。 |
| `active` | `boolean \| undefined` | 当前是否有请求。 |
| `disabled` | `boolean \| undefined` | 是否禁用交互。 |
| `editing` | `boolean \| undefined` | 是否编辑中。 |
| `editDraft` | `string \| undefined` | 编辑草稿。 |
| `canSaveEdit` | `boolean \| undefined` | 是否可保存编辑。 |
| `canRetry` | `boolean \| undefined` | 是否可 retry。 |
| `canRegenerate` | `boolean \| undefined` | 是否可 regenerate。 |
| `actions` | `AiChatMessageActions \| undefined` | copy/retry/regenerate 操作。 |
| `editActions` | `AiChatMessageEditActions \| undefined` | start/update/save/cancel 编辑操作。 |

### Slots

| Slot | Context | 说明 |
| --- | --- | --- |
| `avatar` | `{ message, index }` | 自定义头像区域。 |

## ChatMessageList

轻量消息列表容器。适合自己组合 `ChatMessage` 或其他消息 UI。

### Props

| Prop | Type | Default | 说明 |
| --- | --- | --- | --- |
| `messages` | `AiChatMessage[]` | required | 消息列表。 |
| `autoScroll` | `boolean` | `true` | 消息变化时，如果当前位置接近底部则自动滚动。 |

### Slots

| Slot | Context | 说明 |
| --- | --- | --- |
| `list` | `{ messages, showJumpToLatest, jumpToLatest }` | 完全自定义列表。 |
| `empty` | none | 空状态。 |
| `message` | `{ message, index }` | 单条消息。 |

## useAiChat

`useAiChat` 是 headless 状态 hook。需要完全自定义 UI 时可以直接使用它。

### Options

```ts
interface UseAiChatOptions {
  conversationId?: string
  messages?: MaybeRef<AiChatMessage[] | undefined>
  defaultMessages?: AiChatMessage[]
  adapter?: AiChatAdapter
  onSend?: (context: AiChatSendContext) => Promise<string | void>
  onUpdateMessages?: (messages: AiChatMessage[]) => void
  onPersist?: (
    messages: AiChatMessage[],
    context: {
      conversationId?: string
      reason: 'send' | 'stop' | 'regenerate' | 'retry' | 'edit' | 'clear' | 'set'
    }
  ) => void
  onError?: (
    error: AiChatError,
    context: { prompt: string; messages: AiChatMessage[] }
  ) => void
}
```

### Return

```ts
interface UseAiChatReturn {
  messages: Ref<AiChatMessage[]>
  isActive: Ref<boolean>
  error: Ref<AiChatError | null>
  send: (prompt: string) => Promise<void>
  stop: () => void
  regenerate: (messageId: string) => Promise<AiChatRegeneratePayload | null>
  canRegenerate: (message: AiChatMessage) => boolean
  retry: (messageId: string) => Promise<AiChatRegeneratePayload | null>
  canRetry: (message: AiChatMessage) => boolean
  editUserMessage: (
    messageId: string,
    prompt: string
  ) => Promise<{ message: AiChatMessage; prompt: string; messages: AiChatMessage[] } | null>
  clear: () => void
  setMessages: (messages: AiChatMessage[]) => void
}
```

### Send context

adapter 或 `onSend` 会收到 `AiChatSendContext`：

```ts
interface AiChatSendContext {
  prompt: string
  messages: AiChatMessage[]
  signal: AbortSignal
  append: (chunk: string) => void
  update: (message: Partial<AiChatMessage>) => void
  setPhase: (phase: AiChatMessagePhase) => void
  appendTrace: (trace: Omit<AiChatTrace, 'id' | 'createdAt'> & Partial<Pick<AiChatTrace, 'id' | 'createdAt'>>) => string
  updateTrace: (id: string, trace: Partial<AiChatTrace>) => void
}
```

常见用法：

```ts
const adapter: AiChatAdapter = {
  async send({ prompt, append, setPhase, appendTrace, updateTrace, update, signal }) {
    setPhase('reasoning')
    const traceId = appendTrace({
      kind: 'reasoning',
      title: '分析问题',
      status: 'pending'
    })

    await fetch('/api/chat', { signal })
    updateTrace(traceId, { status: 'done' })

    setPhase('answering')
    append(`收到：${prompt}`)
    update({ sources: [{ id: 'docs', title: 'Docs' }] })
  }
}
```

## 核心类型

```ts
type AiChatRole = 'user' | 'assistant' | 'system' | 'error'

type AiChatMessageStatus = 'pending' | 'streaming' | 'done' | 'error' | 'stopped'

type AiChatMessagePhase =
  | 'queued'
  | 'connecting'
  | 'waiting'
  | 'searching'
  | 'tool_calling'
  | 'reasoning'
  | 'answering'
  | 'done'
  | 'error'
  | 'stopped'
```

```ts
interface AiChatMessage {
  id: string
  role: AiChatRole
  content: string
  status?: AiChatMessageStatus
  phase?: AiChatMessagePhase
  sources?: AiChatSource[]
  traces?: AiChatTrace[]
  createdAt?: number
  meta?: Record<string, unknown>
}
```

```ts
interface AiChatTrace {
  id: string
  kind: 'reasoning' | 'search' | 'tool'
  title: string
  content?: string
  status?: 'pending' | 'done' | 'error'
  items?: string[]
  createdAt?: number
  meta?: Record<string, unknown>
}
```

```ts
interface AiChatSource {
  id: string
  title: string
  url?: string
  snippet?: string
  index?: number
  meta?: Record<string, unknown>
}
```

## 样式

包入口不自动导入 CSS：

```ts
import 'vue3-ai-chat/base.css'
import 'vue3-ai-chat/shadcn.css'
```

如果完全自定义 UI，也可以不导入 preset，只使用 headless hook 和 slots。
