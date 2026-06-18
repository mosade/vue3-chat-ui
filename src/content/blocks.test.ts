import { describe, expect, it } from 'vitest'
import { createAiContentBlocks } from './blocks'

describe('createAiContentBlocks', () => {
  it('splits completed paragraphs into stable blocks and keeps the streaming tail live', () => {
    expect(createAiContentBlocks('First paragraph\n\nSecond', { streaming: true })).toEqual([
      {
        id: 'block:0:c002a23f41b9e331',
        raw: 'First paragraph',
        renderContent: 'First paragraph',
        stable: true,
        kind: 'paragraph'
      },
      {
        id: 'live:1',
        raw: 'Second',
        renderContent: 'Second',
        stable: false,
        kind: 'paragraph'
      }
    ])
  })

  it('marks all blocks stable when streaming is false', () => {
    expect(createAiContentBlocks('First\n\nSecond', { streaming: false }).map((block) => block.stable)).toEqual([
      true,
      true
    ])
  })

  it('temporarily closes an unfinished fenced code block while streaming', () => {
    expect(createAiContentBlocks('```ts\nconst value = 1', { streaming: true })).toEqual([
      {
        id: 'live:0',
        raw: '```ts\nconst value = 1',
        renderContent: '```ts\nconst value = 1\n```',
        stable: false,
        kind: 'code'
      }
    ])
  })

  it('creates a stable image block only after image syntax is complete', () => {
    expect(createAiContentBlocks('![Chart](https://example.com/chart.png)', { streaming: true })).toEqual([
      {
        id: 'image:https://example.com/chart.png:Chart',
        raw: '![Chart](https://example.com/chart.png)',
        renderContent: '![Chart](https://example.com/chart.png)',
        stable: true,
        kind: 'image'
      }
    ])
  })

  it('does not create an image block for incomplete image syntax', () => {
    expect(createAiContentBlocks('![Chart](https://example.com/chart', { streaming: true })).toEqual([
      {
        id: 'live:0',
        raw: '![Chart](https://example.com/chart',
        renderContent: '![Chart](https://example.com/chart',
        stable: false,
        kind: 'paragraph'
      }
    ])
  })
})
