# vue3-ai-chat

`vue3-ai-chat` 是一个 Vue 3 AI Chat 组件库。它把聊天状态、消息生命周期、
输入框、滚动、重试、编辑、复制等交互封装在 `useAiChat` 和 `AiChat` 中，
同时把内容渲染独立到 `AiContent`，方便接入任意 Markdown/富文本 parser。

核心特点：

- Provider-neutral：不绑定任何模型服务或请求协议。
- Headless-first：`AiChat` 只负责状态和 slot 编排。
- 可替换内容解析：通过 `contentParser` 或 `AiContent :parser` 接入 parser。
- 支持流式渲染：内容按稳定 block 和 live tail 渲染，减少图片闪烁和 DOM 重建。
- 显式 CSS：包入口不自动引入样式，需要主动导入 preset。

## 安装

```bash
npm install vue3-ai-chat vue
```

如果需要在项目中使用完整 Markdown 解析器，可以自行安装，例如：

```bash
npm install markdown-it
```

## 基础用法

```vue
<script setup lang="ts">
import { AiChat, AiContent, markdownParser, type AiChatAdapter } from 'vue3-ai-chat'
import 'vue3-ai-chat/base.css'

const adapter: AiChatAdapter = {
  async send({ append }) {
    append('Hello')
  }
}
</script>

<template>
  <AiChat :adapter="adapter" :content-parser="markdownParser">
    <template #header="{ messages, actions }">
      <button type="button" @click="actions.clear()">
        清空 {{ messages.length }}
      </button>
    </template>

    <template #message="{ message, status, actions }">
      <div v-if="message.role === 'user'" class="user-message">
        {{ message.content }}
      </div>

      <AiContent
        v-else
        class="assistant-message"
        :content="message.content"
        :parser="markdownParser"
        :streaming="status === 'streaming'"
      />

      <button v-if="message.content" type="button" @click="actions.copy()">
        复制
      </button>
    </template>
  </AiChat>
</template>
```

## AiChat API

`AiChat` 暴露五个顶层 slot：

| Slot | Context |
| --- | --- |
| `header` | `AiChatRootSlotContext` |
| `empty` | `AiChatRootSlotContext` |
| `message` | `AiChatMessageSlotContext` |
| `input` | `AiChatInputSlotContext` |
| `footer` | `AiChatRootSlotContext` |

`AiChat` 负责消息状态、输入草稿、编辑状态、滚动状态和 action wiring。
界面可以由 slot 完全自定义，也可以使用包内导出的默认 building blocks。

## 内容解析

推荐使用 `contentParser` 给 `AiChat` 默认消息渲染器传入内容 parser：

```vue
<AiChat :adapter="adapter" :content-parser="markdownParser" />
```

自定义 parser 实现 `AiContentParser`：

```ts
interface AiContentParser {
  parse: (content: string, context: AiContentParserContext) => AiContentParsed
}
```

内置 parser：

```ts
import { markdownParser, plainTextParser } from 'vue3-ai-chat'
```

- `plainTextParser`：默认安全纯文本渲染。
- `markdownParser`：轻量 Markdown 示例解析器，适合基础演示。
- 更完整的 Markdown 能力建议接入 `markdown-it`、`mark-it` 等外部 parser。

## AiContent

`AiContent` 是独立内容渲染组件，只接收原始文本内容，不依赖聊天消息、角色、
adapter、traces 或 actions。

```vue
<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { AiContent, type AiContentParser } from 'vue3-ai-chat'

const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

const parser: AiContentParser = {
  parse: (content) => ({
    type: 'html',
    content: markdownIt.render(content)
  })
}
</script>

<template>
  <AiContent
    :content="content"
    :parser="parser"
    :streaming="streaming"
  />
</template>
```

流式输出时，`AiContent` 会把内容拆成 stable blocks 和一个 live block：

- 已完成 block 会保持稳定 key。
- stable block 的解析结果会缓存。
- live block 会随着最新内容更新。
- 未完成的 fenced code block 会临时补齐闭合符用于展示。
- 未完成图片语法不会提前生成 image block。
- 完整图片 block 使用稳定图片身份作为 key，后续 chunk 到来时不会 remount 已有图片节点。

## Adapter

`adapter.send` 接收 `AiChatSendContext`：

```ts
const adapter: AiChatAdapter = {
  async send({ prompt, append, update, setPhase, appendTrace, updateTrace, signal }) {
    setPhase('searching')
    const traceId = appendTrace({
      kind: 'search',
      title: '搜索文档',
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

字段职责：

- `phase`：表达 assistant 主生命周期，例如 searching、reasoning、answering。
- `traces`：表达可展示的过程信息，例如 reasoning summary、搜索、工具调用。
- `sources`：表达最终引用来源或参考资料。

## Demo

本仓库 demo 使用：

- `markdown-it` 作为 demo 的 Markdown parser。
- `docs/markdown-example.md` 作为 mock response 内容来源。
- `https://picsum.photos/200/300` 图片和链接测试流式媒体渲染。
- 不规则 chunk size 和 delay 模拟模型“吐字”式流式输出。

运行：

```bash
npm run dev
```

## Building Blocks

可选导出组件：

```ts
import { AiContent, ChatComposer, ChatMessage, ChatMessageList } from 'vue3-ai-chat'
```

这些组件用于组合自定义 UI，不是 `AiChat` slot 协议的必需项。

## CSS Presets

包入口不会自动导入 CSS。请按需显式导入：

```ts
import 'vue3-ai-chat/base.css'
import 'vue3-ai-chat/shadcn.css'
```

- `base.css`：基础 `.ai-chat` 样式。
- `shadcn.css`：shadcn 风格 token preset，无运行时依赖。

## 开发

```bash
npm test
npm run typecheck
npm run build
```
