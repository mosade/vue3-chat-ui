# Vue3 AI Chat Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `vue3-ai-chat` Vue 3 + TypeScript component package and a demo that showcases the reusable default UI and headless state machine.

**Architecture:** The package exports typed chat primitives from `src/types.ts`, state management from `src/composables/useAiChat.ts`, and focused Vue components under `src/components/`. A Vite demo in `demo/` imports the package source directly and exercises uncontrolled, controlled, streaming, stop, retry, slots, and theming behavior.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Vue Test Utils, vue-tsc, plain CSS.

---

## File Structure

- Create `package.json`: scripts, peer dependency on Vue, dev dependencies, package export metadata.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`: build, typecheck, and test setup.
- Create `index.html`: Vite demo entry shell.
- Create `src/types.ts`: public message, adapter, context, and error types.
- Create `src/composables/useAiChat.ts`: provider-neutral send/stop/retry/clear state machine.
- Create `src/components/AiChat.vue`: public component that wires composable, child components, events, and slots.
- Create `src/components/ChatMessageList.vue`: message list, empty state, auto-scroll.
- Create `src/components/ChatMessage.vue`: role/status rendering and slots.
- Create `src/components/ChatComposer.vue`: textarea input, Enter and Shift+Enter behavior, send/stop affordance.
- Create `src/components/ChatToolbar.vue`: clear and retry actions plus extension slot.
- Create `src/style.css`: default compact neutral theme using required CSS variables and stable classes.
- Create `src/index.ts`: public exports and CSS import.
- Create `demo/App.vue`, `demo/main.ts`, `demo/style.css`: interactive demo page.
- Create `src/**/*.test.ts` / `src/**/*.spec.ts`: composable and component tests.

## Tasks

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `demo/main.ts`
- Create: `demo/App.vue`
- Create: `demo/style.css`

- [ ] **Step 1: Add package and tooling config**

Create a Vue library package with scripts:

```json
{
  "name": "vue3-ai-chat",
  "version": "0.1.0",
  "type": "module",
  "private": false,
  "main": "./dist/vue3-ai-chat.umd.cjs",
  "module": "./dist/vue3-ai-chat.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/vue3-ai-chat.js",
      "require": "./dist/vue3-ai-chat.umd.cjs"
    },
    "./style.css": "./dist/style.css"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vue-tsc -p tsconfig.json --declaration --emitDeclarationOnly && vite build",
    "test": "vitest run",
    "typecheck": "vue-tsc -p tsconfig.json --noEmit"
  },
  "peerDependencies": {
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.4",
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.1",
    "typescript": "^5.8.3",
    "vite": "^5.4.19",
    "vitest": "^2.1.9",
    "vue": "^3.5.16",
    "vue-tsc": "^2.2.10"
  }
}
```

- [ ] **Step 2: Add TypeScript and Vite config**

Configure strict Vue SFC compilation, library build from `src/index.ts`, and Vitest with `jsdom`.

- [ ] **Step 3: Add minimal demo shell**

Create `index.html`, `demo/main.ts`, and a placeholder `demo/App.vue` that will later render the chat demo.

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install without errors.

### Task 2: Public Types

**Files:**
- Create: `src/types.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Write public types**

Define `AiChatRole`, `AiChatMessageStatus`, `AiChatMessage`, `AiChatSendContext`, `AiChatAdapter`, and `AiChatError` exactly matching the spec.

- [ ] **Step 2: Export public API**

Export all public types from `src/index.ts`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: Typecheck passes once dependencies are installed.

### Task 3: useAiChat Composable

**Files:**
- Create: `src/composables/useAiChat.ts`
- Create: `src/composables/useAiChat.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing composable tests**

Tests cover adding user and assistant messages on send, streaming chunk order, done status, error status and emitted error callback, stop abort behavior, retry of failed prompt, clear, and controlled update emission.

- [ ] **Step 2: Run composable tests to verify failure**

Run: `npm test -- src/composables/useAiChat.test.ts`

Expected: FAIL because `useAiChat` does not exist yet.

- [ ] **Step 3: Implement composable**

Implement controlled/uncontrolled state, one active request, adapter/onSend precedence, append/update helpers, abort handling, retry, clear, and normalized errors.

- [ ] **Step 4: Export composable**

Export `useAiChat` and related options type from `src/index.ts`.

- [ ] **Step 5: Run composable tests**

Run: `npm test -- src/composables/useAiChat.test.ts`

Expected: PASS.

### Task 4: Component Rendering and Interaction

**Files:**
- Create: `src/components/ChatComposer.vue`
- Create: `src/components/ChatMessage.vue`
- Create: `src/components/ChatMessageList.vue`
- Create: `src/components/ChatToolbar.vue`
- Create: `src/components/AiChat.vue`
- Create: `src/components/AiChat.spec.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing component tests**

Tests cover empty state, user and assistant rendering, Enter submit, Shift+Enter newline, disabled controls, send/stop/retry/clear/error/update events, and slot rendering.

- [ ] **Step 2: Run component tests to verify failure**

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: FAIL because components do not exist yet.

- [ ] **Step 3: Implement child components**

Implement focused child components with semantic buttons, accessible labels, ARIA loading/error text, and required slots.

- [ ] **Step 4: Implement `AiChat.vue`**

Wire public props, emits, controlled/uncontrolled messages, child components, state actions, and all documented slots.

- [ ] **Step 5: Export components**

Export `AiChat` as named and default component from `src/index.ts`.

- [ ] **Step 6: Run component tests**

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: PASS.

### Task 5: Styling and Demo

**Files:**
- Create: `src/style.css`
- Modify: `src/index.ts`
- Modify: `demo/App.vue`
- Modify: `demo/style.css`

- [ ] **Step 1: Add package stylesheet**

Implement the required class names, required CSS variables, compact neutral theme, role/status layouts, focus states, responsive behavior, and disabled states.

- [ ] **Step 2: Import stylesheet from package entry**

Add `import './style.css'` to `src/index.ts`.

- [ ] **Step 3: Implement demo**

Create a first-screen demo with an interactive chat, streaming mock adapter, stop/retry/clear controls, controlled messages preview, custom header/footer, custom avatar/content/action slots, and a small theme panel.

- [ ] **Step 4: Run demo locally**

Run: `npm run dev -- --host 0.0.0.0`

Expected: Vite serves the demo and the chat UI is interactive.

### Task 6: Final Verification

**Files:**
- All package and demo files.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS and `dist/` contains library output and declarations.

- [ ] **Step 4: Audit against spec**

Re-read `docs/superpowers/specs/2026-06-17-ai-chat-component-design.md` and verify every public API, flow, slot, styling variable, accessibility item, error handling behavior, and testing strategy item is implemented or covered.

