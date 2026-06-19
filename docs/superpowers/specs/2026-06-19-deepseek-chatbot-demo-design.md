# DeepSeek Chatbot Demo Design

## Goal

Transform `demo/ShadcnDemo.vue` from a shadcn preset showcase into a usable chatbot product demo that can call DeepSeek directly from the browser. The selected product direction is a minimal assistant: the first screen focuses on chatting, with API configuration available but secondary.

This is a demo/local integration surface. Browser-side API keys are intentionally not positioned as production-safe.

## Product Shape

The demo presents a focused `DeepSeek Assistant` experience:

- Header with product name, short status text, and connection state.
- Primary chat surface using the existing `AiChat` component and shadcn preset styling.
- Empty-state welcome content with three prompt suggestions: writing, code, and analysis.
- Sticky composer with send and stop behavior from the existing slot API.
- Compact settings area for API key, model, temperature, stream mode, and clear conversation.

Out of scope:

- Conversation history persistence across sessions.
- Request inspector, token billing, or detailed provider logs.
- A production backend proxy.
- Saving the API key to source code.

## DeepSeek Integration

The frontend adapter calls DeepSeek's OpenAI-compatible endpoint:

- Base URL: `https://api.deepseek.com`
- Endpoint: `/chat/completions`
- Method: `POST`
- Streaming: SSE `data:` lines, `[DONE]` terminator.
- Content delta path: `choices[0].delta.content`

The UI defaults to current DeepSeek model options:

- `deepseek-v4-flash`
- `deepseek-v4-pro`

The request payload is shaped from the current `AiChatMessage[]` as `{ role, content }`, excluding internal-only error/status data. The adapter includes:

- `model`
- `messages`
- `temperature`
- `stream`

If streaming is enabled, the adapter parses SSE chunks and appends content as it arrives. If streaming is disabled, it parses JSON and appends `choices[0].message.content`.

## State

`ShadcnDemo.vue` owns these demo states:

- `messages`: chat transcript, initialized with a product-style assistant welcome message.
- `apiKey`: browser-entered DeepSeek API key.
- `model`: selected DeepSeek model.
- `temperature`: numeric model temperature.
- `streamEnabled`: whether to request streaming responses.
- `connectionStatus`: idle, ready, connecting, streaming, error, or stopped.
- `lastError`: provider or validation error text.

The API key is held in component memory only. It is not committed, persisted, or exported.

## Error Handling

Validation happens before a network request:

- If `apiKey` is empty, the adapter throws a clear local error and does not call `fetch`.
- If the provider returns non-2xx, the adapter reads the response body when possible and throws a concise error.
- If the user stops generation, the existing `AbortSignal` cancels `fetch` and updates status to stopped.
- If SSE parsing receives malformed JSON, the adapter ignores that one event and continues.

Errors are rendered through existing `AiChat` error/retry behavior, with demo copy customized for DeepSeek.

## Component Boundaries

The implementation remains scoped to:

- `demo/ShadcnDemo.vue`
- `demo/style.css`
- `demo/App.spec.ts`

No changes are planned for `src/components` or `src/composables` unless tests reveal an existing bug.

## Testing

Tests are updated before implementation to cover the new behavior:

- The shadcn variant renders as `DeepSeek Assistant`, not a preset audit.
- The UI exposes model/API configuration and prompt suggestions.
- Sending without an API key shows a local error and does not call `fetch`.
- Sending with an API key calls `https://api.deepseek.com/chat/completions`.
- A mocked streaming response appends streamed assistant text.
- CSS test expectations are updated for the new product classes.

## Visual Direction

The selected visual direction is minimal assistant:

- White/neutral shadcn-inspired surface.
- Chat-first layout with restrained controls.
- Compact settings panel that supports API connection without turning the product into a playground.
- Mobile layout stacks settings below/above the chat while keeping the composer usable.
