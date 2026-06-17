# Vue3 AI Chat Component Design

## Overview

Build a reusable Vue 3 AI chat component package named `vue3-ai-chat`. The package provides a complete default chat UI and a headless composable for advanced consumers. It must not depend on any UI component library and must not bind itself to a specific AI provider.

The first version focuses on a strong base chat experience: message rendering, prompt input, send/stop/regenerate flows, streaming assistant output, error states, controlled and uncontrolled message state, slots for customization, and CSS variables for theming.

## Goals

- Provide a Vue 3 + TypeScript component that can be published and reused across projects.
- Avoid all UI component library dependencies.
- Keep model and backend integration outside the core component through an adapter or `sendHandler` callback.
- Support both simple usage and fully controlled business usage.
- Allow teams to customize rendering without forking the component.
- Keep the first version small enough to implement and test cleanly.

## Non-Goals For Version 1

- Built-in OpenAI, Claude, or other provider request logic.
- API key management in the browser.
- Conversation history sidebar.
- Model selector UI.
- File upload, image messages, or multimodal messages.
- Tool-call cards, citations, or source panels.
- Built-in Markdown parser dependency.
- Full application shell similar to ChatGPT.

## Recommended Approach

Use a hybrid design: a default UI component plus headless logic.

- `AiChat` gives consumers a ready-to-use, styled chat panel.
- `useAiChat` exposes the core state machine and actions for custom layouts.
- Internal subcomponents keep rendering responsibilities isolated.
- CSS variables and slots provide customization without requiring a UI library.

This approach balances ease of adoption with long-term reuse. A purely controlled UI component would be clean but verbose for simple users. A complete application-style panel would ship too many product assumptions in a base component.

## Package Shape

```text
src/
  components/
    AiChat.vue
    ChatComposer.vue
    ChatMessage.vue
    ChatMessageList.vue
    ChatToolbar.vue
  composables/
    useAiChat.ts
  types.ts
  style.css
  index.ts
```

## Component Responsibilities

### `AiChat.vue`

The main component composes the complete chat experience. It accepts public props, emits public events, wires `useAiChat`, and exposes customization slots.

Responsibilities:

- Render the root chat container.
- Render optional header and footer slots.
- Connect message list, composer, and toolbar.
- Normalize controlled and uncontrolled usage.
- Forward send, regenerate, stop, clear, and error events.

### `ChatMessageList.vue`

Renders the list of messages and related list-level states.

Responsibilities:

- Render empty state when there are no messages.
- Render all messages through `ChatMessage`.
- Auto-scroll when new content arrives, if enabled.
- Expose list and empty-state slots.

### `ChatMessage.vue`

Renders one message.

Responsibilities:

- Apply role-based layout for `user`, `assistant`, `system`, and `error`.
- Render avatar slot.
- Render message content slot.
- Render message actions slot.
- Display pending, streaming, done, and error status affordances.

### `ChatComposer.vue`

Handles prompt input.

Responsibilities:

- Maintain local draft input.
- Submit on Enter.
- Insert newline on Shift+Enter.
- Disable input when requested.
- Show send or stop affordance depending on active request state.
- Emit submit and stop actions.

### `ChatToolbar.vue`

Provides optional actions around the chat state.

Responsibilities:

- Clear all messages.
- Provide extension points for future actions.

### `useAiChat.ts`

Owns core chat behavior independent of the default UI.

Responsibilities:

- Store internal messages for uncontrolled usage.
- Accept externally controlled messages for controlled usage.
- Add user messages.
- Create assistant placeholder messages.
- Append streamed content.
- Mark messages as pending, streaming, done, or error.
- Abort active requests.
- Regenerate a selected assistant message from its preceding user prompt.
- Surface errors in a consistent shape.

## Public Types

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

export interface AiChatSendContext {
  prompt: string
  messages: AiChatMessage[]
  signal: AbortSignal
  append: (chunk: string) => void
  update: (message: Partial<AiChatMessage>) => void
}

export interface AiChatAdapter {
  send: (context: AiChatSendContext) => Promise<string | void>
}

export interface AiChatError {
  message: string
  cause?: unknown
}
```

## Main Component API

### Props

- `messages?: AiChatMessage[]`
- `defaultMessages?: AiChatMessage[]`
- `adapter?: AiChatAdapter`
- `sendHandler?: (context: AiChatSendContext) => Promise<string | void>`
- `loading?: boolean`
- `disabled?: boolean`
- `placeholder?: string`
- `autoFocus?: boolean`
- `autoScroll?: boolean`
- `markdown?: boolean | ((content: string, message: AiChatMessage) => unknown)`

`adapter` and `sendHandler` are alternative integration points. If both are provided, `sendHandler` takes precedence because it is more direct and easier to inspect.

### Events

- `update:messages`
- `send`
- `stop`
- `regenerate` with `{ message, promptMessage, messages }`, where `messages` is the post-reset, pre-request message list.
- `clear`
- `error`

### Slots

- `header`
- `empty`
- `avatar`
- `message`
- `message-content`
- `message-actions`
- `composer-prefix`
- `composer-actions`
- `footer`

Slots receive enough context to avoid consumers reaching into internals. For example, message slots receive `{ message, index, status, actions }`.

## State Model

The component supports both controlled and uncontrolled modes.

In controlled mode, consumers pass `v-model:messages`. The component emits `update:messages` whenever it needs to change the list. The parent remains the source of truth.

In uncontrolled mode, consumers pass `defaultMessages` or no messages. The component owns message state internally and still emits lifecycle events.

This makes simple demos concise while preserving full control for persistence, server sync, multi-conversation apps, and external stores.

## Send Flow

1. User submits a non-empty prompt.
2. Component creates a `user` message with status `done`.
3. Component creates an `assistant` placeholder message with status `pending`.
4. Component creates an `AbortController` for this request.
5. Component calls `sendHandler` or `adapter.send`.
6. When the request calls `append(chunk)`, the assistant message becomes `streaming` and appends the chunk.
7. If the request resolves with a string, that string is appended or used as the final assistant content depending on whether chunks were already received.
8. On success, assistant status becomes `done`.
9. On failure, assistant status becomes `error` and an `error` event is emitted.
10. On stop, the request is aborted. Existing streamed content is kept and the active request is cleared.

Only one active request is supported in version 1. This keeps cancellation, regeneration, loading state, and UI behavior predictable.

## Regenerate Flow

1. User triggers regenerate on an assistant message.
2. Component finds the nearest preceding user message and uses it as the prompt.
3. Component drops messages after the selected assistant message to avoid inconsistent follow-up context.
4. Component keeps the selected assistant message id, clears its content and traces, and marks it `pending`.
5. Component emits `regenerate` with the original assistant message, preceding user message, and the post-reset messages.
6. Component calls `sendHandler` or `adapter.send`.
7. Streaming, success, stop, and error handling follow the same assistant request path as normal send.

## Markdown Strategy

Version 1 does not include a Markdown parser dependency by default. The component renders message content as safe plain text unless consumers override rendering.

Consumers can add Markdown in two ways:

- Use the `message-content` slot and render content through their preferred Markdown pipeline.
- Pass a `markdown` render function if the implementation chooses to support a render hook.

This keeps the core package dependency-light and avoids locking consumers into a Markdown library or sanitization policy.

## Styling

Styling uses plain CSS and stable class names. No UI library, CSS framework, or icon library is required.

Class names use an `ai-chat` prefix, for example:

- `.ai-chat`
- `.ai-chat__header`
- `.ai-chat__messages`
- `.ai-chat__message`
- `.ai-chat__message--user`
- `.ai-chat__message--assistant`
- `.ai-chat__composer`
- `.ai-chat__button`

The default theme is neutral, compact, and suitable for embedding inside business applications.

CSS variables provide theming:

- `--ai-chat-bg`
- `--ai-chat-fg`
- `--ai-chat-muted-fg`
- `--ai-chat-border`
- `--ai-chat-user-bg`
- `--ai-chat-user-fg`
- `--ai-chat-assistant-bg`
- `--ai-chat-assistant-fg`
- `--ai-chat-error-bg`
- `--ai-chat-error-fg`
- `--ai-chat-radius`
- `--ai-chat-gap`
- `--ai-chat-font-size`
- `--ai-chat-font-family`

## Accessibility

The component should:

- Use semantic buttons for actions.
- Give composer controls accessible labels.
- Preserve keyboard submission with Enter and multiline input with Shift+Enter.
- Avoid trapping focus.
- Announce loading and error states through accessible text or ARIA attributes where appropriate.
- Keep visible focus states.

## Error Handling

All adapter and send callback failures are normalized into `AiChatError`.

The component should:

- Mark the assistant placeholder as `error`.
- Preserve the user prompt that caused the error.
- Emit `error` with the normalized error and relevant context.
- Allow regenerating an assistant response, including a failed response.
- Avoid swallowing abort errors as normal failures when the user intentionally stops generation.

## Testing Strategy

Unit tests for `useAiChat`:

- Adds user and assistant messages on send.
- Appends streamed chunks in order.
- Marks completion as `done`.
- Marks failures as `error`.
- Aborts an active request.
- Regenerates a selected assistant message.
- Drops follow-up messages after the regenerated assistant message.
- Emits updates in controlled mode.

Component tests:

- Renders empty state.
- Renders user and assistant messages.
- Submits composer input with Enter.
- Inserts newline with Shift+Enter.
- Disables controls while disabled or active.
- Emits `update:messages`, `send`, `stop`, `regenerate`, `clear`, and `error`.
- Renders customization slots.

Type checks:

- Public exports compile with `vue-tsc`.
- Example usage compiles with `v-model:messages`, `adapter`, and slots.

## Open Decisions

The current design intentionally fixes the first version scope. Later versions can add optional packages or extensions for provider adapters, Markdown rendering, file attachments, citations, and conversation sidebars without changing the core component contract.
