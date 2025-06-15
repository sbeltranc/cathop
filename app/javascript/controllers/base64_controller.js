import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["container"]

  async handle(input) {
    if (!input?.trim()) return this.renderError('Input is required')

    try {
      return this.renderResponse(input)
    } catch (error) {
      return this.renderError(error.message)
    }
  }

  renderResponse(input) {
    const container = document.createElement('div')
    container.className = 'cat-response'

    const isBase64 = this.isBase64(input)
    container.innerHTML = `
      <div class="cat-response-metadata">
        <div class="cat-response-status">
          <span class="cat-label">Input Type:</span>
          <span class="cat-value ${isBase64 ? 'success' : ''}">${isBase64 ? 'Base64 Encoded' : 'Plain Text'}</span>
        </div>
        <div class="cat-response-length">
          <span class="cat-label">Length:</span>
          <span class="cat-value">${input.length} characters</span>
        </div>
      </div>
    `

    const contentSection = document.createElement('div')
    contentSection.className = 'cat-response-content'
    
    const [original, converted] = isBase64 
      ? [input, this.decode(input)]
      : [input, this.encode(input)]
    
    contentSection.innerHTML = this.renderPreview(original, converted)
    container.appendChild(contentSection)

    return container
  }

  renderError(message) {
    const container = document.createElement('div')
    container.className = 'cat-response error'
    container.innerHTML = `
      <div class="cat-response-metadata">
        <div class="cat-response-status error">
          <span class="cat-label">Error:</span>
          <span class="cat-value">${this.escapeHtml(message)}</span>
        </div>
      </div>
    `
    return container
  }

  isBase64(str) {
    try {
      return btoa(atob(str)) === str
    } catch {
      return false
    }
  }

  encode(str) {
    try {
      return btoa(str)
    } catch (error) {
      throw new Error('Failed to encode text to Base64')
    }
  }

  decode(str) {
    try {
      return atob(str)
    } catch (error) {
      throw new Error('Failed to decode Base64 text')
    }
  }

  renderPreview(original, converted) {
    return `
      <div class="cat-response-content">
        <div class="cat-preview-section">
          <div class="cat-section-title">Original Text</div>
          <div class="cat-text-preview">
            <pre><code>${this.escapeHtml(original)}</code></pre>
          </div>
        </div>
        <div class="cat-preview-section">
          <div class="cat-section-title">${this.isBase64(original) ? 'Decoded Text' : 'Encoded Text'}</div>
          <div class="cat-text-preview">
            <pre><code>${this.escapeHtml(converted)}</code></pre>
          </div>
        </div>
      </div>
    `
  }

  escapeHtml(unsafe) {
    if (!unsafe) return ''
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
} 