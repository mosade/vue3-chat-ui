<script setup lang="ts">
withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  {
    disabled: false
  }
)

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <div class="ai-chat__toolbar" aria-label="Chat actions">
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
