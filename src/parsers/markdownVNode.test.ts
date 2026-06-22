import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import AiContent from '../components/AiContent.vue'
import { createMarkdownVNodeParser } from './markdownVNode'
import type { AiChatSource } from '../types'

describe('createMarkdownVNodeParser', () => {
  it('renders inline widgets inside markdown nodes', () => {
    const CitationChip = defineComponent({
      name: 'CitationChip',
      props: {
        label: {
          type: String,
          required: true
        },
        title: {
          type: String,
          required: true
        }
      },
      setup(props) {
        return () =>
          h(
            'button',
            {
              class: 'citation-chip',
              title: props.title,
              type: 'button'
            },
            props.label
          )
      }
    })
    const source: AiChatSource = {
      id: '1',
      index: 1,
      title: 'Reference title',
      snippet: 'Reference details'
    }
    const parser = createMarkdownVNodeParser({
      inlineWidgets: [
        {
          name: 'citation',
          pattern: /\[\[critten\s+(\d+)\]\]/gi,
          resolve: (match, context) => {
            const index = Number(match[1])
            const matchedSource = context.message?.sources?.find(
              (item) => item.index === index || item.id === String(index)
            )

            return matchedSource
              ? {
                  key: `citation:${index}`,
                  props: {
                    label: `[${index}]`,
                    title: matchedSource.title
                  }
                }
              : null
          },
          render: (props) =>
            h(CitationChip, {
              label: String(props.label),
              title: String(props.title)
            }),
          fallback: (match) => `[${match[1]}]`
        }
      ]
    })

    const wrapper = mount(AiContent, {
      props: {
        content: '# this content is from some reference [[critten 1]]',
        message: {
          id: 'a1',
          role: 'assistant',
          content: '# this content is from some reference [[critten 1]]',
          sources: [source]
        },
        parser
      }
    })

    expect(wrapper.find('h1').text()).toBe('this content is from some reference [1]')
    expect(wrapper.find('.citation-chip').attributes('title')).toBe('Reference title')
  })
})
