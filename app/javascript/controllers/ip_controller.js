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
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.reason || 'Failed to fetch IP information')
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
      this.renderLocationDetails(data),
      this.renderNetworkInfo(data),
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

  formatLocation(data) {
    const parts = [data.city, data.country_name].filter(Boolean)
    return this.escapeHtml(parts.join(', ') || 'Location unknown')
  }

  renderLocationDetails(data) {
    const fields = {
      'City': data.city,
      'Region': data.region,
      'Country': data.country_name,
      'Postal Code': data.postal
    }

    const rows = Object.entries(fields)
      .map(([label, value]) => `
        <tr>
          <td class="label">${label}:</td>
          <td>${this.escapeHtml(value || 'N/A')}</td>
        </tr>
      `).join('')

    return `
      <div class="location-preview">
        <div class="section-title">Location Details</div>
        <div class="text-preview">
          <table>${rows}</table>
        </div>
      </div>
    `
  }

  renderNetworkInfo(data) {
    const fields = {
      'ASN': data.asn,
      'Organization': data.org,
      'Timezone': data.timezone
    }

    const rows = Object.entries(fields)
      .map(([label, value]) => `
        <tr>
          <td class="label">${label}:</td>
          <td>${this.escapeHtml(value || 'N/A')}</td>
        </tr>
      `).join('')

    return `
      <div class="network-preview">
        <div class="section-title">Network Information</div>
        <div class="text-preview">
          <table>${rows}</table>
        </div>
      </div>
    `
  }

  renderMap(data) {
    if (!data.latitude || !data.longitude) return ''
    
    const zoom = this.mapZoomValue
    const bbox = {
      west: data.longitude - zoom,
      south: data.latitude - zoom,
      east: data.longitude + zoom,
      north: data.latitude + zoom
    }
    
    return `
      <div class="map-preview">
        <div class="section-title">Map Location</div>
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