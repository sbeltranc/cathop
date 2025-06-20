import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["container"]

  async handle(url) {
    if (!url?.trim()) {
      return this.#createErrorResponse('Please enter a SoundCloud URL')
    }

    try {
      // First get track information
      const trackInfo = await this.#fetchTrackInfo(url)
      if (!trackInfo.success) {
        return this.#createErrorResponse(trackInfo.error || 'Failed to fetch track information')
      }

      // Then attempt to download
      const downloadResult = await this.#fetchDownload(url)
      
      return this.#handleResponse(trackInfo.track, downloadResult, url)
    } catch (error) {
      console.error('SoundCloud processing error:', error)
      return this.#createErrorResponse(error.message)
    }
  }

  async #fetchTrackInfo(url) {
    try {
      const response = await fetch(`/api/soundcloud/track?url=${encodeURIComponent(url)}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch track info (${response.status})`)
      }
      
      return data
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid response format from server')
      }
      throw error
    }
  }

  async #fetchDownload(url) {
    try {
      const response = await fetch(`/api/soundcloud/download?url=${encodeURIComponent(url)}`)
      const data = await response.json()
      
      if (!response.ok) {
        return { error: data.error || `Download failed (${response.status})` }
      }
      
      return data
    } catch (error) {
      return { error: error.message || 'Download request failed' }
    }
  }

  #handleResponse(track, downloadResult, url) {
    const container = document.createElement('div')
    container.className = 'cat-response'

    this.#appendMetadata(container, { url, track })
    this.#appendTrackInfo(container, track)
    
    if (track.description) {
      this.#appendDescription(container, track.description)
    }

    if (downloadResult.success) {
      this.#appendDownloadInfo(container, downloadResult)
    } else {
      this.#appendDownloadError(container, downloadResult.error)
    }

    return container
  }

  #appendMetadata(container, { url, track }) {
    container.innerHTML = `
      <div class="cat-response-metadata">
        <div class="cat-response-url">
          <span class="cat-label">URL:</span>
          <span class="cat-value">${this.#escape(url)}</span>
        </div>
        <div class="cat-response-status">
          <span class="cat-label">Status:</span>
          <span class="cat-value success">Track Found</span>
        </div>
      </div>
    `
  }

  #appendTrackInfo(container, track) {
    const artwork = track.artwork_url ? 
      `<img src="${this.#escape(track.artwork_url)}" alt="Track artwork" class="cat-track-artwork" />` : 
      '<div class="cat-track-artwork-placeholder">No Artwork</div>'

    const stats = this.#formatStats(track)
    const metadata = this.#formatMetadata(track)

    const trackInfoSection = document.createElement('div')
    trackInfoSection.className = 'cat-soundcloud-track'
    trackInfoSection.innerHTML = `
      <div class="cat-section-title">Track Information</div>
      <div class="cat-track-container">
        <div class="cat-track-artwork-container">
          ${artwork}
        </div>
        <div class="cat-track-details">
          <div class="cat-track-title">${this.#escape(track.title)}</div>
          <div class="cat-track-artist">
            <span class="cat-label">Artist:</span>
            <span class="cat-value">${this.#escape(track.artist)}</span>
          </div>
          <div class="cat-track-duration">
            <span class="cat-label">Duration:</span>
            <span class="cat-value">${this.#escape(track.duration_formatted)}</span>
          </div>
          ${track.genre ? `
            <div class="cat-track-genre">
              <span class="cat-label">Genre:</span>
              <span class="cat-value">${this.#escape(track.genre)}</span>
            </div>
          ` : ''}
          ${stats}
          ${metadata}
        </div>
      </div>
    `
    container.appendChild(trackInfoSection)
  }

  #appendDescription(container, description) {
    const descriptionSection = document.createElement('div')
    descriptionSection.className = 'cat-soundcloud-description'
    descriptionSection.innerHTML = `
      <div class="cat-section-title">Description</div>
      <div class="cat-description-content">
        ${this.#escape(description).replace(/\\n/g, '<br>')}
      </div>
    `
    container.appendChild(descriptionSection)
  }

  #formatStats(track) {
    const stats = []
    
    if (track.playback_count) {
      stats.push(`<span class="cat-stat">${this.#formatNumber(track.playback_count)} plays</span>`)
    }
    if (track.likes_count) {
      stats.push(`<span class="cat-stat">${this.#formatNumber(track.likes_count)} likes</span>`)
    }
    if (track.comment_count) {
      stats.push(`<span class="cat-stat">${this.#formatNumber(track.comment_count)} comments</span>`)
    }
    if (track.reposts_count) {
      stats.push(`<span class="cat-stat">${this.#formatNumber(track.reposts_count)} reposts</span>`)
    }

    return stats.length > 0 ? `
      <div class="cat-track-stats">
        ${stats.join(' • ')}
      </div>
    ` : ''
  }

  #formatMetadata(track) {
    const metadata = []
    
    if (track.created_at) {
      metadata.push(`
        <div class="cat-track-created">
          <span class="cat-label">Created:</span>
          <span class="cat-value">${this.#escape(new Date(track.created_at).toLocaleDateString())}</span>
        </div>
      `)
    }
    if (track.release_date) {
      metadata.push(`
        <div class="cat-track-release">
          <span class="cat-label">Release:</span>
          <span class="cat-value">${this.#escape(new Date(track.release_date).toLocaleDateString())}</span>
        </div>
      `)
    }
    if (track.license) {
      metadata.push(`
        <div class="cat-track-license">
          <span class="cat-label">License:</span>
          <span class="cat-value">${this.#escape(track.license.replace(/-/g, ' '))}</span>
        </div>
      `)
    }
    if (track.label_name) {
      metadata.push(`
        <div class="cat-track-label">
          <span class="cat-label">Label:</span>
          <span class="cat-value">${this.#escape(track.label_name)}</span>
        </div>
      `)
    }

    return metadata.length > 0 ? `
      <div class="cat-track-metadata">
        ${metadata.join('')}
      </div>
    ` : ''
  }

  #appendDownloadInfo(container, downloadResult) {
    const downloadSection = document.createElement('div')
    downloadSection.className = 'cat-soundcloud-download'
    downloadSection.innerHTML = `
      <div class="cat-section-title">Download</div>
      <div class="cat-download-success">
        <div class="cat-download-status">
          <span class="cat-label">Status:</span>
          <span class="cat-value success">Available</span>
        </div>
        <div class="cat-download-url">
          <span class="cat-label">Download URL:</span>
          <a href="${this.#escape(downloadResult.download_url)}" target="_blank">
            ${this.#escape(downloadResult.download_url)}
          </a>
        </div>
        <div class="cat-download-actions">
          <a href="${this.#escape(downloadResult.download_url)}" 
             download 
             class="cat-button cat-button-primary">
            Download MP3
          </a>
          <a href="${this.#escape(downloadResult.download_url)}" 
             target="_blank" 
             class="cat-button cat-button-secondary">
            Open in New Tab
          </a>
        </div>
      </div>
    `
    container.appendChild(downloadSection)
  }

  #appendDownloadError(container, error) {
    const downloadErrorSection = document.createElement('div')
    downloadErrorSection.className = 'cat-soundcloud-download'
    downloadErrorSection.innerHTML = `
      <div class="cat-section-title">Download</div>
      <div class="cat-download-error">
        <div class="cat-download-status">
          <span class="cat-label">Status:</span>
          <span class="cat-value error">Not Available</span>
        </div>
        <div class="cat-download-error-message">
          <span class="cat-label">Reason:</span>
          <span class="cat-value">${this.#escape(error)}</span>
        </div>
      </div>
    `
    container.appendChild(downloadErrorSection)
  }

  #formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
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