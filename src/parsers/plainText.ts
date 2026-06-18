import type { AiChatContentParser } from '../types'

export const plainTextParser: AiChatContentParser = {
  parse: (content) => ({
    type: 'text',
    content
  })
}
