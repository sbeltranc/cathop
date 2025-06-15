import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["container"]
  static values = {
    mapZoom: { type: Number, default: 0.1 }
  }

  async handle(ip) {
    if (!ip?.trim()) return this.renderError('IP address is required')
    
    try {
      const data = await this.fetchIpInfo(ip)
      return this.renderResponse(data)
    } catch (error) {
      return this.renderError(error.message)
    }
  }

  async fetchIpInfo(ip) {
    const response = await fetch(`/api/lookup/ip/${ip}`)
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error || 'Failed to fetch IP information')
    }
    
    return data
  }

  renderResponse(data) {
    const container = document.createElement('div')
    container.className = 'cat-response'
    
    container.innerHTML = `
      <div class="cat-response-metadata">
        <div class="cat-response-status">
          <span class="cat-label">IP Address:</span>
          <span class="cat-value">${this.escapeHtml(data.ip)}</span>
        </div>
      </div>
      <div class="cat-ip-info">
        ${Object.entries(data)
          .filter(([key]) => !['error', 'reason'].includes(key))
          .map(([key, value]) => `
            <div class="cat-info-row">
              <span class="cat-info-key">${this.escapeHtml(key)}</span>
              <span class="cat-info-value">${this.escapeHtml(value)}</span>
            </div>
          `).join('')}
      </div>
    `

    const contentSection = document.createElement('div')
    contentSection.className = 'cat-response-content'
    contentSection.innerHTML = [
      this.renderMap(data)
    ].join('')
    
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

  renderMap(data) {
    if (!data.latitude || !data.longitude) return ''
    
    const bbox = {
      west: data.longitude - this.mapZoomValue,
      south: data.latitude - this.mapZoomValue,
      east: data.longitude + this.mapZoomValue,
      north: data.latitude + this.mapZoomValue
    }
    
    return `
      <div class="map-preview">
        <div class="text-preview">
          <div class="map-container">
            <iframe
              width="100%"
              height="300"
              frameborder="0"
              style="border:0"
              src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&layer=mapnik&marker=${data.latitude},${data.longitude}"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </div>
    `
  }

  escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return ''
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
} 