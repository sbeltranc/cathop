import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["container"]

  async handle(url) {
    if (!url?.trim()) {
      return this.#createErrorResponse('Please enter a URL')
    }

    try {
      const response = await this.#fetchUrl(url)
      return this.#handleResponse(response, url)
    } catch (error) {
      console.error('URL processing error:', error)
      return this.#createErrorResponse(error.message)
    }
  }

  async #fetchUrl(url) {
    try {
      const response = await fetch(`/api/lookup/url/?url=${encodeURIComponent(url)}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch URL (${response.status})`)
      }
      
      return data
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid response format from server')
      }
      throw error
    }
  }

  #handleResponse(data, url) {
    const container = document.createElement('div')
    container.className = 'cat-response'

    this.#appendMetadata(container, { url, status: data.status })
    
    if (data.headers) {
      this.#appendHeaders(container, data.headers)
    }

    this.#appendContent(container, data)
    return container
  }

  #appendMetadata(container, { url, status }) {
    container.innerHTML = `
      <div class="cat-response-metadata">
        <div class="cat-response-url">
          <span class="cat-label">URL:</span>
          <span class="cat-value">${this.#escape(url)}</span>
        </div>
        <div class="cat-response-status">
          <span class="cat-label">Status:</span>
          <span class="cat-value ${status >= 400 ? 'error' : 'success'}">${status}</span>
        </div>
      </div>
    `
  }

  #appendHeaders(container, headers) {
    const headerRows = Object.entries(headers)
      .map(([key, value]) => `
        <div class="cat-header-row">
          <span class="cat-header-key">${this.#escape(key)}:</span>
          <span class="cat-header-value">${this.#escape(value)}</span>
        </div>
      `).join('')

    container.innerHTML += `
      <div class="cat-response-headers">
        <div class="cat-section-title">Headers</div>
        <div class="cat-headers-grid">
          ${headerRows}
        </div>
      </div>
    `
  }

  #appendContent(container, data) {
    const contentSection = document.createElement('div')
    contentSection.className = 'cat-response-content'

    const contentType = this.#getContentType(data.headers)
    contentSection.innerHTML = this.#renderContent(data.body, contentType)
    
    container.appendChild(contentSection)
  }

  #getContentType(headers) {
    if (!headers) return null
    
    const contentTypeHeader = headers['Content-Type'] || headers['content-type']
    if (!contentTypeHeader || typeof contentTypeHeader !== 'string') return null
    
    return contentTypeHeader.toLowerCase()
  }

  #renderContent(content, contentType) {
    if (!content || typeof content !== 'string') {
      return this.#renderEmptyContent()
    }

    if (!contentType || typeof contentType !== 'string') {
      return this.#renderTextContent(content)
    }

    const type = contentType.toLowerCase()
    if (type.includes('image')) return this.#renderImage(content, type)
    if (type.includes('video')) return this.#renderVideo(content, type)
    if (type.includes('audio')) return this.#renderAudio(content, type)
    if (type.includes('json')) return this.#renderJson(content)
    
    return this.#renderTextContent(content)
  }

  #renderEmptyContent() {
    return `
      <div class="cat-text-preview">
        <pre><code>No content available</code></pre>
      </div>
    `
  }

  #renderImage(content, contentType) {
    return `
      <div class="cat-media-preview">
        <img src="data:${contentType};base64,${content}" alt="Response preview" />
      </div>
    `
  }

  #renderVideo(content, contentType) {
    return `
      <div class="cat-media-preview">
        <video controls>
          <source src="data:${contentType};base64,${content}" type="${contentType}">
          Your browser does not support video playback
        </video>
      </div>
    `
  }

  #renderAudio(content, contentType) {
    return `
      <div class="cat-media-preview">
        <audio controls>
          <source src="data:${contentType};base64,${content}" type="${contentType}">
          Your browser does not support audio playback
        </audio>
      </div>
    `
  }

  #renderJson(content) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      const formatted = JSON.stringify(parsed, null, 2)
      return `
        <div class="cat-json-preview">
          <pre><code>${this.#escape(formatted)}</code></pre>
        </div>
      `
    } catch {
      return this.#renderTextContent(content)
    }
  }

  #renderTextContent(content) {
    return `
      <div class="cat-text-preview">
        <pre><code>${this.#escape(content)}</code></pre>
      </div>
    `
  }

  #createErrorResponse(message) {
    const container = document.createElement('div')
    container.className = 'cat-response error'
    container.innerHTML = `
      <div class="cat-response-metadata">
        <div class="cat-response-status error">
          <span class="cat-label">Error:</span>
          <span class="cat-value">${this.#escape(message)}</span>
        </div>
      </div>
    `
    return container
  }

  #escape(unsafe) {
    if (unsafe == null) return ''
    
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
} 