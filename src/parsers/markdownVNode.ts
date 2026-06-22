import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { h, type VNodeChild } from 'vue'
import type {
  AiContentInlineWidget,
  AiContentParser,
  AiContentParserContext,
  CreateMarkdownVNodeParserOptions
} from '../types'

type ChildStackEntry = {
  tag: string
  props: Record<string, unknown>
  children: VNodeChild[]
}

const defaultMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

const clonePattern = (pattern: RegExp) => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  return new RegExp(pattern.source, flags)
}

const pushChild = (children: VNodeChild[], child: VNodeChild | VNodeChild[]) => {
  if (Array.isArray(child)) {
    children.push(...child)
    return
  }

  children.push(child)
}

const getTokenProps = (token: Token) => {
  const props: Record<string, unknown> = {}

  token.attrs?.forEach(([name, value]) => {
    if (name === 'class') {
      props.class = value
      return
    }

    props[name] = value
  })

  if (token.type === 'link_open') {
    const href = token.attrGet('href') ?? ''

    props.href = href
    props.target = '_blank'
    props.rel = 'noreferrer'
  }

  return props
}

const getFallback = (
  widget: AiContentInlineWidget,
  match: RegExpExecArray,
  context: AiContentParserContext
) => widget.fallback?.(match, context) ?? match[0]

const renderWidgetMatch = (
  widget: AiContentInlineWidget,
  match: RegExpExecArray,
  context: AiContentParserContext
) => {
  const resolved = widget.resolve(match, context)

  if (!resolved) {
    return getFallback(widget, match, context)
  }

  const props = {
    ...(resolved.props ?? {}),
    key: resolved.key ?? `${widget.name}:${match.index}`
  }

  return widget.render(props, context)
}

const findNextWidgetMatch = (
  text: string,
  widgets: AiContentInlineWidget[]
):
  | {
      widget: AiContentInlineWidget
      match: RegExpExecArray
    }
  | null => {
  let next:
    | {
        widget: AiContentInlineWidget
        match: RegExpExecArray
      }
    | null = null

  widgets.forEach((widget) => {
    const pattern = clonePattern(widget.pattern)
    const match = pattern.exec(text)

    if (!match) {
      return
    }

    if (!next || match.index < next.match.index) {
      next = {
        widget,
        match
      }
    }
  })

  return next
}

const renderTextWithWidgets = (
  text: string,
  widgets: AiContentInlineWidget[],
  context: AiContentParserContext
): VNodeChild[] => {
  if (!widgets.length) {
    return [text]
  }

  const children: VNodeChild[] = []
  let remaining = text

  while (remaining) {
    const next = findNextWidgetMatch(remaining, widgets)

    if (!next) {
      children.push(remaining)
      break
    }

    if (next.match.index > 0) {
      children.push(remaining.slice(0, next.match.index))
    }

    children.push(renderWidgetMatch(next.widget, next.match, context))
    remaining = remaining.slice(next.match.index + next.match[0].length)
  }

  return children
}

const renderInlineTokens = (
  tokens: Token[],
  widgets: AiContentInlineWidget[],
  context: AiContentParserContext
) => {
  const root: VNodeChild[] = []
  const stack: ChildStackEntry[] = []
  const currentChildren = () => stack.at(-1)?.children ?? root

  const openNode = (token: Token, tag = token.tag) => {
    stack.push({
      tag,
      props: getTokenProps(token),
      children: []
    })
  }

  const closeNode = () => {
    const entry = stack.pop()

    if (!entry) {
      return
    }

    currentChildren().push(h(entry.tag, entry.props, entry.children))
  }

  tokens.forEach((token) => {
    if (token.type === 'text') {
      pushChild(currentChildren(), renderTextWithWidgets(token.content, widgets, context))
      return
    }

    if (token.type === 'code_inline') {
      currentChildren().push(h('code', token.content))
      return
    }

    if (token.type === 'softbreak' || token.type === 'hardbreak') {
      currentChildren().push('\n')
      return
    }

    if (token.type === 'image') {
      currentChildren().push(
        h('img', {
          src: token.attrGet('src') ?? '',
          alt: token.content,
          title: token.attrGet('title') ?? undefined
        })
      )
      return
    }

    if (token.nesting === 1 && token.tag) {
      openNode(token)
      return
    }

    if (token.nesting === -1 && token.tag) {
      closeNode()
      return
    }

    if (token.content) {
      pushChild(currentChildren(), renderTextWithWidgets(token.content, widgets, context))
    }
  })

  while (stack.length) {
    closeNode()
  }

  return root
}

const renderMarkdownTokens = (
  tokens: Token[],
  widgets: AiContentInlineWidget[],
  context: AiContentParserContext
) => {
  const root: VNodeChild[] = []
  const stack: ChildStackEntry[] = []
  const currentChildren = () => stack.at(-1)?.children ?? root

  const openNode = (token: Token) => {
    stack.push({
      tag: token.tag,
      props: getTokenProps(token),
      children: []
    })
  }

  const closeNode = () => {
    const entry = stack.pop()

    if (!entry) {
      return
    }

    currentChildren().push(h(entry.tag, entry.props, entry.children))
  }

  tokens.forEach((token) => {
    if (token.hidden) {
      return
    }

    if (token.type === 'inline') {
      pushChild(currentChildren(), renderInlineTokens(token.children ?? [], widgets, context))
      return
    }

    if (token.type === 'fence') {
      currentChildren().push(h('pre', [h('code', token.content)]))
      return
    }

    if (token.type === 'code_block') {
      currentChildren().push(h('pre', [h('code', token.content)]))
      return
    }

    if (token.type === 'hr') {
      currentChildren().push(h('hr'))
      return
    }

    if (token.nesting === 1 && token.tag) {
      openNode(token)
      return
    }

    if (token.nesting === -1 && token.tag) {
      closeNode()
      return
    }

    if (token.content) {
      pushChild(currentChildren(), renderTextWithWidgets(token.content, widgets, context))
    }
  })

  while (stack.length) {
    closeNode()
  }

  return root
}

export const createMarkdownVNodeParser = (
  options: CreateMarkdownVNodeParserOptions = {}
): AiContentParser => {
  const widgets = options.inlineWidgets ?? []

  return {
    parse: (content, context) => ({
      type: 'vnode',
      content: renderMarkdownTokens(defaultMarkdown.parse(content, {}), widgets, context)
    })
  }
}
