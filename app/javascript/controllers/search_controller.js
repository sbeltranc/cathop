import { Controller } from "@hotwired/stimulus"

const URL_PATTERNS = {
  youtube: [
    /^(?:https?:\/\/)?(?:www\.)?(youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/i
  ],
  roblox: [
    /^(?:https?:\/\/)?(?:www\.)?roblox\.com\/users\/[\w-]+\/profile/i
  ],
  spotify: [
    /^(?:https?:\/\/)?(?:open\.)?spotify\.com\/(track|album|playlist)\/[\w-]+/i
  ],
  soundcloud: [
    /^(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/i
  ]
}

const INPUT_PATTERNS = {
  domain: /^(?!:\/\/)([a-zA-Z0-9-]+\.){1,}[a-zA-Z]{2,}$/,
  url: /^(?:https?:\/\/)?([\w-]*[a-zA-Z][\w-]*\.)+[\w-]+(?:\/[\w-./?%&=]*)?$/i,
  base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
  ip: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
}

export default class SearchController extends Controller {
  static targets = ["input", "message", "url", "base64", "ip", "domain"]
  static values = { messages: Object }

  #currentService = null
  #searchButton = null
  #boundValidateInput = null
  #boundHandleSearch = null

  connect() {
    this.#searchButton = document.getElementById('searchButton')
    this.#bindEventListeners()
  }

  disconnect() {
    this.#unbindEventListeners()
  }

  async #handleSearch(event) {
    event.preventDefault()
    
    const input = this.inputTarget.value.trim()
    if (!input) return

    try {
      this.#showLoading()
      const response = await this.#processInput(input)
      if (response) {
        this.#updateResponse(response)
      }
    } catch (error) {
      console.error('Search error:', error)
      this.#showError(error.message || 'An error occurred while processing the request')
    } finally {
      this.#hideLoading()
    }
  }

  async #processInput(input) {
    if (!this.#currentService) {
      if (this.#looksLikeUrl(input)) {
        return await this.#handleUrlInput(input)
      }
      this.#showError(this.messagesValue.unknown)
      return null
    }

    const controller = this.#getServiceController()
    return controller ? await controller.handle(input) : null
  }

  #validateInput(event) {
    const value = event.target.value.trim()
    this.#resetState()
    
    if (!value) return

    const inputType = this.#determineInputType(value)
    if (inputType) {
      this.#updateUIForInputType(inputType, value)
    } else {
      this.#showUnknownState()
    }
  }

  #determineInputType(value) {
    for (const [type, pattern] of Object.entries(INPUT_PATTERNS)) {
      if (pattern.test(value)) return type
    }

    if (INPUT_PATTERNS.url.test(value)) {
      for (const [service, patterns] of Object.entries(URL_PATTERNS)) {
        if (patterns.some(pattern => pattern.test(value))) {
          return service
        }
      }
      return 'generic_url'
    }

    return null
  }

  #updateUIForInputType(type, value) {
    this.#currentService = type
    this.inputTarget.classList.add(`cat-${type}-url`)
    
    const message = this.messagesValue[type]
    if (message) {
      this.messageTarget.textContent = message
      this.messageTarget.classList.add('visible', `cat-${type}`)
    }
  }

  #getServiceController() {
    const serviceMap = {
      ip: ['ip', this.ipTarget],
      base64: ['base64', this.base64Target],
      domain: ['domain', this.domainTarget],
      youtube: ['url', this.urlTarget],
      roblox: ['url', this.urlTarget],
      spotify: ['url', this.urlTarget],
      soundcloud: ['url', this.urlTarget],
      generic_url: ['url', this.urlTarget]
    }

    const [name, target] = serviceMap[this.#currentService] || []
    return name ? this.application.getControllerForElementAndIdentifier(target, name) : null
  }

  async #handleUrlInput(input) {
    const urlController = this.application.getControllerForElementAndIdentifier(this.urlTarget, 'url')
    return await urlController.handle(input)
  }

  #looksLikeUrl(input) {
    return input.match(/^https?:\/\//i) || input.includes('.')
  }

  #bindEventListeners() {
    this.#boundValidateInput = this.#validateInput.bind(this)
    this.#boundHandleSearch = this.#handleSearch.bind(this)
    
    this.inputTarget.addEventListener('input', this.#boundValidateInput)
    this.#searchButton.addEventListener('click', this.#boundHandleSearch)
  }

  #unbindEventListeners() {
    this.inputTarget.removeEventListener('input', this.#boundValidateInput)
    this.#searchButton.removeEventListener('click', this.#boundHandleSearch)
  }

  #resetState() {
    if (this.#currentService) {
      this.inputTarget.classList.remove(`cat-${this.#currentService}-url`)
      this.messageTarget.classList.remove('visible', `cat-${this.#currentService}`)
    }
    
    this.inputTarget.classList.remove('cat-unknown-url', 'cat-generic-url')
    this.messageTarget.classList.remove('visible', 'cat-unknown', 'cat-generic')
    this.messageTarget.textContent = ""
    this.#currentService = null
  }

  #showUnknownState() {
    this.inputTarget.classList.add('cat-unknown-url')
    this.messageTarget.textContent = this.messagesValue.unknown
    this.messageTarget.classList.add('visible', 'cat-unknown')
  }

  #showError(message) {
    this.messageTarget.textContent = message
    this.messageTarget.classList.remove('loading')
    this.messageTarget.classList.add('visible', 'error')
  }

  #showLoading() {
    this.messageTarget.textContent = "Loading..."
    this.messageTarget.classList.add('visible', 'loading')
  }

  #hideLoading() {
    this.messageTarget.classList.remove('visible', 'loading')
    this.messageTarget.textContent = ""
  }

  #updateResponse(container) {
    const existingContainer = document.querySelector('.cat-response')
    if (existingContainer) {
      existingContainer.replaceWith(container)
    } else {
      document.querySelector('.cat-content-wrapper').appendChild(container)
    }
  }
} 