import { Controller } from "@hotwired/stimulus"

const DNS_STATUS = {
  0: 'No Error',
  1: 'Format Error',
  2: 'Server Failure',
  3: 'Non-Existent Domain',
  4: 'Not Implemented',
  5: 'Query Refused'
}

const DNS_FLAGS = {
  TC: 'Truncated',
  RD: 'Recursion Desired',
  RA: 'Recursion Available',
  AD: 'Authenticated Data',
  CD: 'Checking Disabled'
}

const RECORD_TYPES = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA'
}

export default class DomainController extends Controller {
  static targets = ["container"]

  async handle(domain) {
    if (!domain?.trim()) {
      return this.#renderError('Domain is required')
    }

    try {
      const [a, aaaa] = await Promise.all([
        this.#fetchDnsRecords(domain, 'A'),
        this.#fetchDnsRecords(domain, 'AAAA')
      ])

      return this.#renderResponse(domain, { a, aaaa })
    } catch (error) {
      console.error('Domain lookup error:', error)
      return this.#renderError('Failed to fetch domain information')
    }
  }

  async #fetchDnsRecords(domain, type) {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`
    )
    return response.json()
  }

  #renderResponse(domain, { a, aaaa }) {
    const container = document.createElement('div')
    container.className = 'cat-response'

    container.innerHTML = `
      ${this.#renderHeader(domain)}
      <div class="cat-response-content">
        ${this.#renderDnsSection('IPv4 (A)', a)}
        ${this.#renderDnsSection('IPv6 (AAAA)', aaaa)}
      </div>
    `

    return container
  }

  #renderHeader(domain) {
    return `
      <div class="cat-response-metadata">
        <div class="cat-response-status">
          <span class="cat-label">Domain:</span>
          <span class="cat-value">${this.#escape(domain)}</span>
        </div>
      </div>
    `
  }

  #renderDnsSection(title, data) {
    return `
      <div class="cat-domain-info">
        <div class="section-title">${title}</div>
        <div class="text-preview">
          ${this.#renderDnsInfo(data)}
          ${this.#renderAnswerSection(data)}
          ${this.#renderAuthoritySection(data)}
        </div>
      </div>
    `
  }

  #renderDnsInfo(data) {
    const info = []

    if (data.Status !== undefined) {
      info.push(this.#renderInfoRow(
        'Status',
        DNS_STATUS[data.Status] || `Unknown (${data.Status})`
      ))
    }

    Object.entries(DNS_FLAGS)
      .filter(([flag]) => data[flag] !== undefined)
      .forEach(([flag, description]) => {
        info.push(this.#renderInfoRow(description, data[flag]))
      })

    return info.join('')
  }

  #renderAnswerSection(data) {
    if (!data.Answer?.length) {
      return '<div class="cat-info-row">No records found</div>'
    }

    return `
      <div class="section-subtitle">Records</div>
      <div class="text-preview">
        ${data.Answer.map(record => this.#renderRecord(record)).join('')}
      </div>
    `
  }

  #renderAuthoritySection(data) {
    if (!data.Authority?.length) return ''

    return `
      <div class="section-subtitle">Authority</div>
      <div class="text-preview">
        ${data.Authority.map(record => 
          record.type === 6 
            ? this.#renderSoaRecord(record)
            : this.#renderRecord(record)
        ).join('')}
      </div>
    `
  }

  #renderRecord(record) {
    const type = RECORD_TYPES[record.type] || record.type
    return this.#renderInfoRow(
      `${type} Record`,
      `${this.#escape(record.data)} (TTL: ${record.TTL})`
    )
  }

  #renderSoaRecord(record) {
    const [
      primaryNs,
      email,
      serial,
      refresh,
      retry,
      expire,
      minimum
    ] = record.data.split(' ')

    const details = [
      ['Primary NS', primaryNs],
      ['Email', email],
      ['Serial', serial],
      ['Refresh', `${refresh}s`],
      ['Retry', `${retry}s`],
      ['Expire', `${expire}s`],
      ['Minimum TTL', `${minimum}s`]
    ]
      .map(([label, value]) => `${label}: ${value}`)
      .join('<br>')

    return this.#renderInfoRow('SOA Record', details)
  }

  #renderInfoRow(key, value) {
    return `
      <div class="cat-info-row">
        <span class="cat-info-key">${key}</span>
        <span class="cat-info-value">${value}</span>
      </div>
    `
  }

  #renderError(message) {
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