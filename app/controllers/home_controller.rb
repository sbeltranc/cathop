class HomeController < ApplicationController
  def index
    @query = params[:q]
  end
end
