const escapeHtml = (content: string) =>
  content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeAttribute = (content: string) => escapeHtml(content).replace(/`/g, '&#96;')

const isSafeUrl = (url: string) => /^(https?:|mailto:)/i.test(url)

export const renderMarkdown = (content: string) => {
  const escaped = escapeHtml(content)

  return escaped
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label: string, rawUrl: string) => {
      const url = rawUrl.replace(/&amp;/g, '&')

      if (!isSafeUrl(url)) {
        return label
      }

      return `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${label}</a>`
    })
    .replace(/\n/g, '<br>')
}
