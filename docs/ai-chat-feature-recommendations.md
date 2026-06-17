# AiChat 功能推荐汇总

## 背景

`src/components/AiChat.vue` 已经是一个可用的、与模型供应商解耦的聊天组件。它支持受控和非受控消息、通过 `adapter` 或 `sendHandler` 流式响应、停止、清空、重新生成 assistant 回复、traces、slots 以及 CSS 变量主题定制。

当前主要问题不是核心状态机不完整，而是公开组件 API 和默认交互还可以继续补齐。目标应该是让使用者不必通过 slots 重建大量常见 AI Chat 行为。

## 最高优先级缺口

1. **实现或移除 `markdown` prop**

   `AiChat.vue` 声明了 `markdown?: boolean | ((content, message) => unknown)`，README 也把它记录为预留渲染 hook。但组件目前仍然只是把消息内容作为纯文本插值渲染。这是最明确的 API 与行为不一致。

   建议：实现安全的 Markdown 渲染；如果暂时不打算实现，就先移除该 prop 或修改文档，避免误导使用者。

2. **添加默认消息操作**

   当前默认 UI 只给符合条件的 assistant 消息提供 `Regenerate`。复制消息、重试失败回复、编辑用户 prompt 这类高频操作缺失。

   建议：为 user/assistant 消息添加复制；为错误 assistant 消息添加重试；为 user 消息添加编辑并重新发送。

3. **让 Composer 输入可控**

   `ChatComposer.vue` 当前内部维护 `draft`。外部无法预填、清空、监听或控制输入内容。

   建议：添加 `v-model:input` 或等价 props/events；给 composer slots 暴露 `draft`、`submit`、`active`、`disabled`；并暴露 `focus` 方法。

4. **添加 labels / i18n 配置**

   默认文案和 aria label 现在都是硬编码英文，例如 send、stop、regenerate、clear、empty state 和状态文本。

   建议：添加 `labels` prop，提供默认英文文案，同时允许使用者覆盖为中文或业务化文案。对组件库来说这是基础能力。

5. **改进自动滚动行为**

   当前 `autoScroll` 开启时，消息或 trace 任意更新都会滚到底部。用户正在查看历史消息时会被打断。

   建议：只有用户已经接近底部时才自动滚动；如果用户不在底部，则暴露“跳到最新消息”的状态或默认按钮。

## 推荐新增功能

### 附件能力

支持图片、文件、拖拽上传、粘贴图片。附件应该进入消息数据结构，并传给 `AiChatSendContext`，由 adapter 决定如何上传或发送。

如果组件目标是覆盖现代 AI Chat 场景，这是最有价值的新能力。

### 引用来源 / Citations

现有 trace 模型适合展示公开过程更新，但引用来源应该是一等模型。sources/citations 建议支持标题、URL、摘要片段、序号和可选元数据。

这样默认 UI 可以直接渲染回答来源，而不需要使用者把 sources 塞进 traces。

### 会话持久化 hooks

组件不应该内置具体存储策略，但可以让持久化更容易接入。

建议 API 方向：

- `conversationId`
- `onPersist(messages, context)`
- 提供加载历史消息的示例或辅助方法

### 更精确的消息状态

当前状态是 `pending`、`streaming`、`done`、`error`。用户手动停止回复时，目前会被标记为 `done`，这会掩盖“被停止”和“正常完成”的差异。

建议：新增 `stopped` 或 `cancelled` 状态，并在默认 UI 中与正常完成区分展示。

### 建议问题 / 快捷 Prompt

支持空状态或 assistant 回复后的 suggestion chips。

示例：

- “总结一下”
- “举几个例子”
- “继续”
- “生成表格”

这个能力可以通过 prop、slot state 或 message metadata 实现。

### 消息版本管理

当前重新生成会替换目标 assistant 消息，并截断后续消息。更完整的体验是保留多个 assistant 版本，并允许用户在不同版本之间切换。

这个功能有价值，但建议放在基础 regenerate 流程稳定之后。

### 导出辅助方法

提供把消息导出为 Markdown、JSON 或纯文本的 helper。适合调试、客服留档、用户导出对话等场景。

### 长会话性能优化

当前消息列表会渲染全部消息。长会话下，streaming 输出和 trace 更新可能会越来越重。

建议：支持虚拟滚动，或文档化如何通过 list slot 接入虚拟列表，同时保留消息 actions 和状态。

### 输入增强

提升 composer 使用体验：

- textarea 自动增高
- 可配置提交快捷键
- 中文/日文/韩文 IME 输入保护
- `maxLength`
- 字符数或 token 数提示
- 粘贴处理

### 无障碍增强

加强键盘操作和焦点管理：

- 发送/停止后恢复焦点
- 暴露 focus 方法
- aria label 可配置
- 消息操作支持键盘访问
- streaming 文本的 live-region 行为更清晰

## 建议路线图

### 第一阶段：补齐 API 和基础 UX

目标是让文档中的 API 真实可用，并让默认组件更接近可直接投入业务。

- 实现安全 Markdown 渲染，或移除该 prop。
- 添加复制、重试、编辑并重新发送消息操作。
- 添加可控 composer 输入。
- 添加 `labels` prop，覆盖普通文案和 aria 文案。
- 改进自动滚动行为。
- 为所有公开 API 变化补测试。

### 第二阶段：产品级 AI Chat 能力

目标是覆盖真实 AI 应用常见需求。

- 添加附件数据模型和 composer UI hooks。
- 添加 citations/sources 模型和默认渲染。
- 添加会话持久化 hooks。
- 添加 `stopped` 或 `cancelled` 消息状态。
- 添加建议问题 / 快捷 prompt。

### 第三阶段：高级体验和规模化

目标是增强复杂工作流和长会话性能。

- 添加重新生成消息的多版本管理。
- 添加导出 helpers。
- 添加虚拟列表支持，或文档化虚拟列表接入方式。
- 添加 token 计数、粘贴处理等输入增强能力。
- 扩展无障碍验证。

## 推荐结论

如果只先修一个类似 bug 的问题，优先修 `markdown`，因为 prop 已存在但没有实现。

如果只先做一个 UX 提升，优先做默认复制、重试、编辑操作，因为它能减少最多重复的使用者工作。

如果只先做一个新的产品能力，优先做附件能力，因为它能打开最多现代 AI Chat 使用场景。

如果目标是提升组件库质量，优先做 `labels`、可控 composer 输入和更好的自动滚动行为，再做高级功能。
