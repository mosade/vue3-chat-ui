# DeepSeek Chatbot Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `demo/ShadcnDemo.vue` into a minimal DeepSeek chatbot product demo with direct browser API calls.

**Architecture:** Keep the work scoped to the demo layer. `ShadcnDemo.vue` owns API configuration, DeepSeek request/stream parsing, and all custom slots for product UI. `demo/style.css` owns the new minimal assistant layout, recreating shadcn/ui visual conventions with local CSS only, and `demo/App.spec.ts` verifies behavior through the existing demo app switcher.

**Tech Stack:** Vue 3 `<script setup>`, existing `AiChat` slot API, local CSS inspired by shadcn/ui, Vitest, Vue Test Utils, browser `fetch`, DeepSeek OpenAI-compatible `/chat/completions` endpoint. Do not install or import the shadcn/ui component library.

---

## File Structure

- Modify `demo/App.spec.ts`: replace old shadcn-preset expectations with chatbot product behavior and DeepSeek adapter tests.
- Modify `demo/ShadcnDemo.vue`: replace preset showcase state and mock adapter with minimal assistant UI, DeepSeek config state, request builder, SSE parser, and product slots.
- Modify `demo/style.css`: replace old `.shadcn-demo` audit/sidebar styling with minimal assistant layout, settings controls, suggestions, status, and custom message/composer surfaces using local CSS that matches shadcn/ui conventions: neutral palette, compact spacing, small radius, clear focus states, and muted text. Avoid fine hairline borders as the main structure; use soft fills, subtle shadows, and spacing for hierarchy.

## Task 1: Product Shell Tests

**Files:**
- Modify: `demo/App.spec.ts`
- Later implementation: `demo/ShadcnDemo.vue`
- Later implementation: `demo/style.css`

- [ ] **Step 1: Write the failing tests**

In `demo/App.spec.ts`, update the first shadcn switch assertion and replace the old preset-building-blocks test.

Use this shape:

```ts
it('renders the Google-style default demo and switches to the DeepSeek chatbot demo', async () => {
  const wrapper = mount(App)

  expect(wrapper.text()).toContain('Ask AiChat')
  expect(wrapper.find('.google-demo').exists()).toBe(true)
  expect(wrapper.find('.google-input').exists()).toBe(true)

  await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

  expect(wrapper.text()).toContain('DeepSeek Assistant')
  expect(wrapper.find('.deepseek-demo .ai-chat').exists()).toBe(true)
})

it('renders the DeepSeek assistant product controls and prompt suggestions', async () => {
  const wrapper = mount(App)

  await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

  expect(wrapper.find('.deepseek-demo').exists()).toBe(true)
  expect(wrapper.find('[data-deepseek-api-key]').exists()).toBe(true)
  expect(wrapper.find('[data-deepseek-model]').exists()).toBe(true)
  expect(wrapper.find('[data-deepseek-temperature]').exists()).toBe(true)
  expect(wrapper.find('[data-deepseek-stream]').exists()).toBe(true)
  expect(wrapper.findAll('[data-deepseek-suggestion]')).toHaveLength(3)
  expect(wrapper.text()).toContain('shadcn/ui style')
  expect(wrapper.text()).toContain('Writing assistant')
  expect(wrapper.text()).toContain('Code review')
  expect(wrapper.text()).toContain('Analyze a decision')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- demo/App.spec.ts -t "DeepSeek assistant|switches to the DeepSeek"
```

Expected: FAIL because the existing demo still renders `shadcn preset` and does not expose `data-deepseek-*` controls.

- [ ] **Step 3: Implement minimal shell**

In `demo/ShadcnDemo.vue`, replace the old showcase copy with:

- Header text `DeepSeek Assistant`.
- Small style note text `shadcn/ui style, local CSS`.
- Root class `deepseek-demo`.
- API key input with `data-deepseek-api-key`.
- Model select with `data-deepseek-model`.
- Temperature input/range with `data-deepseek-temperature`.
- Stream checkbox with `data-deepseek-stream`.
- Three suggestion buttons with `data-deepseek-suggestion`.
- Keep using `<AiChat v-model:messages="messages" class="ai-chat--shadcn" :adapter="{ send: sendDeepseekMessage }">`.

Use the existing mock response temporarily for this task:

```ts
const sendDeepseekMessage = async ({ prompt, append, setPhase, signal }: AiChatSendContext) => {
  setPhase('answering')
  await wait(80, signal)
  append(`Demo response for: ${prompt}`)
}
```

In `demo/style.css`, add enough selectors for the shell:

```css
.deepseek-demo { ... }
.deepseek-demo__panel { ... }
.deepseek-demo__suggestions { ... }
.deepseek-demo__chat { ... }
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- demo/App.spec.ts -t "DeepSeek assistant|switches to the DeepSeek"
```

Expected: PASS for the two product shell tests.

- [ ] **Step 5: Commit**

```bash
git add demo/App.spec.ts demo/ShadcnDemo.vue demo/style.css
git commit -m "test: define deepseek chatbot shell"
```

## Task 2: Missing API Key Validation

**Files:**
- Modify: `demo/App.spec.ts`
- Modify: `demo/ShadcnDemo.vue`

- [ ] **Step 1: Write the failing test**

Add this test to `demo/App.spec.ts`:

```ts
it('shows a local DeepSeek API key error without calling fetch', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const wrapper = mount(App)

  await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
  await wrapper.find('textarea').setValue('Hello DeepSeek')
  await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
  await new Promise((resolve) => setTimeout(resolve, 120))

  expect(fetchMock).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('Enter a DeepSeek API key')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- demo/App.spec.ts -t "API key error"
```

Expected: FAIL because the temporary mock adapter answers instead of validating `apiKey`.

- [ ] **Step 3: Implement key validation**

In `demo/ShadcnDemo.vue`:

- Add `const apiKey = ref('')`.
- Bind `apiKey` to the API key input.
- At the top of `sendDeepseekMessage`, if `apiKey.value.trim()` is empty:

```ts
lastError.value = 'Enter a DeepSeek API key to send a request.'
connectionStatus.value = 'error'
throw new Error(lastError.value)
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- demo/App.spec.ts -t "API key error"
```

Expected: PASS and `fetchMock` is not called.

- [ ] **Step 5: Commit**

```bash
git add demo/App.spec.ts demo/ShadcnDemo.vue
git commit -m "feat: validate deepseek api key"
```

## Task 3: DeepSeek Streaming Adapter

**Files:**
- Modify: `demo/App.spec.ts`
- Modify: `demo/ShadcnDemo.vue`

- [ ] **Step 1: Write the failing test**

Add this test to `demo/App.spec.ts`:

```ts
it('calls DeepSeek chat completions and renders streamed response text', async () => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
      )
      controller.enqueue(
        encoder.encode('data: {"choices":[{"delta":{"content":" from DeepSeek"}}]}\n\n')
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    body: stream,
    headers: new Headers({ 'content-type': 'text/event-stream' })
  })
  vi.stubGlobal('fetch', fetchMock)
  const wrapper = mount(App)

  await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
  await wrapper.find('[data-deepseek-api-key]').setValue('sk-test')
  await wrapper.find('textarea').setValue('Say hello')
  await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
  await new Promise((resolve) => setTimeout(resolve, 120))

  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.deepseek.com/chat/completions',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer sk-test',
        'Content-Type': 'application/json'
      })
    })
  )
  const request = JSON.parse(fetchMock.mock.calls[0][1].body as string)
  expect(request.model).toBe('deepseek-v4-flash')
  expect(request.stream).toBe(true)
  expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Say hello' })
  expect(wrapper.text()).toContain('Hello from DeepSeek')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- demo/App.spec.ts -t "chat completions"
```

Expected: FAIL because no `fetch` call exists yet.

- [ ] **Step 3: Implement request builder and stream parser**

In `demo/ShadcnDemo.vue`, add:

```ts
type DeepseekStatus = 'idle' | 'ready' | 'connecting' | 'streaming' | 'error' | 'stopped'

const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions'
const model = ref('deepseek-v4-flash')
const temperature = ref(0.7)
const streamEnabled = ref(true)
const connectionStatus = ref<DeepseekStatus>('idle')
const lastError = ref('')

const toDeepseekMessages = (sourceMessages: AiChatMessage[], prompt: string) => [
  ...sourceMessages
    .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
    .filter((message) => message.content.trim())
    .map((message) => ({ role: message.role, content: message.content })),
  { role: 'user' as const, content: prompt }
]
```

Replace the temporary send function with a real implementation:

```ts
const sendDeepseekMessage = async ({
  prompt,
  messages: contextMessages,
  append,
  appendTrace,
  updateTrace,
  setPhase,
  signal
}: AiChatSendContext) => {
  const trimmedKey = apiKey.value.trim()

  if (!trimmedKey) {
    lastError.value = 'Enter a DeepSeek API key to send a request.'
    connectionStatus.value = 'error'
    throw new Error(lastError.value)
  }

  lastError.value = ''
  connectionStatus.value = 'connecting'
  setPhase('connecting')
  const traceId = appendTrace({
    kind: 'tool',
    title: 'Calling DeepSeek',
    content: `Sending request to ${model.value}`,
    status: 'pending'
  })

  const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${trimmedKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model.value,
      messages: toDeepseekMessages(contextMessages, prompt),
      temperature: temperature.value,
      stream: streamEnabled.value
    }),
    signal
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    lastError.value = detail || `DeepSeek request failed with status ${response.status}`
    connectionStatus.value = 'error'
    updateTrace(traceId, { status: 'error', content: lastError.value })
    throw new Error(lastError.value)
  }

  setPhase('answering')

  if (!streamEnabled.value) {
    const data = await response.json()
    append(data?.choices?.[0]?.message?.content ?? '')
    connectionStatus.value = 'ready'
    updateTrace(traceId, { status: 'done', content: 'DeepSeek response received.' })
    return
  }

  connectionStatus.value = 'streaming'

  const reader = response.body?.getReader()
  if (!reader) {
    lastError.value = 'DeepSeek streaming response did not include a readable body.'
    connectionStatus.value = 'error'
    updateTrace(traceId, { status: 'error', content: lastError.value })
    throw new Error(lastError.value)
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      for (const line of event.split('\n')) {
        const trimmedLine = line.trim()
        if (!trimmedLine.startsWith('data:')) continue

        const data = trimmedLine.slice(5).trim()
        if (!data || data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed?.choices?.[0]?.delta?.content
          if (delta) append(delta)
        } catch {
          // Ignore malformed SSE events and continue reading the stream.
        }
      }
    }
  }

  connectionStatus.value = 'ready'
  updateTrace(traceId, { status: 'done', content: 'DeepSeek stream completed.' })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- demo/App.spec.ts -t "chat completions"
```

Expected: PASS and streamed text appears in the wrapper.

- [ ] **Step 5: Commit**

```bash
git add demo/App.spec.ts demo/ShadcnDemo.vue
git commit -m "feat: call deepseek chat completions"
```

## Task 4: Non-Streaming and Provider Error Handling

**Files:**
- Modify: `demo/App.spec.ts`
- Modify: `demo/ShadcnDemo.vue`

- [ ] **Step 1: Write failing tests**

Add these tests to `demo/App.spec.ts`:

```ts
it('supports non-streaming DeepSeek responses', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'Non-streamed answer' } }]
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  const wrapper = mount(App)

  await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
  await wrapper.find('[data-deepseek-api-key]').setValue('sk-test')
  await wrapper.find('[data-deepseek-stream]').setValue(false)
  await wrapper.find('textarea').setValue('No stream')
  await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
  await new Promise((resolve) => setTimeout(resolve, 120))

  const request = JSON.parse(fetchMock.mock.calls[0][1].body as string)
  expect(request.stream).toBe(false)
  expect(wrapper.text()).toContain('Non-streamed answer')
})

it('renders provider errors from DeepSeek responses', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    text: async () => 'Invalid API key'
  })
  vi.stubGlobal('fetch', fetchMock)
  const wrapper = mount(App)

  await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
  await wrapper.find('[data-deepseek-api-key]').setValue('sk-bad')
  await wrapper.find('textarea').setValue('Will fail')
  await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
  await new Promise((resolve) => setTimeout(resolve, 120))

  expect(wrapper.text()).toContain('Invalid API key')
  expect(wrapper.text()).toContain('Retry')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- demo/App.spec.ts -t "non-streaming|provider errors"
```

Expected: FAIL if Task 3 did not fully handle non-streaming or provider error rendering.

- [ ] **Step 3: Complete implementation**

If not already complete from Task 3:

- Bind checkbox changes to `streamEnabled`.
- In the non-stream branch, call `response.json()` and append `choices[0].message.content`.
- In the non-2xx branch, call `response.text()` and throw that detail.
- Ensure the message slot exposes `Retry` when `context.canRetry` is true.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- demo/App.spec.ts -t "non-streaming|provider errors"
```

Expected: PASS for both tests.

- [ ] **Step 5: Commit**

```bash
git add demo/App.spec.ts demo/ShadcnDemo.vue
git commit -m "feat: handle deepseek response modes"
```

## Task 5: Product Styling and CSS Expectations

**Files:**
- Modify: `demo/App.spec.ts`
- Modify: `demo/style.css`
- Modify: `demo/ShadcnDemo.vue`

- [ ] **Step 1: Write the failing CSS expectation**

Update the `styles custom slot surfaces used by the demo` test in `demo/App.spec.ts` to remove old shadcn audit selectors and require new product selectors:

```ts
expect(css).toContain('.deepseek-demo')
expect(css).toContain('.deepseek-demo__hero')
expect(css).toContain('.deepseek-demo__settings')
expect(css).toContain('.deepseek-demo__suggestions')
expect(css).toContain('.deepseek-message')
expect(css).toContain('.deepseek-composer')
expect(css).toContain('.deepseek-status')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- demo/App.spec.ts -t "styles custom slot surfaces"
```

Expected: FAIL until `demo/style.css` contains the new selectors.

- [ ] **Step 3: Implement product styling**

In `demo/style.css`:

- Remove or stop relying on old `.shadcn-demo__state` and audit sidebar rules.
- Add responsive layout for `.deepseek-demo`, `.deepseek-demo__hero`, `.deepseek-demo__settings`, `.deepseek-demo__chat`, `.deepseek-message`, `.deepseek-composer`, `.deepseek-status`, `.deepseek-demo__suggestions`.
- Match shadcn/ui style without importing its library: restrained neutral colors, compact spacing, 6-8px radius, muted labels, filled/secondary button treatments, visible focus rings, and understated badges.
- Do not build the layout around fine `1px` card borders. Use soft surface fills, subtle box shadows, and generous internal spacing to create separation.
- Ensure mobile stacks layout under the existing `@media (max-width: 860px)`.

In `demo/ShadcnDemo.vue`:

- Use custom `#message` slot with `.deepseek-message`.
- Use custom `#input` slot with `.deepseek-composer`.
- Show status through `.deepseek-status`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- demo/App.spec.ts -t "styles custom slot surfaces"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add demo/App.spec.ts demo/ShadcnDemo.vue demo/style.css
git commit -m "style: polish deepseek chatbot demo"
```

## Task 6: Full Verification

**Files:**
- Verify only unless a failure requires a fix.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript reports no errors.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: Vite build and declaration emit complete successfully.

- [ ] **Step 4: Commit any verification fixes**

If fixes were required:

```bash
git add demo/App.spec.ts demo/ShadcnDemo.vue demo/style.css
git commit -m "fix: stabilize deepseek chatbot demo"
```

If no fixes were required, do not create an empty commit.
