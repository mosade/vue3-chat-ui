# AiChat Headless 破坏性重构实施计划

> **给 agentic workers：** REQUIRED SUB-SKILL: 使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 将 `AiChat.vue` 从带默认产品外壳的聊天面板重构为 headless/headerless 的聊天状态与 slot 分发组件，并抽离可替换内容 parser，新增基础与 shadcn 风格 preset。

**架构：** `useAiChat` 继续作为 provider-neutral 状态机；`AiChat.vue` 使用 render function 顶层收集并调用 slots，负责连接状态、解析消息内容、组织 actions，并通过唯一 `message` slot 暴露消息渲染上下文。默认消息列表、消息卡片、输入框和样式降级为可单独导出的 building blocks 与 CSS presets，不再是核心组件的强绑定结构，也不再承担 slot 层层转发职责。

**技术栈：** Vue 3、TypeScript、Vite、Vitest、Vue Test Utils、vue-tsc、纯 CSS。

---

## 文件结构

- 修改 `src/types.ts`：新增 message phase、parser 类型、slot context 类型，移除旧 `markdown` API 的类型依赖。
- 新建 `src/parsers/plainText.ts`：默认安全纯文本 parser。
- 新建 `src/parsers/markdown.ts`：内置基础 markdown parser。
- 新建 `src/parsers/index.ts`：统一导出 parser。
- 修改 `src/utils/markdown.ts`：删除或迁移到 `src/parsers/markdown.ts`。
- 修改 `src/components/AiChat.vue`：重构为 render function 版本的 headless/root orchestrator，顶层收集并调度 5 个公开 slots：`header`、`empty`、`message`、`input`、`footer`。
- 修改 `src/components/ChatMessageList.vue`：作为独立 list building block，供用户单独使用；`AiChat` 自身在顶层维护列表 viewport 与滚动状态，不依赖它转发 slots。
- 修改 `src/components/ChatMessage.vue`：作为独立 message building block，只根据 props 渲染默认结构，不承载核心 slot 协议。
- 修改 `src/components/ChatComposer.vue`：作为默认 input building block，暴露 draft 与 actions。
- 删除或重构 `src/components/ChatToolbar.vue`：不再作为 `AiChat` 固定内置部分。
- 修改 `src/components/AiChat.spec.ts`：删除旧兼容断言，改测新 headless slot、parser、actions、顶层 slot 调度。
- 修改 `src/components/ChatMessageList.spec.ts`：覆盖新的 list building block 行为。
- 修改 `src/composables/useAiChat.ts`：按需补齐 action 返回值与类型，不处理 UI。
- 修改 `src/composables/useAiChat.test.ts`：确保状态机在 UI 重构后仍独立通过。
- 新建 `src/parsers/*.test.ts`：覆盖 plain text 与 markdown parser。
- 修改 `src/style.css`：改为 base preset，不再由包入口自动强制导入。
- 新建 `src/presets/shadcn.css`：提供 shadcn 风格 class/token preset。
- 修改 `src/index.ts`：导出新类型、parser、building blocks；移除自动 `import './style.css'`。
- 修改 `package.json`：新增 CSS preset exports。
- 修改 `README.md`：重写为新破坏性 API 文档。
- 修改 `demo/App.vue`、`demo/ShadcnDemo.vue`、`demo/style.css`：展示 headless slots 与 preset 用法。

---

## Task 1: 重置公开 API 和类型边界

**Files:**
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: 定义 parser 与 parsed content 类型**

在 `src/types.ts` 中新增主阶段与 parser 类型：

```ts
export type AiChatMessagePhase =
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

export type AiChatParsedContent =
  | {
      type: 'text'
      content: string
    }
  | {
      type: 'html'
      content: string
    }

export interface AiChatContentParserContext {
  message: AiChatMessage
}

export interface AiChatContentParser {
  parse: (content: string, context: AiChatContentParserContext) => AiChatParsedContent
}
```

同时给 `AiChatMessage` 增加：

```ts
phase?: AiChatMessagePhase
```

保留 `AiChatMessage.sources?: AiChatSource[]` 作为最终引用数据。`sources` 不属于过程状态，不放入 `traces`。

将 `AiChatTraceKind` 收敛为过程类型，去掉旧的 `'source'`：

```ts
export type AiChatTraceKind = 'reasoning' | 'search' | 'tool'
```

给 `AiChatSendContext` 增加：

```ts
setPhase: (phase: AiChatMessagePhase) => void
```

- [ ] **Step 2: 定义核心 slot action 类型**

在 `src/types.ts` 中新增：

```ts
export interface AiChatRootActions {
  send: (prompt: string) => Promise<void>
  stop: () => void
  clear: () => void
}

export interface AiChatMessageActions {
  copy: () => Promise<void>
  retry: () => Promise<AiChatRegeneratePayload | null>
  regenerate: () => Promise<AiChatRegeneratePayload | null>
}

export interface AiChatMessageEditActions {
  start: () => void
  update: (value: string) => void
  save: () => Promise<void>
  cancel: () => void
}

export interface AiChatInputActions {
  updateDraft: (value: string) => void
  send: () => Promise<void>
  stop: () => void
  focus: () => void
}
```

- [ ] **Step 3: 定义新的 slot context 类型**

在 `src/types.ts` 中新增：

```ts
export interface AiChatRootSlotContext {
  messages: AiChatMessage[]
  active: boolean
  disabled: boolean
  error: AiChatError | null
  showJumpToLatest: boolean
  isNearBottom: boolean
  jumpToLatest: () => void
  actions: AiChatRootActions
}

export interface AiChatMessageSlotContext {
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

export interface AiChatInputSlotContext {
  draft: string
  canSend: boolean
  active: boolean
  disabled: boolean
  actions: AiChatInputActions
}
```

- [ ] **Step 4: 调整 package CSS exports**

在 `package.json` 中将 CSS exports 改成显式 preset：

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/vue3-ai-chat.js",
    "require": "./dist/vue3-ai-chat.umd.cjs"
  },
  "./base.css": "./dist/style.css",
  "./shadcn.css": "./dist/shadcn.css"
}
```

- [ ] **Step 5: 更新 `src/index.ts` 导出**

`src/index.ts` 不再自动导入 CSS，导出类型、parser、组件和 composable：

```ts
export type {
  AiChatAdapter,
  AiChatContentParser,
  AiChatContentParserContext,
  AiChatError,
  AiChatMessage,
  AiChatMessageActions,
  AiChatMessageEditActions,
  AiChatMessagePhase,
  AiChatMessageSlotContext,
  AiChatMessageStatus,
  AiChatInputActions,
  AiChatInputSlotContext,
  AiChatParsedContent,
  AiChatRegeneratePayload,
  AiChatRole,
  AiChatRootActions,
  AiChatRootSlotContext,
  AiChatSendContext,
  AiChatSource,
  AiChatTrace,
  AiChatTraceKind,
  AiChatTraceStatus
} from './types'
export { useAiChat } from './composables/useAiChat'
export type { UseAiChatOptions, UseAiChatReturn } from './composables/useAiChat'
export { markdownParser, plainTextParser } from './parsers'
export { default as AiChat } from './components/AiChat.vue'
export { default as ChatComposer } from './components/ChatComposer.vue'
export { default as ChatMessage } from './components/ChatMessage.vue'
export { default as ChatMessageList } from './components/ChatMessageList.vue'
export { default } from './components/AiChat.vue'
```

- [ ] **Step 6: 运行类型检查确认当前失败点**

Run: `npm run typecheck`

Expected: FAIL，失败点应集中在 parser 文件未创建、旧 `markdown` prop 仍存在、CSS preset export 产物未配置等后续任务会处理的问题。

---

## Task 2: 抽离 parser 层

**Files:**
- Create: `src/parsers/plainText.ts`
- Create: `src/parsers/markdown.ts`
- Create: `src/parsers/index.ts`
- Create: `src/parsers/plainText.test.ts`
- Create: `src/parsers/markdown.test.ts`
- Delete or replace: `src/utils/markdown.ts`

- [ ] **Step 1: 写 plain text parser 测试**

创建 `src/parsers/plainText.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { plainTextParser } from './plainText'
import type { AiChatMessage } from '../types'

const message: AiChatMessage = {
  id: 'm1',
  role: 'assistant',
  content: '',
  status: 'done'
}

describe('plainTextParser', () => {
  it('returns plain text content without producing html', () => {
    expect(
      plainTextParser.parse('<strong>Hello</strong>', { message })
    ).toEqual({
      type: 'text',
      content: '<strong>Hello</strong>'
    })
  })
})
```

- [ ] **Step 2: 写 markdown parser 测试**

创建 `src/parsers/markdown.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { markdownParser } from './markdown'
import type { AiChatMessage } from '../types'

const message: AiChatMessage = {
  id: 'm1',
  role: 'assistant',
  content: '',
  status: 'done'
}

describe('markdownParser', () => {
  it('renders safe basic markdown to html', () => {
    const parsed = markdownParser.parse(
      '**Bold** and `code`\n[Vue](https://vuejs.org)',
      { message }
    )

    expect(parsed.type).toBe('html')
    expect(parsed.content).toContain('<strong>Bold</strong>')
    expect(parsed.content).toContain('<code>code</code>')
    expect(parsed.content).toContain('href="https://vuejs.org"')
    expect(parsed.content).toContain('<br>')
  })

  it('escapes unsafe html and blocks unsafe links', () => {
    const parsed = markdownParser.parse(
      '<img src=x onerror=alert(1)> [bad](javascript:alert(1))',
      { message }
    )

    expect(parsed.content).toContain('&lt;img')
    expect(parsed.content).not.toContain('<img')
    expect(parsed.content).not.toContain('javascript:')
  })
})
```

- [ ] **Step 3: 运行 parser 测试确认失败**

Run: `npm test -- src/parsers/plainText.test.ts src/parsers/markdown.test.ts`

Expected: FAIL，因为 parser 文件尚未实现。

- [ ] **Step 4: 实现 plain text parser**

创建 `src/parsers/plainText.ts`：

```ts
import type { AiChatContentParser } from '../types'

export const plainTextParser: AiChatContentParser = {
  parse: (content) => ({
    type: 'text',
    content
  })
}
```

- [ ] **Step 5: 实现 markdown parser**

将 `src/utils/markdown.ts` 的安全转义逻辑迁移到 `src/parsers/markdown.ts`，并返回 `{ type: 'html', content }`：

```ts
import type { AiChatContentParser } from '../types'

const escapeHtml = (content: string) =>
  content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeAttribute = (content: string) => escapeHtml(content).replace(/`/g, '&#96;')

const isSafeUrl = (url: string) => /^(https?:|mailto:)/i.test(url)

export const markdownParser: AiChatContentParser = {
  parse: (content) => {
    const escaped = escapeHtml(content)

    return {
      type: 'html',
      content: escaped
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label: string, rawUrl: string) => {
          const url = rawUrl.replace(/&amp;/g, '&')

          if (!isSafeUrl(url)) {
            return label
          }

          return `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${label}</a>`
        })
        .replace(/\n/g, '<br>')
    }
  }
}
```

- [ ] **Step 6: 创建 parser barrel export**

创建 `src/parsers/index.ts`：

```ts
export { markdownParser } from './markdown'
export { plainTextParser } from './plainText'
```

- [ ] **Step 7: 删除旧 markdown 工具或停止引用**

如果 `src/utils/markdown.ts` 已无引用，删除该文件；如果保留，文件中只 re-export `markdownParser`，不再作为组件内置工具使用。

- [ ] **Step 8: 运行 parser 测试**

Run: `npm test -- src/parsers/plainText.test.ts src/parsers/markdown.test.ts`

Expected: PASS。

---

## Task 3: 补齐 `useAiChat` phase 状态机

**Files:**
- Modify: `src/composables/useAiChat.ts`
- Modify: `src/composables/useAiChat.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: 写 phase 流程测试**

在 `src/composables/useAiChat.test.ts` 新增测试，覆盖“连接中 -> 搜索 -> 思考 -> 输出 -> 完成”的完整状态链路：

```ts
it('exposes assistant message phases, process traces, and final sources separately', async () => {
  const phases: string[] = []
  const chat = useAiChat({
    onSend: async ({ setPhase, appendTrace, updateTrace, update, append }) => {
      setPhase('connecting')
      phases.push('connecting')

      const searchId = appendTrace({
        kind: 'search',
        title: '搜索资料',
        status: 'pending'
      })
      setPhase('searching')
      phases.push('searching')
      updateTrace(searchId, { status: 'done' })

      const reasoningId = appendTrace({
        kind: 'reasoning',
        title: '思考中',
        status: 'pending'
      })
      setPhase('reasoning')
      phases.push('reasoning')
      updateTrace(reasoningId, { status: 'done' })

      setPhase('answering')
      phases.push('answering')
      update({
        sources: [
          {
            id: 'vue-docs',
            title: 'Vue Documentation',
            url: 'https://vuejs.org',
            snippet: 'Vue official docs.'
          }
        ]
      })
      append('最终回答')
    }
  })

  await chat.send('帮我搜索并总结')

  const assistant = chat.messages.value.at(-1)

  expect(phases).toEqual(['connecting', 'searching', 'reasoning', 'answering'])
  expect(assistant).toMatchObject({
    role: 'assistant',
    phase: 'done',
    status: 'done',
    content: '最终回答'
  })
  expect(assistant?.traces).toMatchObject([
    { kind: 'search', title: '搜索资料', status: 'done' },
    { kind: 'reasoning', title: '思考中', status: 'done' }
  ])
  expect(assistant?.sources).toMatchObject([
    {
      id: 'vue-docs',
      title: 'Vue Documentation',
      url: 'https://vuejs.org'
    }
  ])
})
```

- [ ] **Step 2: 写 stopped/error phase 测试**

新增测试，确保停止和错误会同步 phase：

```ts
it('sets stopped and error phases for aborted or failed requests', async () => {
  const failed = useAiChat({
    onSend: async ({ setPhase }) => {
      setPhase('connecting')
      throw new Error('Network failed')
    }
  })

  await failed.send('fail')

  expect(failed.messages.value.at(-1)).toMatchObject({
    status: 'error',
    phase: 'error',
    content: 'Network failed'
  })
})
```

- [ ] **Step 3: 运行 composable 测试确认失败**

Run: `npm test -- src/composables/useAiChat.test.ts`

Expected: FAIL，因为 `setPhase` 尚未实现。

- [ ] **Step 4: 实现 `setPhase` helper**

在 `useAiChat.ts` 中新增：

```ts
const setMessagePhase = (id: string, phase: AiChatMessagePhase) => {
  updateMessage(id, { phase })
}
```

并在 `AiChatSendContext` 中传入：

```ts
setPhase: (phase) => setMessagePhase(assistantId, phase)
```

- [ ] **Step 5: 设置默认 phase 转换**

在 `send` 创建 assistant placeholder 时设置：

```ts
const assistantMessage: AiChatMessage = {
  id: createId(),
  role: 'assistant',
  content: '',
  status: 'pending',
  phase: 'queued',
  traces: [],
  createdAt: Date.now()
}
```

进入请求时，如果 adapter 没主动设置 phase，则先更新为：

```ts
updateMessage(assistantId, { phase: 'connecting' })
```

当 `append(chunk)` 首次写入正文时，将 phase 设置为：

```ts
phase: 'answering'
```

请求成功结束时设置：

```ts
updateMessage(assistantId, { status: 'done', phase: 'done' })
```

错误和停止分别设置：

```ts
updateMessage(assistantId, { status: 'error', phase: 'error' })
updateMessage(assistantId, { status: 'stopped', phase: 'stopped' })
```

- [ ] **Step 6: 保持 traces 表达细节，phase 表达主阶段**

`appendTrace` / `updateTrace` 继续只负责过程条目，不自动推断 phase。adapter 可以在追加 trace 前后主动调用 `setPhase('searching')`、`setPhase('tool_calling')`、`setPhase('reasoning')`。

`sources` 表达最终引用/出处，只通过 `update({ sources })` 写入 assistant message，不通过 `appendTrace` 写入。不要再使用 `trace.kind = 'source'`。

- [ ] **Step 7: 运行 composable 测试**

Run: `npm test -- src/composables/useAiChat.test.ts`

Expected: PASS。

---

## Task 4: 重构 `AiChat.vue` 为 headless slot 分发组件

**Files:**
- Modify: `src/components/AiChat.vue`
- Modify: `src/components/AiChat.spec.ts`

- [ ] **Step 0: 固定对外 slot 协议**

`AiChat` 最终只暴露 5 个顶层 slots：

- `header`
- `empty`
- `message`
- `input`
- `footer`

不要暴露 `message-list`、`message-content`、`user-message`、`assistant-message`、`system-message`、`error-message`。消息差异由唯一的 `message` slot 根据 `message.role` 自行分支处理。

- [ ] **Step 1: 写新的 headless slot 测试**

重写 `src/components/AiChat.spec.ts` 中与 UI 兼容相关的测试，新增断言。测试里的 slots 可以继续用 Vue Test Utils 的模板字符串，因为这是消费者用法测试；实现文件 `AiChat.vue` 不允许写 template：

```ts
it('distributes root state and actions through slots', async () => {
  const wrapper = mount(AiChat, {
    props: {
      defaultMessages: [
        { id: 'a1', role: 'assistant', content: 'Hello', status: 'done' }
      ]
    },
    slots: {
      header:
        '<template #header="{ messages, active, actions }"><button class="clear" @click="actions.clear()">Clear {{ messages.length }} {{ active }}</button></template>',
      empty:
        '<template #empty="{ messages, active, disabled, actions }"><button class="empty-send" :disabled="disabled || active" @click="actions.send(\'Hello\')">Empty {{ messages.length }}</button></template>',
      input:
        '<template #input="{ draft, canSend, actions }"><input aria-label="Slot input" :value="draft" @input="actions.updateDraft($event.target.value)" /><button class="send" :disabled="!canSend" @click="actions.send()">Send</button></template>'
    }
  })

  expect(wrapper.find('.clear').text()).toContain('1')
  await wrapper.find('.clear').trigger('click')
  expect(wrapper.find('.empty-send').text()).toContain('Empty 0')
})
```

- [ ] **Step 2: 写统一 message slot 顶层调度测试**

新增。该测试验证 `AiChat` 直接读取唯一的 `message` slot 并渲染，不依赖 `ChatMessageList` 或 `ChatMessage` 转发 slot；用户在 slot 内根据 `message.role` 分支：

```ts
it('renders the single message slot with parsed content and actions', () => {
  const wrapper = mount(AiChat, {
    props: {
      defaultMessages: [
        { id: 'u1', role: 'user', content: 'User text', status: 'done' },
        { id: 'a1', role: 'assistant', content: 'Assistant text', status: 'done' }
      ]
    },
    slots: {
      message:
        '<template #message="{ message, parsed }"><p :class="`message-card message-card--${message.role}`">{{ message.id }} {{ parsed.content }}</p></template>'
    }
  })

  expect(wrapper.find('.message-card--user').text()).toContain('u1 User text')
  expect(wrapper.find('.message-card--assistant').text()).toContain('a1 Assistant text')
})
```

- [ ] **Step 3: 写“不层层传递 slot”回归测试**

新增。通过 stubbing 默认 building blocks，证明 `AiChat` 在顶层就已经把用户 slot 渲染成 VNode，不要求子组件再声明同名 slots：

```ts
it('collects and renders the message slot at the AiChat root instead of forwarding it through child components', () => {
  const wrapper = mount(AiChat, {
    props: {
      defaultMessages: [
        { id: 'u1', role: 'user', content: 'Root user', status: 'done' },
        { id: 'a1', role: 'assistant', content: 'Root assistant', status: 'done' }
      ]
    },
    slots: {
      message:
        '<template #message="{ message }"><article :class="`root-message root-message--${message.role}`">{{ message.content }}</article></template>'
    },
    global: {
      stubs: {
        ChatMessageList: {
          props: ['messages'],
          template: '<section class="stub-list"><slot /></section>'
        },
        ChatMessage: {
          template: '<article class="stub-message">fallback</article>'
        }
      }
    }
  })

  expect(wrapper.find('.root-message--user').text()).toBe('Root user')
  expect(wrapper.find('.root-message--assistant').text()).toBe('Root assistant')
  expect(wrapper.find('.stub-message').exists()).toBe(false)
})
```

- [ ] **Step 4: 写 parser prop 测试**

新增：

```ts
it('uses the parser prop before rendering message slots', () => {
  const wrapper = mount(AiChat, {
    props: {
      parser: {
        parse: (content: string) => ({ type: 'html', content: `<strong>${content}</strong>` })
      },
      defaultMessages: [
        { id: 'a1', role: 'assistant', content: 'Parsed', status: 'done' }
      ]
    },
    slots: {
      message:
        '<template #message="{ parsed }"><div class="parsed" v-html="parsed.content" /></template>'
    }
  })

  expect(wrapper.find('.parsed strong').text()).toBe('Parsed')
})
```

- [ ] **Step 5: 写编辑态和编辑后重新生成测试**

新增：

```ts
it('exposes edit state and edit actions through the message slot', async () => {
  const send = vi
    .fn()
    .mockResolvedValueOnce('Original answer')
    .mockResolvedValueOnce('Edited answer')
  const wrapper = mount(AiChat, {
    props: {
      adapter: { send }
    },
    slots: {
      message:
        '<template #message="{ message, editing, editDraft, canSaveEdit, editActions }"><div><p>{{ message.content }}</p><input v-if="editing" aria-label="Edit draft" :value="editDraft" @input="editActions.update($event.target.value)" /><button v-if="message.role === \'user\' && !editing" class="edit" @click="editActions.start()">Edit</button><button v-if="editing" class="save" :disabled="!canSaveEdit" @click="editActions.save()">Save</button></div></template>',
      input:
        '<template #input="{ actions }"><button class="send" @click="actions.updateDraft(\'Original prompt\'); actions.send()">Send</button></template>'
    }
  })

  await wrapper.find('.send').trigger('click')
  await flushPromises()
  await wrapper.find('.edit').trigger('click')
  await wrapper.find('[aria-label="Edit draft"]').setValue('Edited prompt')
  await wrapper.find('.save').trigger('click')
  await flushPromises()

  expect(send).toHaveBeenCalledTimes(2)
  expect(send.mock.calls[1][0].prompt).toBe('Edited prompt')
  expect(wrapper.text()).toContain('Edited answer')
})
```

- [ ] **Step 6: 写滚动状态 context 测试**

新增：

```ts
it('exposes top-level scroll state and jump action to root slots', async () => {
  const wrapper = mount(AiChat, {
    props: {
      defaultMessages: [
        { id: 'a1', role: 'assistant', content: 'One', status: 'done' }
      ]
    },
    slots: {
      header:
        '<template #header="{ showJumpToLatest, isNearBottom, jumpToLatest }"><button class="jump" @click="jumpToLatest()">{{ showJumpToLatest }} {{ isNearBottom }}</button></template>'
    }
  })

  expect(wrapper.find('.jump').exists()).toBe(true)
})
```

- [ ] **Step 7: 运行组件测试确认失败**

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: FAIL，因为 `parser` prop、`input` slot、统一 `message` slot、编辑态和滚动状态尚未实现。

- [ ] **Step 8: 将 `AiChat.vue` 改为 render function 组件**

`AiChat.vue` 使用普通 `<script lang="ts">`，通过 `defineComponent` 的 `setup(_, { slots, emit })` 返回 render 函数；不要写 `<template>`，不要在子组件里转发顶层 slots。

文件骨架：

```ts
import { computed, defineComponent, h, ref, toRef, type PropType, type VNodeChild } from 'vue'
import ChatComposer from './ChatComposer.vue'
import ChatMessage from './ChatMessage.vue'
import { useAiChat } from '../composables/useAiChat'
import { plainTextParser } from '../parsers'
import type {
  AiChatAdapter,
  AiChatContentParser,
  AiChatError,
  AiChatInputSlotContext,
  AiChatMessage,
  AiChatMessageSlotContext,
  AiChatRegeneratePayload,
  AiChatRootSlotContext,
  AiChatSendContext
} from '../types'

export default defineComponent({
  name: 'AiChat',
  props: {
    messages: Array as PropType<AiChatMessage[] | undefined>,
    defaultMessages: Array as PropType<AiChatMessage[] | undefined>,
    input: String,
    defaultInput: {
      type: String,
      default: ''
    },
    conversationId: String,
    adapter: Object as PropType<AiChatAdapter | undefined>,
    sendHandler: Function as PropType<((context: AiChatSendContext) => Promise<string | void>) | undefined>,
    onPersist: Function as PropType<
      | ((
          messages: AiChatMessage[],
          context: {
            conversationId?: string
            reason: 'send' | 'stop' | 'regenerate' | 'retry' | 'edit' | 'clear' | 'set'
          }
        ) => void)
      | undefined
    >,
    loading: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    autoFocus: {
      type: Boolean,
      default: false
    },
    autoScroll: {
      type: Boolean,
      default: true
    },
    parser: {
      type: Object as PropType<AiChatContentParser>,
      default: () => plainTextParser
    }
  },
  emits: ['update:messages', 'update:input', 'send', 'stop', 'regenerate', 'clear', 'error'],
  setup(props, { emit, slots }) {
    // 后续步骤在这里实现状态、context factories 和 render helpers。
    return () => h('div')
  }
})
```

- [ ] **Step 9: 替换 `AiChat.vue` props**

`AiChat.vue` 保留状态与行为 props：

```ts
messages?: AiChatMessage[]
defaultMessages?: AiChatMessage[]
input?: string
defaultInput?: string
conversationId?: string
adapter?: AiChatAdapter
sendHandler?: (context: AiChatSendContext) => Promise<string | void>
onPersist?: (
  messages: AiChatMessage[],
  context: {
    conversationId?: string
    reason: 'send' | 'stop' | 'regenerate' | 'retry' | 'edit' | 'clear' | 'set'
  }
) => void
loading?: boolean
disabled?: boolean
autoFocus?: boolean
autoScroll?: boolean
parser?: AiChatContentParser
```

删除旧 `placeholder` 与 `markdown` props；placeholder 由 input slot 或 `ChatComposer` building block 自己处理。

- [ ] **Step 10: 实现 root slot context**

在 `AiChat.vue` 中创建：

```ts
const viewportRef = ref<HTMLElement | null>(null)
const showJumpToLatest = ref(false)
const isNearBottom = ref(true)
const bottomThreshold = 48

const updateScrollState = () => {
  const element = viewportRef.value
  if (!element) {
    isNearBottom.value = true
    showJumpToLatest.value = false
    return
  }

  isNearBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight <= bottomThreshold
  showJumpToLatest.value = !isNearBottom.value
}

const jumpToLatest = () => {
  const element = viewportRef.value
  if (!element) {
    return
  }

  element.scrollTop = element.scrollHeight
  isNearBottom.value = true
  showJumpToLatest.value = false
}

const rootActions = {
  send: submit,
  stop,
  clear
}

const getRootContext = (): AiChatRootSlotContext => ({
  messages: chat.messages.value,
  active: isBusy.value,
  disabled: isDisabled.value,
  error: chat.error.value,
  showJumpToLatest: showJumpToLatest.value,
  isNearBottom: isNearBottom.value,
  jumpToLatest,
  actions: rootActions
})
```

`header`、`empty`、`footer` 都使用 `getRootContext()`。这样空态也能拿到 `messages`、`active`、`disabled`、`error`、滚动状态和 root actions，用于推荐问题、快速发送、清空等 UI。

- [ ] **Step 11: 实现 controlled/uncontrolled input draft**

将输入草稿状态上移到 `AiChat.vue`，供 `input` slot 与默认 `ChatComposer` fallback 共用：

```ts
const internalDraft = ref(props.defaultInput)
const isInputControlled = computed(() => props.input !== undefined)
const draft = computed({
  get: () => (isInputControlled.value ? props.input ?? '' : internalDraft.value),
  set: (value: string) => {
    if (!isInputControlled.value) {
      internalDraft.value = value
    }

    emit('update:input', value)
  }
})
const canSend = computed(() => Boolean(draft.value.trim()) && !isDisabled.value && !isBusy.value)
```

- [ ] **Step 12: 实现 input slot actions**

在 `AiChat.vue` 中创建：

```ts
const inputActions = {
  updateDraft: (value: string) => {
    draft.value = value
  },
  send: async () => {
    const prompt = draft.value.trim()
    if (!prompt || !canSend.value) {
      return
    }

    draft.value = ''
    await submit(prompt)
  },
  stop,
  focus: () => composerRef.value?.focus()
}
```

- [ ] **Step 13: 实现编辑态状态与 actions**

编辑态由 `AiChat` 顶层维护，并通过 `message` slot 暴露：

```ts
const editingMessageId = ref<string | null>(null)
const editDraft = ref('')

const startEdit = (message: AiChatMessage) => {
  if (message.role !== 'user' || isDisabled.value || isBusy.value) {
    return
  }

  editingMessageId.value = message.id
  editDraft.value = message.content
}

const updateEditDraft = (value: string) => {
  editDraft.value = value
}

const cancelEdit = () => {
  editingMessageId.value = null
  editDraft.value = ''
}

const saveEdit = async (message: AiChatMessage) => {
  if (!canSaveEdit.value || editingMessageId.value !== message.id) {
    return
  }

  await chat.editUserMessage(message.id, editDraft.value)
  cancelEdit()
}

const canSaveEdit = computed(() =>
  Boolean(editDraft.value.trim()) && !isDisabled.value && !isBusy.value
)
```

- [ ] **Step 14: 实现 message slot context factory**

在 `AiChat.vue` 中创建：

```ts
const getMessageContext = (message: AiChatMessage, index: number): AiChatMessageSlotContext => ({
  message,
  index,
  parsed: props.parser.parse(message.content, { message }),
  phase: message.phase,
  status: message.status,
  traces: message.traces ?? [],
  sources: message.sources ?? [],
  active: isBusy.value,
  disabled: isDisabled.value,
  editing: editingMessageId.value === message.id,
  editDraft: editingMessageId.value === message.id ? editDraft.value : '',
  canSaveEdit: editingMessageId.value === message.id && canSaveEdit.value,
  canRetry: chat.canRetry(message),
  canRegenerate: chat.canRegenerate(message),
  actions: {
    copy: () => copyMessage(message),
    retry: () => retry(message),
    regenerate: () => regenerate(message)
  },
  editActions: {
    start: () => startEdit(message),
    update: updateEditDraft,
    save: () => saveEdit(message),
    cancel: cancelEdit
  }
})
```

- [ ] **Step 15: 实现顶层 slot 收集和 render helpers**

在 `AiChat.vue` 中实现纯 render function。`slots` 只在 `AiChat` 顶层读取；不要把 `header`、`footer`、`empty`、`message`、`input` 等 slot 继续传给 `ChatMessageList` 或 `ChatMessage`。`message-list`、`message-content` 和 role-specific message slots 不存在。

```ts
const renderFallbackMessage = (context: AiChatMessageSlotContext) =>
  h(ChatMessage, context)

const renderMessage = (message: AiChatMessage, index: number): VNodeChild => {
  const context = getMessageContext(message, index)

  if (slots.message) {
    return slots.message(context)
  }

  return renderFallbackMessage(context)
}

const renderMessages = (): VNodeChild => {
  const context = getRootContext()

  if (chat.messages.value.length === 0) {
    return h('section', {
      ref: viewportRef,
      class: 'ai-chat__messages',
      'aria-live': 'polite',
      onScroll: updateScrollState
    }, [
      h('div', { class: 'ai-chat__empty' }, slots.empty?.(context) ?? 'Start a conversation')
    ])
  }

  return h('section', {
    ref: viewportRef,
    class: 'ai-chat__messages',
    'aria-live': 'polite',
    onScroll: updateScrollState
  }, chat.messages.value.map(renderMessage))
}

const renderInput = (): VNodeChild => {
  const context: AiChatInputSlotContext = {
    draft: draft.value,
    canSend: canSend.value,
    active: isActive.value,
    disabled: isDisabled.value || isBusy.value,
    actions: inputActions
  }

  if (slots.input) {
    return slots.input(context)
  }

  return h(ChatComposer, {
    ref: composerRef,
    input: draft.value,
    disabled: context.disabled,
    active: isActive.value,
    autoFocus: props.autoFocus,
    'onUpdate:input': (value: string) => {
      draft.value = value
    },
    onSubmit: submit,
    onStop: stop
  })
}

return () => {
  const context = getRootContext()

  return h('div', {
    class: 'ai-chat',
    'aria-busy': isBusy.value
  }, [
    slots.header?.(context),
    renderMessages(),
    renderInput(),
    slots.footer?.(context)
  ])
}
```

默认路径由 `AiChat` 自己 map 消息并生成节点，不经过子组件 slot 转发。滚动状态也由 `AiChat` 顶层维护并通过 root context 暴露，不依赖 `ChatMessageList` 内部状态。

- [ ] **Step 16: 运行组件测试**

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: PASS。

---

## Task 5: 调整默认 building blocks

**Files:**
- Modify: `src/components/ChatMessageList.vue`
- Modify: `src/components/ChatMessage.vue`
- Modify: `src/components/ChatComposer.vue`
- Delete or detach: `src/components/ChatToolbar.vue`
- Modify: `src/components/ChatMessageList.spec.ts`

- [ ] **Step 1: 改造 `ChatMessageList.vue` 为可选 list building block**

组件只作为单独导出的 list building block，负责 list viewport、empty、auto-scroll、jump-to-latest。它可以保留一个内部默认 slot 作为普通 Vue 组件扩展点，但这不是 `AiChat` 的公开 slot 协议；`AiChat` 不把自己的 slots 传给它，也不依赖它维护顶层滚动状态：

```vue
<template>
  <div class="ai-chat__messages-wrap">
    <section ref="viewport" class="ai-chat__messages" aria-live="polite">
      <slot
        name="list"
        :messages="messages"
        :show-jump-to-latest="showJumpToLatest"
        :jump-to-latest="scrollToLatest"
      >
        <div v-if="messages.length === 0" class="ai-chat__empty">
          <slot name="empty">Start a conversation</slot>
        </div>

        <slot
          v-for="(message, index) in messages"
          name="message"
          :message="message"
          :index="index"
        />
      </slot>
    </section>

    <button
      v-if="showJumpToLatest"
      class="ai-chat__jump-to-latest ai-chat__button ai-chat__button--secondary"
      type="button"
      aria-label="Jump to latest message"
      @click="scrollToLatest"
    >
      New messages
    </button>
  </div>
</template>
```

- [ ] **Step 2: 改造 `ChatMessage.vue` props**

组件接收完整 message context，而不是自己计算 actions，也不接收临时 `content` prop：

```ts
defineProps<{
  message: AiChatMessage
  index: number
  parsed: AiChatParsedContent
  phase?: AiChatMessagePhase
  status?: AiChatMessageStatus
  traces?: AiChatTrace[]
  sources?: AiChatSource[]
  active?: boolean
  disabled?: boolean
  editing?: boolean
  editDraft?: string
  canSaveEdit?: boolean
  canRetry?: boolean
  canRegenerate?: boolean
  actions?: AiChatMessageActions
  editActions?: AiChatMessageEditActions
}>()
```

- [ ] **Step 3: 改造 `ChatMessage.vue` content 渲染**

默认内容根据 `parsed.type` 渲染：

```ts
const content = computed(() => {
  if (props.parsed.type === 'html') {
    return h('span', {
      class: 'ai-chat__content-html',
      innerHTML: props.parsed.content
    })
  }

  return props.parsed.content
})
```

`ChatMessage.vue` 不暴露 `message-content`、`message-actions`、`message-traces`、`message-trace`、`message-sources`、`message-source` 等旧核心 slot。需要完全自定义消息内容、过程、来源或操作时，消费者使用 `AiChat` 的唯一 `message` slot。

- [ ] **Step 3a: 清理旧 trace/source 残留**

`AiChatTraceKind` 删除 `'source'` 后，`ChatMessage.vue` 里不能继续保留 `trace.kind` 的 `Source` fallback。过程展示只处理 `reasoning`、`search`、`tool`；最终引用只从 `sources` prop/message sources 渲染。

- [ ] **Step 4: 改造 `ChatComposer.vue` 为 input building block**

保留 textarea、Enter 提交、Shift+Enter 换行、active 时 stop。允许 `v-model:input`，默认 placeholder 放在该组件内部：

```ts
const props = withDefaults(
  defineProps<{
    input?: string
    defaultInput?: string
    disabled?: boolean
    active?: boolean
    placeholder?: string
    autoFocus?: boolean
  }>(),
  {
    input: undefined,
    defaultInput: '',
    disabled: false,
    active: false,
    placeholder: 'Ask anything...',
    autoFocus: false
  }
)
```

- [ ] **Step 5: 移除 `AiChat` 对 `ChatToolbar` 的固定依赖**

如果 `ChatToolbar.vue` 只剩 clear 按钮，删除文件并从测试与导出中移除。需要 clear 按钮的 demo 使用 `header` slot 通过 `actions.clear()` 实现。

- [ ] **Step 6: 更新 list 测试**

`src/components/ChatMessageList.spec.ts` 覆盖：

- empty slot 渲染。
- default slot 内容渲染。
- 新内容到达时 auto-scroll。
- 不在底部时显示 jump-to-latest。

- [ ] **Step 7: 运行 building block 测试**

Run: `npm test -- src/components/ChatMessageList.spec.ts src/components/AiChat.spec.ts`

Expected: PASS。

---

## Task 6: 拆分 base 与 shadcn CSS preset

**Files:**
- Modify: `src/style.css`
- Create: `src/presets/shadcn.css`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `demo/App.vue`
- Modify: `demo/ShadcnDemo.vue`
- Modify: `demo/style.css`

- [ ] **Step 1: 将 `src/style.css` 定义为 base preset**

保留稳定 class：

- `.ai-chat`
- `.ai-chat__messages-wrap`
- `.ai-chat__messages`
- `.ai-chat__empty`
- `.ai-chat__message`
- `.ai-chat__message--user`
- `.ai-chat__message--assistant`
- `.ai-chat__message--system`
- `.ai-chat__message--error`
- `.ai-chat__message-content`
- `.ai-chat__composer`
- `.ai-chat__composer-input`
- `.ai-chat__button`

CSS 不再假设 header、toolbar 必然存在。

- [ ] **Step 2: 新增 shadcn preset**

创建 `src/presets/shadcn.css`，使用 shadcn 风格 token 命名映射到 ai-chat class：

```css
.ai-chat--shadcn {
  --ai-chat-bg: hsl(0 0% 100%);
  --ai-chat-fg: hsl(222.2 84% 4.9%);
  --ai-chat-muted-fg: hsl(215.4 16.3% 46.9%);
  --ai-chat-border: hsl(214.3 31.8% 91.4%);
  --ai-chat-user-bg: hsl(222.2 47.4% 11.2%);
  --ai-chat-user-fg: hsl(210 40% 98%);
  --ai-chat-assistant-bg: hsl(210 40% 96.1%);
  --ai-chat-assistant-fg: hsl(222.2 84% 4.9%);
  --ai-chat-error-bg: hsl(0 84.2% 60.2% / 0.12);
  --ai-chat-error-fg: hsl(0 72.2% 50.6%);
  --ai-chat-radius: 8px;
}
```

继续补齐按钮、输入框、message card 的 shadcn 风格细节，但不引入 shadcn runtime 依赖。

- [ ] **Step 3: 配置构建复制 shadcn CSS**

在 `vite.config.ts` 中确保 `src/presets/shadcn.css` 会输出到 `dist/shadcn.css`。如果当前 Vite library build 只输出入口 CSS，则添加小型 copy plugin：

```ts
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const copyPresetCss = () => ({
  name: 'copy-preset-css',
  closeBundle() {
    mkdirSync(resolve(__dirname, 'dist'), { recursive: true })
    copyFileSync(
      resolve(__dirname, 'src/presets/shadcn.css'),
      resolve(__dirname, 'dist/shadcn.css')
    )
  }
})
```

并注册到 Vite 插件列表：

```ts
export default defineConfig({
  plugins: [vue(), copyPresetCss()],
  // ...
})
```

- [ ] **Step 4: 更新 demo 使用显式 CSS preset**

`demo/main.ts` 或 demo 入口显式导入：

```ts
import '../src/style.css'
import '../src/presets/shadcn.css'
```

- [ ] **Step 5: 更新 demo 为 slot-driven**

`demo/App.vue` 使用 `header` slot 放 clear、统计、变体切换；使用 `input` slot 或默认 `ChatComposer` building block；使用唯一 `message` slot 根据 `message.role` 展示不同卡片。

- [ ] **Step 6: 更新 shadcn demo**

`demo/ShadcnDemo.vue` 使用 `.ai-chat--shadcn` 根 class，并通过 slots 组合 shadcn 风格 UI。

- [ ] **Step 7: 运行构建**

Run: `npm run build`

Expected: PASS，`dist/style.css` 与 `dist/shadcn.css` 都存在。

---

## Task 7: 文档、验收和最终清理

**Files:**
- Modify: `README.md`
- Modify: `docs/refactor-map.md`
- Modify: `src/components/AiChat.spec.ts`
- Modify: `src/parsers/*.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: 重写 README 的基础用法**

README 应展示新用法：

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

- [ ] **Step 2: 明确破坏性变更**

README 增加 breaking changes：

- 删除 `markdown` prop，改用 `parser`。
- 删除固定 toolbar，改用 `header` 或自定义 slot 调用 `actions.clear()`。
- 删除 `placeholder` 作为 `AiChat` 顶层 prop；默认输入框 placeholder 属于 `ChatComposer`。
- 包入口不再自动导入 CSS；用户必须显式导入 `vue3-ai-chat/base.css` 或 `vue3-ai-chat/shadcn.css`。
- 消息卡片统一通过 `message` slot 自定义；按角色差异在 slot 内根据 `message.role` 分支。
- `AiChatTraceKind` 删除 `'source'`；过程信息走 `traces`，最终引用/出处走 `message.sources`。

- [ ] **Step 3: 更新 docs/refactor-map.md 状态**

将原始 4 条需求整理成已规划状态：

```md
# Refactor Map

- [x] AiChat.vue headerless/headless 重构计划
- [x] 头部、尾部、空状态、消息、输入 5 个顶层 slot 分发协议
- [x] 裸组件 + base/shadcn CSS preset 方案
- [x] parser 抽离与可替换 parser API
```

- [ ] **Step 4: 跑完整测试**

Run: `npm test`

Expected: PASS。

- [ ] **Step 5: 跑类型检查**

Run: `npm run typecheck`

Expected: PASS。

- [ ] **Step 6: 跑生产构建**

Run: `npm run build`

Expected: PASS。

- [ ] **Step 7: 检查公开导出**

Run: `npm run build`

Expected:

- `dist/index.d.ts` 包含 `AiChatContentParser`、`AiChatParsedContent`、`AiChatMessagePhase`、`AiChatInputSlotContext`、`AiChatInputActions`、`markdownParser`、`plainTextParser`。
- `dist/index.d.ts` 中 `AiChatTraceKind` 不再包含 `'source'`。
- `dist/style.css` 存在。
- `dist/shadcn.css` 存在。
- `dist/index.d.ts` 不再出现 `markdown?:`。

- [ ] **Step 8: 最终 git 检查**

Run: `git status --short`

Expected: 只包含本次重构相关文件变更。

---

## 验收标准

- `AiChat.vue` 不再内置 header、toolbar、固定 user/assistant message card。
- `AiChat.vue` 不再导入 `renderMarkdown` 或任何 markdown-specific 工具。
- 消息内容通过 `parser` prop 转换，默认使用 `plainTextParser`。
- `phase` 表达主阶段，`traces` 表达生成过程，`sources` 表达最终引用，三者不混用。
- `AiChatTraceKind` 只包含 `reasoning`、`search`、`tool`，不再包含 `source`。
- `AiChat` 只暴露 `header`、`empty`、`message`、`input`、`footer` 5 个顶层 slots。
- 用户可以通过 `message` slot 完全替换所有角色的消息卡片。
- 用户可以通过 `input` slot 完全替换输入区域。
- clear、send、stop、retry、regenerate、edit 等动作都通过 slot context 暴露。
- 包入口不自动引入 CSS。
- base preset 和 shadcn preset 可以单独导入。
- `npm test`、`npm run typecheck`、`npm run build` 全部通过。
