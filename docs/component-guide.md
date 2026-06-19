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

### 状态模型

`AiChat` 的状态分为几层：输入草稿、交互禁用、请求生命周期、消息状态、编辑状态和滚动状态。
自定义 slots 时建议按下面的语义使用，避免把 `active`、`disabled` 和消息 `status` 混在一起。

#### 输入草稿

| 状态 | 来源 | 说明 |
| --- | --- | --- |
| `draft` | `input` / `defaultInput` | 当前输入内容。传入 `input` 时为受控模式；否则由内部 `internalDraft` 维护，并以 `defaultInput` 初始化。 |
| `update:input` | `draft` setter | 每次草稿变化都会触发。受控模式下需要外部同步回写 `input`。 |
| `canSend` | `Boolean(draft.trim()) && !disabled && !busy` | 仅在有非空草稿、未禁用、且没有 busy 状态时为 `true`。 |

`input` slot 的 `actions.send()` 会读取并 trim 当前 `draft`，通过校验后先清空草稿，再触发发送。
如果直接调用 root slot 的 `actions.send(prompt)`，需要自己传入 prompt；它不会读取或清空 `draft`。

#### 交互状态

| 状态 | 出现场景 | 说明 |
| --- | --- | --- |
| `active` | root/header/empty/footer/message context | 等于 `loading || useAiChat().isActive`，表示当前界面处于 busy 状态。 |
| `active` | input context / `ChatComposer` | 等于 `useAiChat().isActive`，只表示内部请求正在进行；用于把 Send 按钮切换成 Stop。 |
| `disabled` | root/message context | 等于 `props.disabled`，表示外部禁用交互。 |
| `disabled` | input context / 默认 `ChatComposer` | 等于 `props.disabled || loading || isActive`，表示输入框和提交按钮不可用。 |
| `loading` | `AiChat` prop | 外部 busy 状态。它会禁用发送，但不会创建内部请求，也不会让 input slot 显示 Stop。 |
| `isActive` | `useAiChat` return | 当前是否存在内部 `activeRequest`。同一时间只支持一个请求。 |

因此：如果只想判断“能不能提交”，使用 `canSend`；如果想判断“要不要显示 Stop”，使用 input context
里的 `active`；如果想禁用消息操作，使用 message context 的 `disabled || active`。

#### 请求生命周期

`useAiChat` 用内部 `activeRequest` 保存当前请求的 `AbortController` 和 assistant message id。
请求生命周期如下：

| 操作 | 状态变化 |
| --- | --- |
| `send(prompt)` | prompt 为空或已有请求时直接返回；否则追加 user `done` 消息和 assistant `pending` / `queued` 消息。 |
| `runAssistantRequest` 开始 | 清空 `error`，创建 `activeRequest`，assistant `phase` 变为 `connecting`。 |
| `context.append(chunk)` | 追加 assistant 内容，并把 assistant `status` 设为 `streaming`、`phase` 设为 `answering`。 |
| `onSend` 返回字符串 | 如果当前内容非空则 append，否则直接写入 content。 |
| 正常完成 | assistant `status` 变为 `done`，`phase` 变为 `done`，清除 `activeRequest`。 |
| `stop()` | abort 当前请求，assistant `status` 变为 `stopped`，`phase` 变为 `stopped`，清除 `activeRequest`。 |
| 非 abort 错误 | 写入 `error`，assistant content 变为错误信息，`status` 变为 `error`，`phase` 变为 `error`。 |
| `clear()` | abort 当前请求，清空 `error` 和全部 messages。 |

没有 `adapter` / `sendHandler` 时，assistant 会从 `pending` 直接变成 `done`，不会产生流式内容。

#### 消息状态

`AiChatMessageStatus` 是面向 UI 的粗粒度状态：

| Status | 含义 | 默认 UI 表现 |
| --- | --- | --- |
| `pending` | assistant 消息已创建，等待请求或首个 chunk。 | 添加 sr-only 的 pending 提示。 |
| `streaming` | assistant 正在接收流式内容。 | `AiContent` 以 streaming 模式渲染，并显示 `Streaming`。 |
| `done` | 消息正常完成。 | 不显示额外状态文本。 |
| `error` | 请求失败或 adapter 显式更新为错误。 | 显示 `Error`，`canRetry` 可能为 true。 |
| `stopped` | 用户主动停止或请求被 abort。 | 保留已有内容，并显示 `Stopped`。 |

user 消息在发送和编辑保存后会被标记为 `done`。assistant 的 `retry` 只对 `error` 状态开放；
`regenerate` 对有前置 user 消息且当前没有内部请求的 assistant 消息开放。

#### 消息阶段

`AiChatMessagePhase` 是更细的过程状态，可用于自定义 loading 文案或步骤条：

| Phase | 典型来源 | 含义 |
| --- | --- | --- |
| `queued` | 创建 assistant 消息、retry、regenerate、edit | 已入队，尚未真正调用发送处理。 |
| `connecting` | `runAssistantRequest` 调用 `onSend` 前 | 正在建立请求。 |
| `waiting` | adapter 通过 `setPhase` 设置 | 等待模型或后端响应。 |
| `searching` | adapter 通过 `setPhase` 设置 | 检索资料中。 |
| `tool_calling` | adapter 通过 `setPhase` 设置 | 调用工具中。 |
| `reasoning` | adapter 通过 `setPhase` 设置 | 推理或思考中。 |
| `answering` | `append(chunk)` 或 adapter 设置 | 正在输出回答。 |
| `done` | 请求正常完成 | 已完成。 |
| `error` | 非 abort 错误 | 失败。 |
| `stopped` | `stop()` 或 abort | 已停止。 |

#### 编辑状态

| 状态 | 说明 |
| --- | --- |
| `editing` | 当前 message id 等于内部 `editingMessageId`。仅 user 消息可进入编辑。 |
| `editDraft` | 编辑中的临时文本；进入编辑时复制 user message 的 content。 |
| `canSaveEdit` | `Boolean(editDraft.trim()) && !disabled && !busy`，且只在当前编辑消息上为 true。 |

保存编辑会替换该 user 消息、截断其后的历史，并追加一个新的 assistant `pending` / `queued` 消息重新请求。

#### Trace 和滚动状态

| 状态 | 说明 |
| --- | --- |
| `trace.status` | `pending` / `done` / `error`，表示单个 reasoning/search/tool 步骤状态，不等同于消息请求状态。 |
| `showJumpToLatest` | 当前滚动位置离底部超过阈值时为 true，用于显示“跳到最新”。 |
| `isNearBottom` | 当前消息 viewport 是否接近底部。 |

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
