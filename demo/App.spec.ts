import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nextTick } from 'vue'
import App from './App.vue'

describe('demo App', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the Google-style default demo and switches to the DeepSeek chatbot demo', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Ask AiChat')
    expect(wrapper.find('.google-demo').exists()).toBe(true)
    expect(wrapper.find('.google-input').exists()).toBe(true)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

    expect(wrapper.text()).toContain('DeepSeek Assistant')
    expect(wrapper.find('.deepseek-demo .ai-chat').exists()).toBe(true)
  })

  it('renders the DeepSeek assistant product controls and prompt suggestions', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')

    expect(wrapper.find('.deepseek-demo').exists()).toBe(true)
    expect(wrapper.find('[data-deepseek-api-key]').exists()).toBe(true)
    expect(wrapper.find('[data-deepseek-model]').exists()).toBe(true)
    expect(wrapper.find('[data-deepseek-temperature]').exists()).toBe(true)
    expect(wrapper.find('[data-deepseek-stream]').exists()).toBe(true)
    expect(wrapper.findAll('[data-deepseek-suggestion]')).toHaveLength(3)
    expect(wrapper.text()).toContain('shadcn/ui style')
    expect(wrapper.text()).toContain('Writing assistant')
    expect(wrapper.text()).toContain('Code review')
    expect(wrapper.text()).toContain('Analyze a decision')
  })

  it('shows a local DeepSeek API key error without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
    await wrapper.find('textarea').setValue('Hello DeepSeek')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Enter a DeepSeek API key')
  })

  it('calls DeepSeek chat completions and renders streamed response text', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'))
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":" from DeepSeek"}}]}\n\n')
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
      headers: new Headers({ 'content-type': 'text/event-stream' })
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
    await wrapper.find('[data-deepseek-api-key]').setValue('sk-test')
    await wrapper.find('textarea').setValue('Say hello')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json'
        })
      })
    )
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(request.model).toBe('deepseek-v4-flash')
    expect(request.stream).toBe(true)
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Say hello' })
    expect(wrapper.text()).toContain('Hello from DeepSeek')
  })

  it('supports non-streaming DeepSeek responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Non-streamed answer' } }]
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
    await wrapper.find('[data-deepseek-api-key]').setValue('sk-test')
    await wrapper.find('[data-deepseek-stream]').setValue(false)
    await wrapper.find('textarea').setValue('No stream')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await new Promise((resolve) => setTimeout(resolve, 120))

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(request.stream).toBe(false)
    expect(wrapper.text()).toContain('Non-streamed answer')
  })

  it('renders provider errors from DeepSeek responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key'
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
    await wrapper.find('[data-deepseek-api-key]').setValue('sk-bad')
    await wrapper.find('textarea').setValue('Will fail')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(wrapper.text()).toContain('Invalid API key')
    expect(wrapper.text()).toContain('Retry')
  })

  it('renders a custom shadcn retry action for errored responses', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-demo-variant="shadcn"]').trigger('click')
    await wrapper.find('.shadcn-demo__actions .shadcn-demo__button').trigger('click')
    await wrapper.find('textarea').setValue('Make this fail')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await new Promise((resolve) => setTimeout(resolve, 280))

    expect(wrapper.find('[aria-label="Retry response"]').exists()).toBe(true)
  })

  it('does not show process traces before the user sends a message', () => {
    const wrapper = mount(App)

    expect(wrapper.text()).not.toContain('Loaded the local demo adapter')
    expect(wrapper.find('.demo-traces').exists()).toBe(false)
  })

  it('shows immediate process feedback after sending a message', async () => {
    const wrapper = mount(App)

    await wrapper.find('textarea').setValue('Need process feedback')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(wrapper.text()).toContain('Need process feedback')
    expect(wrapper.text()).toContain('Thinking summary')
    expect(wrapper.find('.demo-traces').exists()).toBe(true)
  })

  it('streams the markdown example document through markdown-it in the demo response', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)

    await wrapper.find('textarea').setValue('Render the markdown example')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    await vi.advanceTimersByTimeAsync(3800)
    await nextTick()

    expect(wrapper.find('.demo-message-text h1').text()).toContain('h1 Heading')
    expect(wrapper.find('img[src="https://picsum.photos/200/300"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(60000)
    await nextTick()

    expect(wrapper.find('img[src="https://picsum.photos/200/300"]').exists()).toBe(true)
    expect(wrapper.find('a[href="https://picsum.photos/200/300"]').text()).toContain('Open Picsum image')
  })

  it('showcases newly added chat features', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Clean white demo')
    expect(wrapper.text()).toContain('AiContent rendering')
    expect(wrapper.find('.demo-message-text.ai-content').exists()).toBe(true)
    expect(wrapper.find('.demo-sources').exists()).toBe(true)
    expect(wrapper.text()).toContain('Vue API Reference')
    expect(wrapper.text()).toContain('persistence')

    await wrapper.find('[data-demo-prefill]').trigger('click')

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain(
      'Summarize the new AiChat headless API'
    )
  })

  it('styles custom slot surfaces used by the demo', () => {
    const css = readFileSync(resolve(__dirname, 'style.css'), 'utf8')

    expect(css).toContain('.google-demo')
    expect(css).toContain('.google-hero')
    expect(css).toContain('.google-input')
    expect(css).toContain('.demo-message-text.ai-content')
    expect(css).toContain('.demo-message {')
    expect(css).toContain('.demo-message--user')
    expect(css).toContain('.demo-message__body')
    expect(css).toContain('position: sticky')
    expect(css).toContain('bottom: 0')
    expect(css).toContain('box-shadow:')
    expect(css).toContain('.deepseek-demo')
    expect(css).toContain('.deepseek-demo__hero')
    expect(css).toContain('.deepseek-demo__settings')
    expect(css).toContain('.deepseek-demo__suggestions')
    expect(css).toContain('.deepseek-message')
    expect(css).toContain('.deepseek-composer')
    expect(css).toContain('.deepseek-status')
    expect(css).toContain('.deepseek-button:focus-visible')
    expect(css).toContain('box-shadow')
    expect(css).not.toContain('@radix-ui')
    expect(css).not.toContain('shadcn-vue')
  })

  it('streams markdown with irregular token-sized chunks instead of fixed character slices', () => {
    const source = readFileSync(resolve(__dirname, 'App.vue'), 'utf8')

    expect(source).toContain('const markdownStreamDelaysMs = [45, 120, 70, 180, 35, 95, 260, 55]')
    expect(source).toContain('const markdownStreamChunkSizes = [4, 18, 7, 32, 11, 54, 6, 23, 41, 9]')
    expect(source).toContain('createMarkdownStreamChunks')
    expect(source).toContain('split(/\\n{2,}/)')
    expect(source).toContain('slice(offset, offset + size)')
    expect(source).not.toContain('response.match(/[\\s\\S]{1,520}/g)')
  })
})
