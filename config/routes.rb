Rails.application.routes.draw do
  root "home#index"

  # API routes
  namespace :api do
    # lookup namespace
    get "lookup/url" => "api#request_url", as: :request_url
    get "lookup/ip/:ip" => "api#lookup_ip", as: :lookup_ip, constraints: { ip: /[^\/]+/ }
    get "lookup/domain/:domain" => "api#lookup_domain", as: :lookup_domain, constraints: { domain: /[^\/]+/ }
  end

  # rails health check
  get "up" => "rails/health#show", as: :rails_health_check
end
