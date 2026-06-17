<script setup lang="ts">
withDefaults(
  defineProps<{
    disabled?: boolean
    canRetry?: boolean
  }>(),
  {
    disabled: false,
    canRetry: false
  }
)

const emit = defineEmits<{
  clear: []
  retry: []
}>()
</script>

<template>
  <div class="ai-chat__toolbar" aria-label="Chat actions">
    <button
      class="ai-chat__button ai-chat__button--secondary"
      type="button"
      aria-label="Retry last prompt"
      :disabled="disabled || !canRetry"
      @click="emit('retry')"
    >
      Retry
    </button>
    <button
      class="ai-chat__button ai-chat__button--secondary"
      type="button"
      aria-label="Clear messages"
      :disabled="disabled"
      @click="emit('clear')"
    >
      Clear
    </button>
    <slot />
  </div>
</template>
