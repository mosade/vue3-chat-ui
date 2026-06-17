# AiChat Feature Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the features listed in `docs/ai-chat-feature-recommendations copy.md`, starting with the highest-priority API and UX gaps and continuing through product-grade chat capabilities.

**Architecture:** Extend the existing provider-neutral Vue component package without introducing a UI framework. Keep stateful behavior in `useAiChat`, view behavior in focused components, and shared data contracts in `src/types.ts`. Add utilities for rendering/export behavior where they can be tested independently.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Vue Test Utils, plain CSS.

---

## File Structure

- Modify `src/types.ts`: add attachment, source, labels, export, and extended status types.
- Modify `src/composables/useAiChat.ts`: add retry/edit helpers, stopped status, persistence callback integration, and attachment-aware send context.
- Modify `src/components/AiChat.vue`: wire new props, labels, markdown rendering, message actions, suggestions, composer model, and exposed imperative methods.
- Modify `src/components/ChatComposer.vue`: support controlled input, labels, focus exposure, auto-grow, max length, shortcut configuration, IME safety, attachment hooks, and slot state.
- Modify `src/components/ChatMessage.vue`: render markdown content, default actions, citations/sources, attachments, versions, labels, and richer statuses.
- Modify `src/components/ChatMessageList.vue`: improve bottom-aware auto-scroll and expose jump-to-latest state.
- Modify `src/components/ChatToolbar.vue`: use configurable labels and expose extension state.
- Create `src/utils/markdown.ts`: safe minimal Markdown renderer or wrapper around a dependency if one is intentionally added.
- Create `src/utils/exportMessages.ts`: export messages as Markdown, JSON, and plain text.
- Modify `src/components/AiChat.spec.ts`: component-level tests for the public features.
- Modify `src/composables/useAiChat.test.ts`: state-machine tests for new actions and statuses.
- Modify `README.md`: document all new props, events, slots, types, and examples.
- Modify `docs/ai-chat-feature-recommendations copy.md`: mark completed implementation status when features are verified.

## Task 1: API Completion And Basic UX

**Files:**
- Modify: `src/components/AiChat.vue`
- Modify: `src/components/ChatComposer.vue`
- Modify: `src/components/ChatMessage.vue`
- Modify: `src/components/ChatMessageList.vue`
- Modify: `src/components/ChatToolbar.vue`
- Modify: `src/composables/useAiChat.ts`
- Modify: `src/types.ts`
- Create: `src/utils/markdown.ts`
- Modify: `src/components/AiChat.spec.ts`
- Modify: `src/composables/useAiChat.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing tests for Markdown rendering**

Add tests proving `markdown` renders basic strong text, links, code, and line breaks safely, and that plain text remains the default.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: FAIL because `markdown` is currently ignored.

- [ ] **Step 2: Implement safe Markdown rendering**

Add `src/utils/markdown.ts` with escaping and a small supported subset. Wire it through `AiChat.vue` and `ChatMessage.vue` without using raw user HTML unless escaped first.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: PASS for Markdown tests.

- [ ] **Step 3: Write failing tests for copy, retry, and edit/resubmit**

Add tests proving default message actions can copy content, retry an errored assistant response, and edit a user message then resubmit it.

Run: `npm test -- src/components/AiChat.spec.ts src/composables/useAiChat.test.ts`

Expected: FAIL because only regenerate exists.

- [ ] **Step 4: Implement message actions and composable helpers**

Add retry/edit behavior to `useAiChat`, expose actions through slots, and render accessible default action buttons.

Run: `npm test -- src/components/AiChat.spec.ts src/composables/useAiChat.test.ts`

Expected: PASS for message-action tests.

- [ ] **Step 5: Write failing tests for controllable composer input**

Add tests for `v-model:input`, external prefill, input update events, submit clearing behavior, slot state, and exposed focus.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: FAIL because composer draft is internal.

- [ ] **Step 6: Implement controllable composer input**

Add `input` prop, `defaultInput`, `update:input`, slot state, and imperative `focus` exposure.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: PASS for composer tests.

- [ ] **Step 7: Write failing tests for labels and i18n**

Add tests proving configurable labels affect visible buttons, empty state, status text, and aria labels.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: FAIL because labels are hard-coded.

- [ ] **Step 8: Implement labels**

Add an `AiChatLabels` type with defaults and merge partial user labels in `AiChat.vue`. Pass labels to child components.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: PASS for labels tests.

- [ ] **Step 9: Write failing tests for bottom-aware auto-scroll**

Add tests proving auto-scroll only runs when the viewport is near the bottom and exposes jump-to-latest state when content arrives above the current scroll.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: FAIL because current auto-scroll always scrolls.

- [ ] **Step 10: Implement bottom-aware auto-scroll**

Update `ChatMessageList.vue` to track bottom proximity and expose `jumpToLatest`.

Run: `npm test -- src/components/AiChat.spec.ts`

Expected: PASS for auto-scroll tests.

## Task 2: Product-Grade Chat Capabilities

**Files:**
- Modify: `src/types.ts`
- Modify: `src/composables/useAiChat.ts`
- Modify: `src/components/AiChat.vue`
- Modify: `src/components/ChatComposer.vue`
- Modify: `src/components/ChatMessage.vue`
- Modify: `src/components/AiChat.spec.ts`
- Modify: `src/composables/useAiChat.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Add attachment tests and types**

Test image/file attachment metadata, pasted files, drag-and-drop files, and `AiChatSendContext.attachments`.

- [ ] **Step 2: Implement attachment model and composer hooks**

Add attachment state, slots, remove actions, and pass attachments into outgoing messages and send context.

- [ ] **Step 3: Add citations/source tests and rendering**

Test source metadata on messages and default citation rendering with slots for customization.

- [ ] **Step 4: Add persistence hook tests and integration**

Test `conversationId` and `onPersist(messages, context)` calls after send, retry, edit, regenerate, stop, and clear.

- [ ] **Step 5: Add stopped/cancelled status tests and implementation**

Test that manual stop produces a distinct status and visible label instead of `done`.

- [ ] **Step 6: Add suggestions tests and implementation**

Test suggestion chips in empty state and after assistant replies, with click-to-submit behavior.

## Task 3: Advanced Experience And Scale

**Files:**
- Modify: `src/types.ts`
- Modify: `src/composables/useAiChat.ts`
- Modify: `src/components/AiChat.vue`
- Modify: `src/components/ChatComposer.vue`
- Modify: `src/components/ChatMessage.vue`
- Modify: `src/components/ChatMessageList.vue`
- Create: `src/utils/exportMessages.ts`
- Modify: `src/components/AiChat.spec.ts`
- Modify: `src/composables/useAiChat.test.ts`
- Create: `src/utils/exportMessages.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Add message versioning tests and implementation**

Preserve regenerated assistant versions and allow switching between versions.

- [ ] **Step 2: Add export helper tests and implementation**

Export messages as Markdown, JSON, and plain text.

- [ ] **Step 3: Add virtual-list integration point tests and implementation**

Expose list slot state that supports replacing the default renderer with a virtual list while preserving actions.

- [ ] **Step 4: Add input enhancement tests and implementation**

Support auto-grow textarea, configurable submit shortcut, IME safety, max length, character count, token-count hook, and paste handling.

- [ ] **Step 5: Add accessibility verification tests**

Test keyboard access for message actions, focus restoration, configurable aria labels, and live-region behavior.

## Final Verification

- [ ] Run `npm test`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`
- [ ] Review `README.md` against the implemented API.
- [ ] Update `docs/ai-chat-feature-recommendations copy.md` with implementation status.
