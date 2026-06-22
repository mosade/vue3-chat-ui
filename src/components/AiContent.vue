<script lang="ts">
import { computed, defineComponent, h, watch, type PropType, type VNodeChild } from 'vue'
import { createAiContentBlocks } from '../content/blocks'
import { plainTextParser } from '../parsers'
import type { AiChatMessage, AiContentBlock, AiContentParsed, AiContentParser } from '../types'

export default defineComponent({
  name: 'AiContent',
  props: {
    content: {
      type: String,
      default: ''
    },
    parser: {
      type: Object as PropType<AiContentParser>,
      default: () => plainTextParser
    },
    streaming: {
      type: Boolean,
      default: false
    },
    message: {
      type: Object as PropType<AiChatMessage | undefined>,
      default: undefined
    }
  },
  setup(props) {
    const parsedCache = new Map<string, AiContentParsed>()

    const blocks = computed(() =>
      createAiContentBlocks(props.content, {
        streaming: props.streaming
      })
    )

    watch(
      blocks,
      (nextBlocks) => {
        const nextIds = new Set(nextBlocks.filter((block) => block.stable).map((block) => block.id))

        Array.from(parsedCache.keys()).forEach((id) => {
          if (!nextIds.has(id)) {
            parsedCache.delete(id)
          }
        })
      },
      { immediate: true }
    )

    const parseBlock = (block: AiContentBlock) => {
      if (block.stable) {
        const cached = parsedCache.get(block.id)

        if (cached) {
          return cached
        }
      }

      const parsed = props.parser.parse(block.renderContent, {
        streaming: props.streaming,
        blockId: block.id,
        stable: block.stable,
        kind: block.kind,
        message: props.message
      })

      if (block.stable) {
        parsedCache.set(block.id, parsed)
      }

      return parsed
    }

    const parsedBlocks = computed(() =>
      blocks.value.map((block) => ({
        block,
        parsed: parseBlock(block)
      }))
    )

    const rendersHtml = computed(() =>
      parsedBlocks.value.some(({ parsed }) => parsed.type === 'html')
    )

    const normalizeVNodeContent = (content: VNodeChild) => {
      if (content === null || content === undefined || typeof content === 'boolean') {
        return []
      }

      return Array.isArray(content) ? content : [content]
    }

    const renderBlock = ({ block, parsed }: { block: AiContentBlock; parsed: AiContentParsed }) => {
      const children =
        parsed.type === 'html'
          ? [h('span', { class: 'ai-content__html', innerHTML: parsed.content })]
          : parsed.type === 'vnode'
            ? normalizeVNodeContent(parsed.content)
          : parsed.content

      return h(
        'div',
        {
          key: block.id,
          class: [
            'ai-content__block',
            `ai-content__block--${block.kind}`,
            parsed.type === 'html' ? 'ai-content__block--html' : ''
          ],
          'data-ai-content-block': block.id
        },
        children
      )
    }

    return () =>
      h(
        'div',
        {
          class: ['ai-content', rendersHtml.value ? 'ai-content--html' : ''],
          'data-streaming': props.streaming ? 'true' : 'false'
        },
        parsedBlocks.value.map(renderBlock)
      )
  }
})
</script>
