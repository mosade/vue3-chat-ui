<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    input?: string
    defaultInput?: string
    disabled?: boolean
    active?: boolean
    placeholder?: string
    autoFocus?: boolean
  }>(),
  {
    input: undefined,
    defaultInput: '',
    disabled: false,
    active: false,
    placeholder: 'Ask anything...',
    autoFocus: false
  }
)

const emit = defineEmits<{
  'update:input': [value: string]
  submit: [prompt: string]
  stop: []
}>()

const internalDraft = ref(props.defaultInput)
const textarea = ref<HTMLTextAreaElement | null>(null)
const isControlled = computed(() => props.input !== undefined)
const draft = computed({
  get() {
    return isControlled.value ? props.input ?? '' : internalDraft.value
  },
  set(value: string) {
    if (!isControlled.value) {
      internalDraft.value = value
    }

    emit('update:input', value)
  }
})

watch(
  () => props.defaultInput,
  (value) => {
    if (!isControlled.value) {
      internalDraft.value = value
    }
  }
)

const canSubmit = computed(() => Boolean(draft.value.trim()) && !props.disabled && !props.active)

const submit = () => {
  const prompt = draft.value.trim()
  if (!canSubmit.value) {
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

defineExpose({
  focus: () => textarea.value?.focus(),
  submit
})
</script>

<template>
  <form class="ai-chat__composer" @submit.prevent="submit">
    <slot
      name="prefix"
      :draft="draft"
      :can-submit="canSubmit"
      :actions="{ submit, stop: () => emit('stop'), focus: () => textarea?.focus() }"
    />

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
      <slot
        name="actions"
        :draft="draft"
        :can-submit="canSubmit"
        :actions="{ submit, stop: () => emit('stop'), focus: () => textarea?.focus() }"
      />

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
        :disabled="!canSubmit"
      >
        Send
      </button>
    </div>
  </form>
</template>
