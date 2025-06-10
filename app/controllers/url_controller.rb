class UrlController < ApplicationController
  # GET /proxy?url=https://example.com
  def proxy
    url = params[:url]

    unless url.present?
      render json: {
        error: "No URL provided. Please add a 'url' query to your request."
      }, status: :bad_request
      return nil
    end

    is_url = URI.parse(url).kind_of?(URI::HTTP)

    if is_url
      begin
        response = HTTParty.get(url, headers: {
          "User-Agent" => "cathop-bot/url",
          "Call-Requested-By" => request.remote_ip,
          "Accept" => "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
        })

        content_type = response.headers["Content-Type"]
        if content_type && (content_type.include?("image") || content_type.include?("video") || content_type.include?("audio"))
          render json: {
            url: url,
            status: response.code,
            body: Base64.strict_encode64(response.body),
            headers: response.headers
          }, status: :ok
          return nil
        end

        render json: {
          url: url,
          status: response.code,
          body: response.body.force_encoding("UTF-8").encode("UTF-8", invalid: :replace, undef: :replace),
          headers: response.headers
        }
      rescue => e
        puts e.message
        puts e.backtrace.join("\n")
        render json: {
          error: "Something went wrong while requesting the URL, please verify if the URL was correct",
          requested: {
            url: url
          }
        }, status: :internal_server_error
      end
    else
      render json: {
        error: "The provided URL is invalid, please check if it's a valid url",
        requested: {
          url: url
        }
      }, status: :bad_request
    end
  end
end
