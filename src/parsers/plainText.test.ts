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
      plainTextParser.parse('<strong>Hello</strong>', { message })
    ).toEqual({
      type: 'text',
      content: '<strong>Hello</strong>'
    })
  })
})
