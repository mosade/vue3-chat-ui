import type { AiContentBlock, AiContentBlockKind } from '../types'

interface CreateAiContentBlocksOptions {
  streaming?: boolean
}

const normalizeContent = (content: string) => content.replace(/\r\n?/g, '\n')

const hashString = (value: string) => {
  let hash = 5381n

  for (const char of value) {
    hash = (hash * 33n) ^ BigInt(char.codePointAt(0) ?? 0)
  }

  return BigInt.asUintN(64, hash).toString(16)
}

const imagePattern = /^!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/

const getImageIdentity = (raw: string) => {
  const match = raw.trim().match(imagePattern)

  if (!match) {
    return null
  }

  return {
    alt: match[1],
    url: match[2]
  }
}

const hasIncompleteImageSyntax = (raw: string) => {
  const value = raw.trim()
  return value.startsWith('![') && !imagePattern.test(value)
}

const getBlockKind = (raw: string): AiContentBlockKind => {
  const trimmed = raw.trim()

  if (trimmed.startsWith('```')) {
    return 'code'
  }

  if (getImageIdentity(trimmed)) {
    return 'image'
  }

  return 'paragraph'
}

const getStableId = (index: number, raw: string, kind: AiContentBlockKind) => {
  if (kind === 'image') {
    const image = getImageIdentity(raw)

    if (image) {
      return `image:${image.url}:${image.alt}`
    }
  }

  return `block:${index}:${hashString(raw)}`
}

const splitParagraphBlocks = (content: string) =>
  content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

const hasUnclosedFence = (raw: string) => {
  const fenceCount = raw
    .split('\n')
    .filter((line) => line.trim().startsWith('```')).length

  return fenceCount % 2 === 1
}

const closeFenceForRender = (raw: string) => (hasUnclosedFence(raw) ? `${raw}\n\`\`\`` : raw)

export const createAiContentBlocks = (
  content: string,
  options: CreateAiContentBlocksOptions = {}
): AiContentBlock[] => {
  const normalized = normalizeContent(content).trim()

  if (!normalized) {
    return []
  }

  const rawBlocks = splitParagraphBlocks(normalized)
  const lastIndex = rawBlocks.length - 1

  return rawBlocks.map((raw, index) => {
    const kind = hasIncompleteImageSyntax(raw) ? 'paragraph' : getBlockKind(raw)
    const isLiveTail = Boolean(options.streaming) && index === lastIndex && kind !== 'image'
    const stable = !isLiveTail
    const id = stable ? getStableId(index, raw, kind) : `live:${index}`

    return {
      id,
      raw,
      renderContent: kind === 'code' && isLiveTail ? closeFenceForRender(raw) : raw,
      stable,
      kind
    }
  })
}
