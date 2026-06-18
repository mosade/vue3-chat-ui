# 流式内容渲染

## 目标

新增一个独立的内容组件，用来渲染 AI 流式输出。

这个组件接收原始文本内容，并负责稳定渲染纯文本或类 Markdown 内容。它可以放在
`AiChat` 内部使用，但不能依赖聊天消息、角色、adapter、traces 或聊天操作。

## 组件边界

新增 `AiContent` 组件：

```vue
<AiContent
  :content="message.content"
  :parser="markdownParser"
  :streaming="message.status === 'streaming'"
/>
```

也应该支持独立使用：

```vue
<AiContent :content="rawContent" :parser="markItParser" />
```

`AiContent` 只负责内容渲染：

- 原始 plaintext 输入
- 可选外置 parser
- 流式渲染稳定性
- 未完成 Markdown 结构的智能闭合
- 稳定的 block key
- 媒体渲染稳定性，尤其是图片

`AiContent` 不负责：

- 消息状态
- 按角色区分的 UI
- traces 或 sources
- regenerate、retry、edit、copy 等操作
- adapter 或请求生命周期

## Parser 策略

Parser 应该优先支持外置接入。组件库可以提供一个轻量默认 parser，但用户应该能通过
同一套接口接入 `mark-it`、`markdown-it` 或任何自定义 parser。

Parser 只负责把单个内容 block 转成解析结果。流式渲染层负责判断哪些 block 已经稳定，
以及哪个 block 仍然是正在变化的 live tail。

接口示例：

```ts
interface AiContentParser {
  parse: (content: string, context: AiContentParserContext) => AiContentParsed
}

interface AiContentParserContext {
  streaming: boolean
  blockId?: string
}

type AiContentParsed =
  | { type: 'text'; content: string }
  | { type: 'html'; content: string }
```

## 流式渲染策略

流式输出期间不要把整段内容渲染成一个 `v-html` 字符串。这样每个 chunk 到来时都可能替换
整棵 DOM 子树，图片会因为 `<img>` 节点被销毁再创建而出现闪烁。

应该先把内容拆成渲染 blocks：

```ts
type AiContentBlock = {
  id: string
  raw: string
  stable: boolean
  kind: 'paragraph' | 'code' | 'image' | 'html'
}
```

渲染应该以 block 为单位：

```vue
<AiContentBlock
  v-for="block in blocks"
  :key="block.id"
  :block="block"
  :parser="parser"
/>
```

规则：

- 已完成的 block 变成 stable，并且保持相同 key。
- 流式输出期间只更新当前 live tail block。
- 未完成的 Markdown 结构可以临时补齐后展示。
- 未完成的图片语法不能创建 image block。
- 图片 block 一旦完整，使用稳定图片身份作为 key，例如
  `image:${url}:${alt}`.
- 后续 chunk 到来时，stable media block 不应该重新 parse 或 remount。

## 图片闪烁问题

外置 Markdown parser，例如 `mark-it`，遇到的图片闪烁问题不只是解析问题。常见失败链路是：

1. streaming content 变化
2. 重新 parse 完整 Markdown 字符串
3. 把完整 HTML 字符串传给 `v-html`
4. Vue 替换 HTML 子树
5. 已存在的图片节点被重新创建
6. 图片重新加载或重新解码，视觉上出现闪烁

修复点应该放在 `AiContent`：通过 block 级复用和稳定 key，保证已经 commit 的图片 block
不被后续 live tail 更新影响。

## AiChat 兼容关系

当前 `AiChat :parser="markdownParser"` API 会和未来的 `AiContent :parser` API 重叠。
长期看，解析能力应该归属到 `AiContent`。

推荐迁移路线：

1. 新增 `AiContent`，并让 `ChatMessage` 默认使用它渲染内容。
2. 如果 `AiChat` 根组件需要给默认消息 fallback 传 parser，新增 `contentParser`。
3. 迁移期保留 `AiChat :parser` 作为 legacy alias，内部转发给 `AiContent`。
4. 自定义 message slot 中优先使用显式写法：

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

最终职责归属：

- `AiChat`：聊天状态、消息生命周期、slots、actions
- `AiContent`：原始文本渲染、parser 调用、流式稳定性
- parser：单个 block 的 Markdown/plaintext 转换

## 实施阶段

### Phase 1：抽离内容组件

- 新增 `AiContent`。
- 将默认消息内容渲染下沉到 `AiContent`。
- 通过 `contentParser` 和 legacy `parser` alias 保持当前兼容。
- 默认安全渲染纯文本。

### Phase 2：流式 blocks

- 将内容拆成 stable blocks 和一个 live block。
- 缓存已经解析过的 stable blocks。
- 为常见 Markdown 结构增加智能闭合。
- 阻止未完成图片语法创建图片 DOM。

### Phase 3：媒体稳定性

- 给图片 block 稳定 key。
- 避免已经 commit 的图片 block 被重新 parse 或 remount。
- 可选：展示前先 preload 图片 URL。

### Phase 4：高级 patch 优化

- 只有在 block 级复用被证明不够时，再考虑 AST 或 block patch。
- DOM patching 保持在 `AiContent` 内部，不泄露到 `AiChat`。
