<script lang="ts">
import { computed, defineComponent, h, watch, type PropType } from 'vue'
import { createAiContentBlocks } from '../content/blocks'
import { plainTextParser } from '../parsers'
import type { AiContentBlock, AiContentParsed, AiContentParser } from '../types'

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
        kind: block.kind
      })

      if (block.stable) {
        parsedCache.set(block.id, parsed)
      }

      return parsed
    }

    const renderBlock = (block: AiContentBlock) => {
      const parsed = parseBlock(block)
      const children =
        parsed.type === 'html'
          ? [h('span', { class: 'ai-content__html', innerHTML: parsed.content })]
          : parsed.content

      return h(
        'div',
        {
          key: block.id,
          class: ['ai-content__block', `ai-content__block--${block.kind}`],
          'data-ai-content-block': block.id
        },
        children
      )
    }

    return () =>
      h(
        'div',
        {
          class: 'ai-content',
          'data-streaming': props.streaming ? 'true' : 'false'
        },
        blocks.value.map(renderBlock)
      )
  }
})
</script>
