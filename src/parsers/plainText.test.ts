import { describe, expect, it } from 'vitest'
import { plainTextParser } from './plainText'
import type { AiChatMessage } from '../types'

const message: AiChatMessage = {
  id: 'm1',
  role: 'assistant',
  content: '',
  status: 'done'
}

describe('plainTextParser', () => {
  it('returns plain text content without producing html', () => {
    expect(
      plainTextParser.parse('<strong>Hello</strong>', {
        message,
        streaming: false,
        blockId: message.id,
        stable: true,
        kind: 'paragraph'
      })
    ).toEqual({
      type: 'text',
      content: '<strong>Hello</strong>'
    })
  })

  it('accepts ai content parser context without a message', () => {
    expect(
      plainTextParser.parse('Hello', {
        streaming: true,
        blockId: 'live:0',
        stable: false,
        kind: 'paragraph'
      })
    ).toEqual({
      type: 'text',
      content: 'Hello'
    })
  })
})
