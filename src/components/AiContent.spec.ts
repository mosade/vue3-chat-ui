import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import AiContent from './AiContent.vue'
import type { AiContentParser } from '../types'

const htmlParser: AiContentParser = {
  parse: (content) => ({
    type: 'html',
    content: content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
  })
}

describe('AiContent', () => {
  it('renders raw content as safe text by default', () => {
    const wrapper = mount(AiContent, {
      props: {
        content: '<strong>Hello</strong>'
      }
    })

    expect(wrapper.text()).toContain('<strong>Hello</strong>')
    expect(wrapper.find('strong').exists()).toBe(false)
  })

  it('renders parsed html from an external parser', () => {
    const parser: AiContentParser = {
      parse: (content) => ({
        type: 'html',
        content: `<strong>${content}</strong>`
      })
    }

    const wrapper = mount(AiContent, {
      props: {
        content: 'Hello',
        parser
      }
    })

    expect(wrapper.find('strong').text()).toBe('Hello')
  })

  it('marks html parser output so block wrappers do not affect markdown layout', () => {
    const parser: AiContentParser = {
      parse: (content) => ({
        type: 'html',
        content: `<p>${content}</p>`
      })
    }

    const wrapper = mount(AiContent, {
      props: {
        content: 'First paragraph\n\nSecond paragraph',
        parser
      }
    })

    expect(wrapper.classes()).toContain('ai-content--html')
    expect(wrapper.findAll('.ai-content__block')).toHaveLength(2)
    expect(wrapper.findAll('.ai-content__block').every((block) => block.classes().includes('ai-content__block--html'))).toBe(
      true
    )
  })

  it('keeps plain text blocks as layout blocks', () => {
    const wrapper = mount(AiContent, {
      props: {
        content: 'First paragraph\n\nSecond paragraph'
      }
    })

    expect(wrapper.classes()).not.toContain('ai-content--html')
    expect(wrapper.findAll('.ai-content__block').some((block) => block.classes().includes('ai-content__block--html'))).toBe(
      false
    )
  })

  it('styles html blocks without adding AiContent spacing around markdown nodes', () => {
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8')

    expect(css).toContain('.ai-content--html')
    expect(css).toContain('white-space: normal')
    expect(css).toContain('.ai-content--html > .ai-content__block--html')
    expect(css).toContain('display: contents')
  })

  it('passes block context to the parser', () => {
    const parse = vi.fn<AiContentParser['parse']>((content) => ({
      type: 'text',
      content
    }))

    mount(AiContent, {
      props: {
        content: 'First paragraph\n\nSecond',
        streaming: true,
        parser: { parse }
      }
    })

    expect(parse).toHaveBeenCalledWith('First paragraph', {
      streaming: true,
      blockId: 'block:0:c002a23f41b9e331',
      stable: true,
      kind: 'paragraph'
    })
    expect(parse).toHaveBeenCalledWith('Second', {
      streaming: true,
      blockId: 'live:1',
      stable: false,
      kind: 'paragraph'
    })
  })

  it('caches parsed stable blocks while only reparsing the live block', async () => {
    const parse = vi.fn<AiContentParser['parse']>((content) => ({
      type: 'text',
      content
    }))
    const wrapper = mount(AiContent, {
      props: {
        content: 'First paragraph\n\nSecond',
        streaming: true,
        parser: { parse }
      }
    })

    await wrapper.setProps({
      content: 'First paragraph\n\nSecond update'
    })

    expect(parse).toHaveBeenCalledTimes(3)
    expect(parse.mock.calls.map(([content]) => content)).toEqual([
      'First paragraph',
      'Second',
      'Second update'
    ])
  })

  it('does not remount a stable image block when streaming content is appended', async () => {
    const wrapper = mount(AiContent, {
      props: {
        content: '![Chart](https://example.com/chart.png)',
        streaming: true,
        parser: htmlParser
      },
      attachTo: document.body
    })

    const image = wrapper.find('img').element

    await wrapper.setProps({
      content: '![Chart](https://example.com/chart.png)\n\nMore text'
    })

    expect(wrapper.find('img').element).toBe(image)
    wrapper.unmount()
  })

  it('is exported from the package entry', async () => {
    const entry = await import('../index')

    expect(entry.AiContent).toBeTruthy()
  })
})
