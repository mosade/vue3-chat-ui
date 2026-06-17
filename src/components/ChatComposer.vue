<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    active?: boolean
    placeholder?: string
    autoFocus?: boolean
  }>(),
  {
    disabled: false,
    active: false,
    placeholder: 'Ask anything...',
    autoFocus: false
  }
)

const emit = defineEmits<{
  submit: [prompt: string]
  stop: []
}>()

const draft = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

const submit = () => {
  const prompt = draft.value.trim()
  if (!prompt || props.disabled || props.active) {
    return
  }

  emit('submit', prompt)
  draft.value = ''
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }

  event.preventDefault()
  submit()
}

onMounted(async () => {
  if (!props.autoFocus) {
    return
  }

  await nextTick()
  textarea.value?.focus()
})
</script>

<template>
  <form class="ai-chat__composer" @submit.prevent="submit">
    <slot name="prefix" />

    <textarea
      ref="textarea"
      v-model="draft"
      class="ai-chat__composer-input"
      :placeholder="placeholder"
      :disabled="disabled"
      aria-label="Message prompt"
      rows="2"
      @keydown="onKeydown"
    />

    <div class="ai-chat__composer-actions">
      <slot name="actions" />

      <button
        v-if="active"
        class="ai-chat__button ai-chat__button--secondary"
        type="button"
        aria-label="Stop response"
        @click="emit('stop')"
      >
        Stop
      </button>
      <button
        v-else
        class="ai-chat__button"
        type="submit"
        aria-label="Send message"
        :disabled="disabled || !draft.trim()"
      >
        Send
      </button>
    </div>
  </form>
</template>
