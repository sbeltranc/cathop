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
    if (!domain?.trim()) return this.#renderError('Domain is required')

    try {
      const data = await this.#fetchDomainInfo(domain)
      return this.#renderResponse(domain, data)
    } catch (error) {
      console.error('Domain lookup error:', error)
      return this.#renderError('Failed to fetch domain information')
    }
  }

  async #fetchDomainInfo(domain) {
    const response = await fetch(`/api/lookup/domain/${domain}`)
    const data = await response.json()
    if (data.error) throw new Error(data.error)
    return data
  }

  #renderResponse(domain, data) {
    const container = document.createElement('div')
    container.className = 'cat-response'
    container.innerHTML = `
      ${this.#renderHeader(domain)}
      <div class="cat-response-content">
        ${this.#renderDomainInfo(data)}
        ${this.#renderRegistrantInfo(data)}
        ${this.#renderEvents(data)}
        ${this.#renderNameservers(data)}
        ${this.#renderEntities(data)}
        ${this.#renderSecureDNS(data)}
        ${this.#renderNotices(data)}
        ${this.#renderLinks(data)}
        ${this.#renderRawData(data)}
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

  #renderDomainInfo(data) {
    const fields = {
      'Domain': data.domain,
      'Status': data.status?.join(', ') || 'N/A',
      'Language': data.raw_data?.domain?.lang || 'N/A',
      'Object Class': data.raw_data?.domain?.objectClassName || 'N/A',
      'Handle': data.raw_data?.domain?.handle || 'N/A',
      'Port 43': data.raw_data?.domain?.port43 || 'N/A'
    }

    return `
      <div class="cat-domain-info">
        <div class="section-title">Domain Information</div>
        <div class="text-preview">
          ${Object.entries(fields).map(([key, value]) => this.#renderInfoRow(key, value)).join('')}
        </div>
      </div>
    `
  }

  #renderRegistrantInfo(data) {
    const registrant = data.raw_data?.registrar?.entities?.find(e => e.roles?.includes('registrant'))
    if (!registrant) return ''

    const vcard = registrant.vcardArray?.[1] || []
    const name = vcard.find(([key]) => key === 'fn')?.[3]
    const org = vcard.find(([key]) => key === 'org')?.[3]
    const email = vcard.find(([key]) => key === 'email')?.[3]
    const phone = vcard.find(([key]) => key === 'tel')?.[3]
    const address = vcard.find(([key]) => key === 'adr')?.[3] || []

    if (registrant.remarks?.some(r => r.title === 'REDACTED FOR PRIVACY')) {
      return `
        <div class="cat-domain-info">
          <div class="section-title">Registrant Information</div>
          <div class="text-preview">
            ${this.#renderInfoRow('Privacy', 'Information is protected by privacy service')}
            ${org ? this.#renderInfoRow('Organization', org) : ''}
            ${registrant.remarks?.map(r => this.#renderInfoRow(r.title, r.description?.join(' '))).join('')}
          </div>
        </div>
      `
    }

    return `
      <div class="cat-domain-info">
        <div class="section-title">Registrant Information</div>
        <div class="text-preview">
          ${name ? this.#renderInfoRow('Name', name) : ''}
          ${org ? this.#renderInfoRow('Organization', org) : ''}
          ${email ? this.#renderInfoRow('Email', email) : ''}
          ${phone ? this.#renderInfoRow('Phone', phone) : ''}
          ${address.length > 0 ? this.#renderInfoRow('Address', address.filter(Boolean).join(', ')) : ''}
          ${registrant.remarks?.map(r => this.#renderInfoRow(r.title, r.description?.join(' '))).join('')}
        </div>
      </div>
    `
  }

  #renderEvents(data) {
    if (!data.events?.length) return ''

    const events = data.events.map(event => ({
      action: event.action.replace(/_/g, ' ').toUpperCase(),
      date: new Date(event.date).toLocaleString()
    }))

    return `
      <div class="cat-domain-info">
        <div class="section-title">Domain Events</div>
        <div class="text-preview">
          ${events.map(event => this.#renderInfoRow(event.action, event.date)).join('')}
        </div>
      </div>
    `
  }

  #renderNameservers(data) {
    if (!data.nameservers?.length) return ''

    const nameservers = data.raw_data?.domain?.nameservers || []
    return `
      <div class="cat-domain-info">
        <div class="section-title">Name Servers</div>
        <div class="text-preview">
          ${nameservers.map(ns => `
            ${this.#renderInfoRow('Name Server', ns.ldhName)}
            ${ns.handle ? this.#renderInfoRow('Handle', ns.handle) : ''}
            ${ns.links ? ns.links.map(link => this.#renderInfoRow(link.title || link.rel, `<a href="${link.href}" target="_blank" style="color: white; text-decoration: underline;">${link.value}</a>`)).join('') : ''}
          `).join('')}
        </div>
      </div>
    `
  }

  #renderEntities(data) {
    if (!data.entities?.length) return ''

    const entities = data.raw_data?.domain?.entities?.map(entity => {
      const vcard = entity.vcardArray?.[1] || []
      const name = vcard.find(([key]) => key === 'fn')?.[3] || 'Unknown'
      const roles = entity.roles?.join(', ') || 'Unknown'
      const abuse = entity.entities?.find(e => e.roles?.includes('abuse'))
      const abuseInfo = abuse ? this.#extractAbuseInfo(abuse) : null
      const publicIds = entity.publicIds?.map(id => `${id.type}: ${id.identifier}`).join(', ')

      return { name, roles, abuseInfo, publicIds, remarks: entity.remarks }
    })

    return `
      <div class="cat-domain-info">
        <div class="section-title">Entities</div>
        <div class="text-preview">
          ${entities.map(entity => `
            ${this.#renderInfoRow(entity.roles, entity.name)}
            ${entity.publicIds ? this.#renderInfoRow('Public IDs', entity.publicIds) : ''}
            ${entity.abuseInfo ? this.#renderAbuseInfo(entity.abuseInfo) : ''}
            ${entity.remarks?.map(r => this.#renderInfoRow(r.title, r.description?.join(' '))).join('')}
          `).join('')}
        </div>
      </div>
    `
  }

  #extractAbuseInfo(abuse) {
    const vcard = abuse.vcardArray?.[1] || []
    const email = vcard.find(([key]) => key === 'email')?.[3]
    const phone = vcard.find(([key]) => key === 'tel')?.[3]
    return { email, phone }
  }

  #renderAbuseInfo(abuse) {
    return `
      <div class="cat-info-row abuse-info">
        <span class="cat-info-key">Abuse Contact:</span>
        <span class="cat-info-value">
          ${abuse.email ? `Email: ${this.#escape(abuse.email)}` : ''}
          ${abuse.phone ? `<br>Phone: ${this.#escape(abuse.phone)}` : ''}
        </span>
      </div>
    `
  }

  #renderSecureDNS(data) {
    if (!data.raw_data?.domain?.secureDNS) return ''

    const secureDNS = data.raw_data.domain.secureDNS
    const dsData = secureDNS.dsData?.[0]
    if (!dsData) return ''

    return `
      <div class="cat-domain-info">
        <div class="section-title">DNSSEC Information</div>
        <div class="text-preview">
          ${this.#renderInfoRow('Delegation Signed', secureDNS.delegationSigned ? 'Yes' : 'No')}
          ${this.#renderInfoRow('Zone Signed', secureDNS.zoneSigned ? 'Yes' : 'No')}
          ${this.#renderInfoRow('Max Sig Life', secureDNS.maxSigLife || 'N/A')}
          ${this.#renderInfoRow('Key Tag', dsData.keyTag)}
          ${this.#renderInfoRow('Algorithm', dsData.algorithm)}
          ${this.#renderInfoRow('Digest Type', dsData.digestType)}
          ${this.#renderInfoRow('Digest', dsData.digest)}
        </div>
      </div>
    `
  }

  #renderNotices(data) {
    if (!data.raw_data?.domain?.notices?.length) return ''

    return `
      <div class="cat-domain-info">
        <div class="section-title">Notices</div>
        <div class="text-preview">
          ${data.raw_data.domain.notices.map(notice => `
            ${this.#renderInfoRow(notice.title, notice.description?.join('\n'))}
            ${notice.links ? notice.links.map(link => this.#renderInfoRow(link.title || link.rel, `<a href="${link.href}" target="_blank" style="color: white; text-decoration: underline;">${link.value}</a>`)).join('') : ''}
          `).join('')}
        </div>
      </div>
    `
  }

  #renderLinks(data) {
    if (!data.raw_data?.domain?.links?.length) return ''

    return `
      <div class="cat-domain-info">
        <div class="section-title">Links</div>
        <div class="text-preview">
          ${data.raw_data.domain.links.map(link => `
            ${this.#renderInfoRow(link.title || link.rel, `<a href="${link.href}" target="_blank" style="color: white; text-decoration: underline;">${link.value}</a>`)}
          `).join('')}
        </div>
      </div>
    `
  }

  #renderRawData(data) {
    if (!data.raw_data) return ''

    return `
      <div class="cat-domain-info">
        <div class="section-title">Raw Data</div>
        <div class="text-preview">
          <pre>${this.#escape(JSON.stringify(data.raw_data, null, 2))}</pre>
        </div>
      </div>
    `
  }

  #renderInfoRow(key, value) {
    return `
      <div class="cat-info-row">
        <span class="cat-info-key">${this.#escape(key)}</span>
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