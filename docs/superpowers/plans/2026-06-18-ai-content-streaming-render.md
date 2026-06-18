# AiContent 流式内容渲染实施计划

> **给 agentic workers：** REQUIRED SUB-SKILL: 使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 新增独立 `AiContent` 内容组件，用原始文本输入实现可外置 parser、流式 block 复用、智能闭合和图片防闪烁，并让 `AiChat` 通过兼容 API 使用它。

**架构：** `AiContent` 是纯内容渲染组件，不依赖 chat message、role、adapter、traces 或 actions。它先把 `content` 拆成 stable blocks 和一个 live block，再对单个 block 调用外置 parser，缓存 stable block 的解析结果，并用稳定 key 避免图片 DOM 被重复 remount。`AiChat` 保持聊天状态和 slot 编排职责，`parser` 作为迁移期 legacy alias，新的明确入口为 `contentParser`。

**技术栈：** Vue 3、TypeScript、Vite、Vitest、Vue Test Utils、vue-tsc、纯 CSS。

---

## 文件结构

- 修改 `src/types.ts`：新增 `AiContent*` 类型、block 类型、parser 上下文；保留 `AiChat*Parser` 兼容类型。
- 新建 `src/content/blocks.ts`：负责将原始内容拆分为 stable blocks 和 live block，并处理代码块智能闭合、图片完整性识别、稳定 key。
- 新建 `src/content/blocks.test.ts`：覆盖 block 切分、代码块智能闭合、图片 block 稳定 key、未完成图片语法不创建 image block。
- 新建 `src/components/AiContent.vue`：独立内容渲染组件，负责 block 渲染、parser 调用和 stable block 缓存。
- 新建 `src/components/AiContent.spec.ts`：覆盖纯文本、外置 parser、stable block 缓存、图片节点不 remount。
- 修改 `src/components/ChatMessage.vue`：默认消息内容改用 `AiContent`，保留消息状态、traces、sources、actions UI。
- 修改 `src/components/AiChat.vue`：新增 `contentParser` prop，保留 `parser` legacy alias，并把 resolved parser 传给默认 `ChatMessage` fallback。
- 修改 `src/components/AiChat.spec.ts`：覆盖 `contentParser`、legacy `parser`、自定义 message slot 中显式使用 `AiContent`。
- 修改 `src/index.ts`：导出 `AiContent`、`AiContent*` 类型和 block helper 类型。
- 修改 `README.md`：补充 `AiContent` 用法、`contentParser` 迁移说明、图片防闪烁原理。
- 修改 `docs/refactor-map.md`：如果实施中类型命名发生变化，同步保持文档一致。

---

## Task 1: 定义 AiContent 类型边界

**Files:**
- Modify: `src/types.ts`
- Modify: `src/parsers/plainText.ts`
- Modify: `src/parsers/markdown.ts`
- Test: `src/parsers/plainText.test.ts`
- Test: `src/parsers/markdown.test.ts`

- [ ] **Step 1: 在 parser 测试中加入 AiContent 上下文用例**

在 `src/parsers/plainText.test.ts` 追加：

```ts
it('accepts ai content parser context without a message', () => {
  expect(
    plainTextParser.parse('Hello', {
      streaming: true,
      blockId: 'live:0',
      stable: false,
      kind: 'paragraph'
    })
  ).toEqual({
    type: 'text',
    content: 'Hello'
  })
})
```

在 `src/parsers/markdown.test.ts` 追加：

```ts
it('accepts ai content parser context without a message', () => {
  const parsed = markdownParser.parse('**Hello**', {
    streaming: true,
    blockId: 'live:0',
    stable: false,
    kind: 'paragraph'
  })

  expect(parsed).toEqual({
    type: 'html',
    content: '<strong>Hello</strong>'
  })
})
```

- [ ] **Step 2: 运行类型检查确认失败**

Run:

```bash
npm run typecheck
```

Expected: FAIL。TypeScript 应报告 parser context 缺少 `message`，因为当前 parser 类型仍然绑定 `AiChatContentParserContext`。

- [ ] **Step 3: 修改 `src/types.ts`，新增 AiContent 类型并保留 AiChat 兼容类型**

在 `src/types.ts` 中，将现有 `AiChatParsedContent`、`AiChatContentParserContext`、`AiChatContentParser` 调整为以下结构：

```ts
export type AiContentBlockKind = 'paragraph' | 'code' | 'image' | 'html'

export type AiContentParsed =
  | {
      type: 'text'
      content: string
    }
  | {
      type: 'html'
      content: string
    }

export interface AiContentParserContext {
  streaming: boolean
  blockId?: string
  stable?: boolean
  kind?: AiContentBlockKind
  message?: AiChatMessage
}

export interface AiContentParser {
  parse: (content: string, context: AiContentParserContext) => AiContentParsed
}

export interface AiContentBlock {
  id: string
  raw: string
  renderContent: string
  stable: boolean
  kind: AiContentBlockKind
}

export type AiChatParsedContent = AiContentParsed

export type AiChatContentParserContext = AiContentParserContext & {
  message: AiChatMessage
}

export type AiChatContentParser = AiContentParser
```

保留 `AiChatMessageSlotContext.parsed: AiChatParsedContent`，迁移期 custom slot 仍然可读 `parsed`。

- [ ] **Step 4: 更新 parser 文件使用新类型**

在 `src/parsers/plainText.ts` 中改成：

```ts
import type { AiContentParser } from '../types'

export const plainTextParser: AiContentParser = {
  parse: (content) => ({
    type: 'text',
    content
  })
}
```

在 `src/parsers/markdown.ts` 中将 import 改成：

```ts
import type { AiContentParser } from '../types'
```

并保持导出：

```ts
export const markdownParser: AiContentParser = {
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

- [ ] **Step 5: 运行 parser 测试确认通过**

Run:

```bash
npm test -- src/parsers/plainText.test.ts src/parsers/markdown.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交 Task 1**

```bash
git add src/types.ts src/parsers/plainText.ts src/parsers/markdown.ts src/parsers/plainText.test.ts src/parsers/markdown.test.ts
git commit -m "feat: add ai content parser types"
```

---

## Task 2: 实现流式 block 切分工具

**Files:**
- Create: `src/content/blocks.ts`
- Create: `src/content/blocks.test.ts`

- [ ] **Step 1: 新建 block 切分测试**

创建 `src/content/blocks.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { createAiContentBlocks } from './blocks'

describe('createAiContentBlocks', () => {
  it('splits completed paragraphs into stable blocks and keeps the streaming tail live', () => {
    expect(createAiContentBlocks('First paragraph\n\nSecond', { streaming: true })).toEqual([
      {
        id: 'block:0:c002a23f41b9e331',
        raw: 'First paragraph',
        renderContent: 'First paragraph',
        stable: true,
        kind: 'paragraph'
      },
      {
        id: 'live:1',
        raw: 'Second',
        renderContent: 'Second',
        stable: false,
        kind: 'paragraph'
      }
    ])
  })

  it('marks all blocks stable when streaming is false', () => {
    expect(createAiContentBlocks('First\n\nSecond', { streaming: false }).map((block) => block.stable)).toEqual([
      true,
      true
    ])
  })

  it('temporarily closes an unfinished fenced code block while streaming', () => {
    expect(createAiContentBlocks('```ts\nconst value = 1', { streaming: true })).toEqual([
      {
        id: 'live:0',
        raw: '```ts\nconst value = 1',
        renderContent: '```ts\nconst value = 1\n```',
        stable: false,
        kind: 'code'
      }
    ])
  })

  it('creates a stable image block only after image syntax is complete', () => {
    expect(createAiContentBlocks('![Chart](https://example.com/chart.png)', { streaming: true })).toEqual([
      {
        id: 'image:https://example.com/chart.png:Chart',
        raw: '![Chart](https://example.com/chart.png)',
        renderContent: '![Chart](https://example.com/chart.png)',
        stable: true,
        kind: 'image'
      }
    ])
  })

  it('does not create an image block for incomplete image syntax', () => {
    expect(createAiContentBlocks('![Chart](https://example.com/chart', { streaming: true })).toEqual([
      {
        id: 'live:0',
        raw: '![Chart](https://example.com/chart',
        renderContent: '![Chart](https://example.com/chart',
        stable: false,
        kind: 'paragraph'
      }
    ])
  })
})
```

- [ ] **Step 2: 运行 block 测试确认失败**

Run:

```bash
npm test -- src/content/blocks.test.ts
```

Expected: FAIL，模块 `src/content/blocks.ts` 尚不存在。

- [ ] **Step 3: 实现 block 切分工具**

创建 `src/content/blocks.ts`：

```ts
import type { AiContentBlock, AiContentBlockKind } from '../types'

interface CreateAiContentBlocksOptions {
  streaming?: boolean
}

const normalizeContent = (content: string) => content.replace(/\r\n?/g, '\n')

const hashString = (value: string) => {
  let hash = 5381n

  for (const char of value) {
    hash = (hash * 33n) ^ BigInt(char.codePointAt(0) ?? 0)
  }

  return BigInt.asUintN(64, hash).toString(16)
}

const imagePattern = /^!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/

const getImageIdentity = (raw: string) => {
  const match = raw.trim().match(imagePattern)

  if (!match) {
    return null
  }

  return {
    alt: match[1],
    url: match[2]
  }
}

const hasIncompleteImageSyntax = (raw: string) => {
  const value = raw.trim()
  return value.startsWith('![') && !imagePattern.test(value)
}

const getBlockKind = (raw: string): AiContentBlockKind => {
  const trimmed = raw.trim()

  if (trimmed.startsWith('```')) {
    return 'code'
  }

  if (getImageIdentity(trimmed)) {
    return 'image'
  }

  return 'paragraph'
}

const getStableId = (index: number, raw: string, kind: AiContentBlockKind) => {
  if (kind === 'image') {
    const image = getImageIdentity(raw)

    if (image) {
      return `image:${image.url}:${image.alt}`
    }
  }

  return `block:${index}:${hashString(raw)}`
}

const splitParagraphBlocks = (content: string) =>
  content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

const hasUnclosedFence = (raw: string) => {
  const fenceCount = raw
    .split('\n')
    .filter((line) => line.trim().startsWith('```')).length

  return fenceCount % 2 === 1
}

const closeFenceForRender = (raw: string) => (hasUnclosedFence(raw) ? `${raw}\n\`\`\`` : raw)

export const createAiContentBlocks = (
  content: string,
  options: CreateAiContentBlocksOptions = {}
): AiContentBlock[] => {
  const normalized = normalizeContent(content).trim()

  if (!normalized) {
    return []
  }

  const rawBlocks = splitParagraphBlocks(normalized)
  const lastIndex = rawBlocks.length - 1

  return rawBlocks.map((raw, index) => {
    const kind = hasIncompleteImageSyntax(raw) ? 'paragraph' : getBlockKind(raw)
    const isLiveTail = Boolean(options.streaming) && index === lastIndex && kind !== 'image'
    const stable = !isLiveTail
    const id = stable ? getStableId(index, raw, kind) : `live:${index}`

    return {
      id,
      raw,
      renderContent: kind === 'code' && isLiveTail ? closeFenceForRender(raw) : raw,
      stable,
      kind
    }
  })
}
```

- [ ] **Step 4: 运行 block 测试确认通过**

Run:

```bash
npm test -- src/content/blocks.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交 Task 2**

```bash
git add src/content/blocks.ts src/content/blocks.test.ts
git commit -m "feat: split streaming content into stable blocks"
```

---

## Task 3: 新增 AiContent 组件

**Files:**
- Create: `src/components/AiContent.vue`
- Create: `src/components/AiContent.spec.ts`

- [ ] **Step 1: 新建 AiContent 组件测试**

创建 `src/components/AiContent.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AiContent from './AiContent.vue'
import type { AiContentParser } from '../types'

const htmlParser: AiContentParser = {
  parse: (content) => ({
    type: 'html',
    content: content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
  })
}

describe('AiContent', () => {
  it('renders raw content as safe text by default', () => {
    const wrapper = mount(AiContent, {
      props: {
        content: '<strong>Hello</strong>'
      }
    })

    expect(wrapper.text()).toContain('<strong>Hello</strong>')
    expect(wrapper.find('strong').exists()).toBe(false)
  })

  it('renders parsed html from an external parser', () => {
    const parser: AiContentParser = {
      parse: (content) => ({
        type: 'html',
        content: `<strong>${content}</strong>`
      })
    }

    const wrapper = mount(AiContent, {
      props: {
        content: 'Hello',
        parser
      }
    })

    expect(wrapper.find('strong').text()).toBe('Hello')
  })

  it('passes block context to the parser', () => {
    const parse = vi.fn<AiContentParser['parse']>((content) => ({
      type: 'text',
      content
    }))

    mount(AiContent, {
      props: {
        content: 'First\n\nSecond',
        streaming: true,
        parser: { parse }
      }
    })

    expect(parse).toHaveBeenCalledWith('First', {
      streaming: true,
      blockId: 'block:0:c002a23f41b9e331',
      stable: true,
      kind: 'paragraph'
    })
    expect(parse).toHaveBeenCalledWith('Second', {
      streaming: true,
      blockId: 'live:1',
      stable: false,
      kind: 'paragraph'
    })
  })

  it('does not remount a stable image block when streaming content is appended', async () => {
    const wrapper = mount(AiContent, {
      props: {
        content: '![Chart](https://example.com/chart.png)',
        streaming: true,
        parser: htmlParser
      },
      attachTo: document.body
    })

    const image = wrapper.find('img').element

    await wrapper.setProps({
      content: '![Chart](https://example.com/chart.png)\n\nMore text'
    })

    expect(wrapper.find('img').element).toBe(image)
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 运行 AiContent 测试确认失败**

Run:

```bash
npm test -- src/components/AiContent.spec.ts
```

Expected: FAIL，组件 `AiContent.vue` 尚不存在。

- [ ] **Step 3: 实现 AiContent 组件**

创建 `src/components/AiContent.vue`：

```vue
<script lang="ts">
import { computed, defineComponent, h, watch, type PropType } from 'vue'
import { createAiContentBlocks } from '../content/blocks'
import { plainTextParser } from '../parsers'
import type { AiContentBlock, AiContentParsed, AiContentParser } from '../types'

export default defineComponent({
  name: 'AiContent',
  props: {
    content: {
      type: String,
      default: ''
    },
    parser: {
      type: Object as PropType<AiContentParser>,
      default: () => plainTextParser
    },
    streaming: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const parsedCache = new Map<string, AiContentParsed>()

    const blocks = computed(() =>
      createAiContentBlocks(props.content, {
        streaming: props.streaming
      })
    )

    watch(
      blocks,
      (nextBlocks) => {
        const nextIds = new Set(nextBlocks.filter((block) => block.stable).map((block) => block.id))

        Array.from(parsedCache.keys()).forEach((id) => {
          if (!nextIds.has(id)) {
            parsedCache.delete(id)
          }
        })
      },
      { immediate: true }
    )

    const parseBlock = (block: AiContentBlock) => {
      if (block.stable) {
        const cached = parsedCache.get(block.id)

        if (cached) {
          return cached
        }
      }

      const parsed = props.parser.parse(block.renderContent, {
        streaming: props.streaming,
        blockId: block.id,
        stable: block.stable,
        kind: block.kind
      })

      if (block.stable) {
        parsedCache.set(block.id, parsed)
      }

      return parsed
    }

    const renderBlock = (block: AiContentBlock) => {
      const parsed = parseBlock(block)
      const children =
        parsed.type === 'html'
          ? [h('span', { class: 'ai-content__html', innerHTML: parsed.content })]
          : parsed.content

      return h(
        'div',
        {
          key: block.id,
          class: ['ai-content__block', `ai-content__block--${block.kind}`],
          'data-ai-content-block': block.id
        },
        children
      )
    }

    return () =>
      h(
        'div',
        {
          class: 'ai-content',
          'data-streaming': props.streaming ? 'true' : 'false'
        },
        blocks.value.map(renderBlock)
      )
  }
})
</script>
```

- [ ] **Step 4: 运行 AiContent 测试确认通过**

Run:

```bash
npm test -- src/components/AiContent.spec.ts
```

Expected: PASS。

- [ ] **Step 5: 提交 Task 3**

```bash
git add src/components/AiContent.vue src/components/AiContent.spec.ts
git commit -m "feat: add streaming ai content component"
```

---

## Task 4: 接入 ChatMessage 和 AiChat

**Files:**
- Modify: `src/components/ChatMessage.vue`
- Modify: `src/components/AiChat.vue`
- Modify: `src/components/AiChat.spec.ts`

- [ ] **Step 1: 新增 AiChat 兼容行为测试**

在 `src/components/AiChat.spec.ts` 中追加：

```ts
it('passes contentParser to the default message renderer', () => {
  const wrapper = mount(AiChat, {
    props: {
      defaultMessages: [
        { id: 'a1', role: 'assistant', content: 'Hello', status: 'done' }
      ],
      contentParser: {
        parse: (content: string) => ({
          type: 'html',
          content: `<strong>${content}</strong>`
        })
      }
    }
  })

  expect(wrapper.find('.ai-content strong').text()).toBe('Hello')
})

it('keeps parser as a legacy alias for contentParser', () => {
  const wrapper = mount(AiChat, {
    props: {
      defaultMessages: [
        { id: 'a1', role: 'assistant', content: 'Legacy', status: 'done' }
      ],
      parser: {
        parse: (content: string) => ({
          type: 'html',
          content: `<em>${content}</em>`
        })
      }
    }
  })

  expect(wrapper.find('.ai-content em').text()).toBe('Legacy')
})

it('allows custom message slots to use AiContent directly', () => {
  const wrapper = mount(AiChat, {
    props: {
      defaultMessages: [
        { id: 'a1', role: 'assistant', content: 'Slot content', status: 'streaming' }
      ]
    },
    slots: {
      message:
        '<template #message="{ message }"><AiContent class="slot-content" :content="message.content" :streaming="message.status === \\'streaming\\'" /></template>'
    },
    global: {
      components: {
        AiContent
      }
    }
  })

  expect(wrapper.find('.slot-content').text()).toContain('Slot content')
})
```

如果文件顶部还没有 `AiContent` import，新增：

```ts
import AiContent from './AiContent.vue'
```

- [ ] **Step 2: 运行 AiChat 测试确认失败**

Run:

```bash
npm test -- src/components/AiChat.spec.ts
```

Expected: FAIL。`contentParser` prop 尚不存在，默认消息还没有使用 `AiContent`。

- [ ] **Step 3: 修改 ChatMessage 默认内容渲染**

在 `src/components/ChatMessage.vue` 中新增 import：

```ts
import AiContent from './AiContent.vue'
import type { AiContentParser } from '../types'
```

在 props 类型中新增：

```ts
contentParser?: AiContentParser
```

将 `.ai-chat__message-content` 中原来的 parsed 渲染：

```vue
<span
  v-if="parsed.type === 'html'"
  class="ai-chat__content-html"
  v-html="parsed.content"
/>
<template v-else>
  {{ parsed.content }}
</template>
```

替换为：

```vue
<AiContent
  :content="message.content"
  :parser="contentParser"
  :streaming="messageStatus === 'streaming'"
/>
```

保留 pending、streaming、error、stopped 状态文本不变。

- [ ] **Step 4: 修改 AiChat parser 透传**

在 `src/components/AiChat.vue` 中 import 类型新增：

```ts
AiContentParser,
```

在 props 中新增 `contentParser`，并保留 `parser`：

```ts
contentParser: Object as PropType<AiContentParser | undefined>,
parser: {
  type: Object as PropType<AiContentParser>,
  default: () => plainTextParser
}
```

在 `setup` 中新增 resolved parser：

```ts
const resolvedContentParser = computed(() => props.contentParser ?? props.parser ?? plainTextParser)
```

将 `getMessageContext` 中 parsed 改为带 AiContent 上下文：

```ts
parsed: resolvedContentParser.value.parse(message.content, {
  message,
  streaming: message.status === 'streaming',
  blockId: message.id,
  stable: message.status !== 'streaming',
  kind: 'paragraph'
}),
```

将 `renderFallbackMessage` 改为显式传 `contentParser`：

```ts
const renderFallbackMessage = (context: AiChatMessageSlotContext) =>
  h(ChatMessage, {
    ...context,
    contentParser: resolvedContentParser.value
  })
```

- [ ] **Step 5: 运行组件测试确认通过**

Run:

```bash
npm test -- src/components/AiContent.spec.ts src/components/AiChat.spec.ts
```

Expected: PASS。

- [ ] **Step 6: 提交 Task 4**

```bash
git add src/components/ChatMessage.vue src/components/AiChat.vue src/components/AiChat.spec.ts
git commit -m "feat: render chat messages through ai content"
```

---

## Task 5: 导出公开 API 并更新文档

**Files:**
- Modify: `src/index.ts`
- Modify: `README.md`
- Modify: `docs/refactor-map.md`

- [ ] **Step 1: 更新导出测试**

在 `src/components/AiContent.spec.ts` 追加一个导入层测试：

```ts
it('is exported from the package entry', async () => {
  const entry = await import('../index')

  expect(entry.AiContent).toBeTruthy()
})
```

- [ ] **Step 2: 运行导出测试确认失败**

Run:

```bash
npm test -- src/components/AiContent.spec.ts
```

Expected: FAIL。`AiContent` 尚未从 `src/index.ts` 导出。

- [ ] **Step 3: 修改 `src/index.ts` 导出 AiContent 与内容类型**

在 type export 列表中加入：

```ts
AiContentBlock,
AiContentBlockKind,
AiContentParsed,
AiContentParser,
AiContentParserContext,
```

在组件导出区域加入：

```ts
export { default as AiContent } from './components/AiContent.vue'
```

- [ ] **Step 4: 更新 README 的 AiContent 用法**

在 `README.md` 的 `## Parsers` 后新增：

```md
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
```

在 `README.md` 的 `## Breaking Changes` 或 API 说明附近新增迁移说明：

```md
- `contentParser` is the preferred `AiChat` prop for the default message content renderer.
- `parser` remains a compatibility alias during migration.
- For full rendering control, use the `message` slot and render `AiContent` directly.
```

- [ ] **Step 5: 同步 `docs/refactor-map.md` 的实施状态**

在 `docs/refactor-map.md` 的 “实施阶段” 下保持当前四阶段结构，并确认名称与代码一致：

```md
### Phase 1：抽离内容组件

- 新增 `AiContent`。
- 将默认消息内容渲染下沉到 `AiContent`。
- 通过 `contentParser` 和 legacy `parser` alias 保持当前兼容。
- 默认安全渲染纯文本。
```

- [ ] **Step 6: 运行导出测试确认通过**

Run:

```bash
npm test -- src/components/AiContent.spec.ts
```

Expected: PASS。

- [ ] **Step 7: 提交 Task 5**

```bash
git add src/index.ts README.md docs/refactor-map.md src/components/AiContent.spec.ts
git commit -m "docs: document ai content renderer"
```

---

## Task 6: 全量验证

**Files:**
- Verify only

- [ ] **Step 1: 运行全部测试**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 2: 运行类型检查**

Run:

```bash
npm run typecheck
```

Expected: PASS。

- [ ] **Step 3: 运行构建**

Run:

```bash
npm run build
```

Expected: PASS，并生成 `dist/vue3-ai-chat.js`、`dist/index.d.ts`。

- [ ] **Step 4: 检查工作区变更**

Run:

```bash
git status --short
```

Expected: 只显示本计划实施产生的文件变更；如果还有用户未提交变更，保留不动。

- [ ] **Step 5: 提交最终验证记录**

如果 Task 6 中没有文件变化，不需要提交。若 README 或计划在验证后有修正，执行：

```bash
git add README.md docs/refactor-map.md
git commit -m "docs: finalize ai content streaming plan"
```

---

## 自检结果

- 需求覆盖：计划覆盖独立 `AiContent`、外置 parser、streaming blocks、智能闭合、图片稳定 key、`AiChat` parser 兼容迁移、公开导出和文档。
- 类型一致性：内容相关新类型统一使用 `AiContent*`；旧 `AiChat*Parser` 保持兼容别名；`AiChat` 新入口使用 `contentParser`。
- 测试覆盖：parser 类型兼容、block 切分、`AiContent` 渲染、图片节点不 remount、`AiChat` 透传 parser、公开导出均有测试。
