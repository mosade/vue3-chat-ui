import type { AiContentParser } from '../types'

export const plainTextParser: AiContentParser = {
  parse: (content) => ({
    type: 'text',
    content
  })
}
