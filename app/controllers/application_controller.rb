require "httparty"

class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  def render_error(message, status = :internal_server_error)
    render json: { error: message }, status: status
    nil
  end
end
