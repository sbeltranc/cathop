import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "message"]
  static values = {
    messages: Object
  }

  urlPatterns = {
    youtube: [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i,
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+(&\S*)?$/i,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+(\?\S*)?$/i
    ],
    roblox: [
      /^(https?:\/\/)?(www\.)?roblox\.com\/users\/[\w-]+\/profile(\?\S*)?$/i,
    ],
    spotify: [
      /^(https?:\/\/)?(open\.)?spotify\.com\/track\/[\w-]+(&\S*)?$/i,
      /^(https?:\/\/)?(open\.)?spotify\.com\/album\/[\w-]+(&\S*)?$/i,
      /^(https?:\/\/)?(open\.)?spotify\.com\/playlist\/[\w-]+(&\S*)?$/i,
    ],
    soundcloud: [
      /^(https?:\/\/)?(www\.)?soundcloud\.com\/[\w-]+\/[\w-]+(&\S*)?$/i,
    ],
  }

  connect() {
    this.validateInput = this.validateInput.bind(this)
    this.inputTarget.addEventListener('input', this.validateInput)
    this.currentService = null
  }

  disconnect() {
    this.inputTarget.removeEventListener('input', this.validateInput)
  }

  validateInput(event) {
    const value = event.target.value.trim()
    this.clearStates()
    
    if (!value) {
      return
    }

    const domainPattern = /^(?!:\/\/)([a-zA-Z0-9-]+\.){1,}[a-zA-Z]{2,}$/
    const urlPattern = /^(https?:\/\/)?([\w-]*[a-zA-Z][\w-]*\.)+[\w-]+(\/[\w- ./?%&=]*)?$/i
    const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
    const ipAddressPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
    
    const isDomain = domainPattern.test(value)
    const isUrl = urlPattern.test(value)
    const isBase64 = base64Pattern.test(value)
    const isIpAddress = ipAddressPattern.test(value)

    switch (true) {
      case isDomain: {
        this.currentService = 'domain'
        this.inputTarget.classList.add('domain-url')
        this.messageTarget.textContent = this.messagesValue.domain
        this.messageTarget.classList.add('visible', 'domain')
        return
      }
      case isIpAddress: {
        this.currentService = 'ip'
        this.inputTarget.classList.add('ip-url')
        this.messageTarget.textContent = this.messagesValue.ip
        this.messageTarget.classList.add('visible', 'ip')
        return
      }
      case isBase64: {
        this.currentService = 'base64'
        this.inputTarget.classList.add('base64-url')
        this.messageTarget.textContent = this.messagesValue.base64
        this.messageTarget.classList.add('visible', 'base64')
        return
      }
      case isUrl: {
        for (const [service, patterns] of Object.entries(this.urlPatterns)) {
          if (patterns.some(pattern => pattern.test(value))) {
            this.currentService = service
            this.inputTarget.classList.add(`${service}-url`)
            
            const message = this.messagesValue[service]
            if (message) {
              this.messageTarget.textContent = message
              this.messageTarget.classList.add('visible', service)
            }
            return
          }
        }
        this.currentService = 'generic_url'
        this.inputTarget.classList.add('generic-url')
        this.messageTarget.textContent = this.messagesValue.generic_url
        this.messageTarget.classList.add('visible', 'generic')
        return
      }

      default:
        this.showUnknownState()
    }
  }

  clearStates() {
    if (this.currentService) {
      this.inputTarget.classList.remove(`${this.currentService}-url`)
      this.messageTarget.classList.remove('visible', this.currentService)
    }
    
    this.inputTarget.classList.remove('unknown-url', 'generic-url')
    this.messageTarget.classList.remove('visible', 'unknown', 'generic')
    this.messageTarget.textContent = ""
    this.currentService = null
  }

  showUnknownState() {
    this.inputTarget.classList.add('unknown-url')
    this.messageTarget.textContent = this.messagesValue.unknown
    this.messageTarget.classList.add('visible', 'unknown')
  }
} 