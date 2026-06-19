<script lang="ts">
import { computed, defineComponent, h, nextTick, ref, toRef, type PropType, type VNodeChild } from 'vue'
import ChatComposer from './ChatComposer.vue'
import ChatMessage from './ChatMessage.vue'
import { useAutoScroll } from '../composables/useAutoScroll'
import { useAiChat } from '../composables/useAiChat'
import { plainTextParser } from '../parsers'
import type {
  AiContentParser,
  AiChatAdapter,
  AiChatError,
  AiChatInputSlotContext,
  AiChatMessage,
  AiChatMessageSlotContext,
  AiChatRegeneratePayload,
  AiChatRootActions,
  AiChatRootSlotContext,
  AiChatSendContext
} from '../types'

type ChatComposerPublic = {
  focus: () => void
  submit: () => void
}

export default defineComponent({
  name: 'AiChat',
  props: {
    messages: Array as PropType<AiChatMessage[] | undefined>,
    defaultMessages: Array as PropType<AiChatMessage[] | undefined>,
    input: String,
    defaultInput: {
      type: String,
      default: ''
    },
    conversationId: String,
    adapter: Object as PropType<AiChatAdapter | undefined>,
    sendHandler: Function as PropType<((context: AiChatSendContext) => Promise<string | void>) | undefined>,
    onPersist: Function as PropType<
      | ((
          messages: AiChatMessage[],
          context: {
            conversationId?: string
            reason: 'send' | 'stop' | 'regenerate' | 'retry' | 'edit' | 'clear' | 'set'
          }
        ) => void)
      | undefined
    >,
    loading: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    autoFocus: {
      type: Boolean,
      default: false
    },
    autoScroll: {
      type: Boolean,
      default: true
    },
    contentParser: Object as PropType<AiContentParser | undefined>,
    parser: {
      type: Object as PropType<AiContentParser>,
      default: () => plainTextParser
    }
  },
  emits: ['update:messages', 'update:input', 'send', 'stop', 'regenerate', 'clear', 'error'],
  setup(props, { emit, slots }) {
    const chat = useAiChat({
      conversationId: props.conversationId,
      messages: toRef(props, 'messages'),
      defaultMessages: props.defaultMessages,
      onSend: (context) => {
        const sendHandler = props.sendHandler ?? props.adapter?.send
        return sendHandler?.(context) ?? Promise.resolve()
      },
      onUpdateMessages: (nextMessages) => emit('update:messages', nextMessages),
      onPersist: (nextMessages, context) => props.onPersist?.(nextMessages, context),
      onError: (error, context) => emit('error', error, context)
    })

    const composerRef = ref<ChatComposerPublic | null>(null)
    const isBusy = computed(() => props.loading || chat.isActive.value)
    const isActive = computed(() => chat.isActive.value)
    const isDisabled = computed(() => props.disabled)
    const resolvedContentParser = computed(() => props.contentParser ?? props.parser ?? plainTextParser)

    const internalDraft = ref(props.defaultInput)
    const isInputControlled = computed(() => props.input !== undefined)
    const draft = computed({
      get: () => (isInputControlled.value ? props.input ?? '' : internalDraft.value),
      set: (value: string) => {
        if (!isInputControlled.value) {
          internalDraft.value = value
        }

        emit('update:input', value)
      }
    })
    const canSend = computed(() => Boolean(draft.value.trim()) && !isDisabled.value && !isBusy.value)

    const editingMessageId = ref<string | null>(null)
    const editDraft = ref('')
    const canSaveEdit = computed(() =>
      Boolean(editDraft.value.trim()) && !isDisabled.value && !isBusy.value
    )
    const autoScrollEnabled = computed(() => props.autoScroll)
    const {
      viewportRef,
      isNearBottom,
      showJumpToLatest,
      jumpToLatest,
      updateScrollState
    } = useAutoScroll({
      autoScroll: autoScrollEnabled,
      watchSource: () =>
        chat.messages.value
          .map((message) =>
            [
              message.id,
              message.content,
              message.status,
              message.phase,
              JSON.stringify(message.traces ?? [])
            ].join(':')
          )
          .join('|')
    })

    const submit = async (prompt: string) => {
      emit('send', prompt)
      await chat.send(prompt)

      if (props.autoScroll) {
        await nextTick()
        jumpToLatest()
      }
    }

    const stop = () => {
      emit('stop')
      chat.stop()
    }

    const clear = () => {
      emit('clear')
      chat.clear()
    }

    const regenerate = async (message: AiChatMessage) => {
      const payload = await chat.regenerate(message.id)
      if (payload) {
        emit('regenerate', payload)
      }
      return payload
    }

    const retry = async (message: AiChatMessage) => chat.retry(message.id)

    const copyMessage = async (message: AiChatMessage) => {
      await navigator.clipboard?.writeText(message.content)
    }

    const startEdit = (message: AiChatMessage) => {
      if (message.role !== 'user' || isDisabled.value || isBusy.value) {
        return
      }

      editingMessageId.value = message.id
      editDraft.value = message.content
    }

    const updateEditDraft = (value: string) => {
      editDraft.value = value
    }

    const cancelEdit = () => {
      editingMessageId.value = null
      editDraft.value = ''
    }

    const saveEdit = async (message: AiChatMessage) => {
      if (!canSaveEdit.value || editingMessageId.value !== message.id) {
        return
      }

      await chat.editUserMessage(message.id, editDraft.value)
      cancelEdit()
    }

    const rootActions: AiChatRootActions = {
      send: submit,
      stop,
      clear
    }

    const getRootContext = (): AiChatRootSlotContext => ({
      messages: chat.messages.value,
      active: isBusy.value,
      disabled: isDisabled.value,
      error: chat.error.value,
      showJumpToLatest: showJumpToLatest.value,
      isNearBottom: isNearBottom.value,
      jumpToLatest,
      actions: rootActions
    })

    const inputActions = {
      updateDraft: (value: string) => {
        draft.value = value
      },
      send: async () => {
        const prompt = draft.value.trim()
        if (!prompt || !canSend.value) {
          return
        }

        draft.value = ''
        await submit(prompt)
      },
      stop,
      focus: () => composerRef.value?.focus()
    }

    const getMessageContext = (message: AiChatMessage, index: number): AiChatMessageSlotContext => ({
      message,
      index,
      parsed: resolvedContentParser.value.parse(message.content, {
        message,
        streaming: message.status === 'streaming',
        blockId: message.id,
        stable: message.status !== 'streaming',
        kind: 'paragraph'
      }),
      phase: message.phase,
      status: message.status,
      traces: message.traces ?? [],
      sources: message.sources ?? [],
      active: isBusy.value,
      disabled: isDisabled.value,
      editing: editingMessageId.value === message.id,
      editDraft: editingMessageId.value === message.id ? editDraft.value : '',
      canSaveEdit: editingMessageId.value === message.id && canSaveEdit.value,
      canRetry: chat.canRetry(message),
      canRegenerate: chat.canRegenerate(message),
      actions: {
        copy: () => copyMessage(message),
        retry: () => retry(message),
        regenerate: () => regenerate(message)
      },
      editActions: {
        start: () => startEdit(message),
        update: updateEditDraft,
        save: () => saveEdit(message),
        cancel: cancelEdit
      }
    })

    const renderFallbackMessage = (context: AiChatMessageSlotContext) =>
      h(ChatMessage, {
        ...context,
        contentParser: resolvedContentParser.value
      })

    const renderMessage = (message: AiChatMessage, index: number): VNodeChild => {
      const context = getMessageContext(message, index)

      if (slots.message) {
        return slots.message(context)
      }

      return renderFallbackMessage(context)
    }

    const renderMessages = (): VNodeChild => {
      const rootContext = getRootContext()
      const children =
        chat.messages.value.length === 0
          ? [
              h(
                'div',
                { class: 'ai-chat__empty' },
                slots.empty?.(rootContext) ?? 'Start a conversation'
              )
            ]
          : chat.messages.value.map(renderMessage)

      return h(
        'section',
        {
          ref: viewportRef,
          class: 'ai-chat__messages',
          'aria-live': 'polite',
          onScroll: updateScrollState
        },
        children
      )
    }

    const renderInput = (): VNodeChild => {
      const context: AiChatInputSlotContext = {
        draft: draft.value,
        canSend: canSend.value,
        active: isActive.value,
        disabled: isDisabled.value || isBusy.value,
        actions: inputActions
      }

      if (slots.input) {
        return slots.input(context)
      }

      return h(ChatComposer, {
        ref: composerRef,
        input: draft.value,
        disabled: context.disabled,
        active: isActive.value,
        autoFocus: props.autoFocus,
        'onUpdate:input': (value: string) => {
          draft.value = value
        },
        onSubmit: async (prompt: string) => {
          draft.value = ''
          await submit(prompt)
        },
        onStop: stop
      })
    }

    return () => {
      const context = getRootContext()

      return h(
        'div',
        {
          class: 'ai-chat',
          'aria-busy': isBusy.value
        },
        [
          slots.header?.(context),
          renderMessages(),
          renderInput(),
          slots.footer?.(context)
        ]
      )
    }
  }
})
</script>
