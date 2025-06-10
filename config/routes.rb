Rails.application.routes.draw do
  root "home#index"

  get "proxy" => "url#proxy", as: :url_proxy

  # rails health check
  get "up" => "rails/health#show", as: :rails_health_check
end
