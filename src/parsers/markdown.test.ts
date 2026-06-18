import { describe, expect, it } from 'vitest'
import { markdownParser } from './markdown'
import type { AiChatMessage } from '../types'

const message: AiChatMessage = {
  id: 'm1',
  role: 'assistant',
  content: '',
  status: 'done'
}

describe('markdownParser', () => {
  it('renders safe basic markdown to html', () => {
    const parsed = markdownParser.parse(
      '**Bold** and `code`\n[Vue](https://vuejs.org)',
      {
        message,
        streaming: false,
        blockId: message.id,
        stable: true,
        kind: 'paragraph'
      }
    )

    expect(parsed.type).toBe('html')
    expect(parsed.content).toContain('<strong>Bold</strong>')
    expect(parsed.content).toContain('<code>code</code>')
    expect(parsed.content).toContain('href="https://vuejs.org"')
    expect(parsed.content).toContain('<br>')
  })

  it('escapes unsafe html and blocks unsafe links', () => {
    const parsed = markdownParser.parse(
      '<img src=x onerror=alert(1)> [bad](javascript:alert(1))',
      {
        message,
        streaming: false,
        blockId: message.id,
        stable: true,
        kind: 'paragraph'
      }
    )

    expect(parsed.content).toContain('&lt;img')
    expect(parsed.content).not.toContain('<img')
    expect(parsed.content).not.toContain('javascript:')
  })

  it('accepts ai content parser context without a message', () => {
    const parsed = markdownParser.parse('**Hello**', {
      streaming: true,
      blockId: 'live:0',
      stable: false,
      kind: 'paragraph'
    })

    expect(parsed).toEqual({
      type: 'html',
      content: '<strong>Hello</strong>'
    })
  })
})
