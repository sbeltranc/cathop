module Api
  class ApiController < ApplicationController
    # GET /api/lookup/url?url=https://example.com
    def request_url
      url = params[:url]

      unless url.present?
        render_error("No URL provided. Please add a 'url' query to your request.", :bad_request)
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
          render_error("Something went wrong while requesting the URL, are you sure the URL is not down?", :internal_server_error)
        end
      else
        render_error("The provided URL is invalid, please check if it's a valid url", :bad_request)
      end
    end

    # GET /api/lookup/domain/example.com
    def lookup_domain
      domain = params[:domain]

      return render_error("No domain provided. Please add a 'domain' query to your request.", :bad_request) unless domain.present?

      unless domain.match?(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/)
        return render_error("The provided domain is invalid, please check if it's a valid domain", :bad_request)
      end

      begin
        tld_rdap = fetch_tld_rdap(extract_tld(domain))
        return render_error("No RDAP information found for the domain", :not_found) if tld_rdap.nil?

        response = fetch_rdap_response(domain, tld_rdap)
        return render_error("No RDAP server responded successfully for this domain", :internal_server_error) unless response

        registrar_rdap = extract_registrar_rdap(response)
        registrar_info = fetch_registrar_info(registrar_rdap) if registrar_rdap

        domain_data = build_domain_response(response, registrar_info)

        render json: domain_data, status: :ok

      rescue => e
        render_error("Something went wrong while requesting the domain, please verify if the domain was correct", :internal_server_error)
      end
    end

    # GET /api/lookup/ip/127.0.0.1
    def lookup_ip
      ip = params[:ip]

      unless ip.present?
        render_error("No IP provided. Please add a 'ip' query to your request.", :bad_request)
        return nil
      end

      if IpAddress.find_by(ip_address: ip).present?
        data = IpAddress.find_by(ip_address: ip)

        render json: {
          ip: data.ip_address,
          asn: data.asn,
          range: data.range,
          provider: data.provider,
          organisation: data.organisation,
          city: data.city,
          region: data.region,
          country: data.country,
          continent: data.continent,
          latitude: data.latitude,
          longitude: data.longitude
        }

        return nil
      end

      begin
        response = HTTParty.get("https://proxycheck.io/v2/#{ip}?key=#{ENV['PROXYCHECK_API_KEY']}&asn=1")
        data = response.parsed_response

        if data["status"] != "ok"
          if data["message"] == "No valid IP Addresses supplied."
            return render_error("There was no valid IP Addresses supplied.", :not_found)
          end

          return render_error("Something went wrong while requesting the IP, please verify if the IP was correct", :internal_server_error)
        end

        final_data = IpAddress.create(
          ip_address: ip,
          asn: data[ip]["asn"],
          range: data[ip]["range"],
          provider: data[ip]["provider"],
          organisation: data[ip]["organisation"],
          city: data[ip]["city"],
          region: data[ip]["region"],
          country: data[ip]["country"],
          continent: data[ip]["continent"],
          latitude: data[ip]["latitude"],
          longitude: data[ip]["longitude"]
        )

        render json: {
          ip: final_data.ip_address,
          asn: final_data.asn,
          range: final_data.range,
          provider: final_data.provider,
          organisation: final_data.organisation,
          city: final_data.city,
          region: final_data.region,
          country: final_data.country,
          continent: final_data.continent,
          latitude: final_data.latitude,
          longitude: final_data.longitude
        }
      rescue => e
        Rails.logger.error "IP lookup error: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")
        render_error("Something went wrong while requesting the IP, please verify if the IP was correct", :internal_server_error)
      end
    end

    private

    def render_error(message, status)
      render json: { error: message }, status: status
      nil
    end

    def extract_tld(domain)
      return nil if domain.nil? || domain.strip.empty?

      cleaned = domain.strip.downcase
      cleaned = cleaned.gsub(/^https?:\/\//, "")
      cleaned = cleaned.gsub(/^www\./, "")
      cleaned = cleaned.split("/").first
      cleaned = cleaned.split("?").first
      cleaned = cleaned.split("#").first

      parts = cleaned.split(".")

      return nil if parts.length < 2

      parts.last
    end

    def fetch_tld_rdap(tld)
      return nil unless tld.present?

      bootstrap_url = "https://data.iana.org/rdap/dns.json"

      begin
        response = HTTParty.get(bootstrap_url)

        unless response.code == 200
          return nil
        end

        bootstrap_data = response.parsed_response
        return nil unless bootstrap_data.is_a?(Hash) && bootstrap_data["services"]

        # Find RDAP servers for the given TLD
        rdap_servers = find_rdap_servers_for_tld(bootstrap_data["services"], tld)

        if rdap_servers.empty?
          return nil
        end

        rdap_servers

      rescue => e
        nil
      end
    end

    def find_rdap_servers_for_tld(services, tld)
      return [] unless services.is_a?(Array)

      tld_normalized = tld.downcase.strip

      services.each do |service|
        next unless service.is_a?(Array) && service.length >= 2

        tlds = service[0]
        servers = service[1]

        next unless tlds.is_a?(Array) && servers.is_a?(Array)

        if tlds.any? { |service_tld| service_tld.downcase == tld_normalized }
          return servers.select { |server| server.is_a?(String) && server.start_with?("http") }
        end
      end

      []
    end

    def fetch_rdap_response(domain, tld_rdap)
      tld_rdap.each do |rdap_base_url|
        rdap_domain = "#{rdap_base_url}domain/#{domain}"

        begin
          response = HTTParty.get(rdap_domain)
          if response.code == 200
            return response
          else
          end
        rescue => rdap_error
          next
        end
      end

      nil
    end

    def extract_registrar_rdap(response)
      domain_data = if response.parsed_response.is_a?(String)
        begin
          JSON.parse(response.parsed_response)
        rescue JSON::ParserError => e
          Rails.logger.error "Failed to parse JSON response in extract_registrar_rdap: #{e.message}"
          return nil
        end
      else
        response.parsed_response
      end

      return nil unless domain_data.is_a?(Hash) && domain_data["links"]

      links = domain_data["links"]
      return nil unless links.is_a?(Array)

      registrar_link = links.find do |link|
        next unless link.is_a?(Hash)
        link["title"] == "registrar" || link["rel"] == "related" && link["type"] == "application/rdap+json"
      end

      return nil unless registrar_link.is_a?(Hash)

      registrar_link["href"]
    end

    def fetch_registrar_info(registrar_rdap_url)
      return nil unless registrar_rdap_url

      begin
        response = HTTParty.get(registrar_rdap_url)
        if response.code == 200
          if response.parsed_response.is_a?(String)
            JSON.parse(response.parsed_response)
          else
            response.parsed_response
          end
        else
          nil
        end
      rescue => e
        nil
      end
    end

    def build_domain_response(domain_response, registrar_info)
      domain_data = if domain_response.parsed_response.is_a?(String)
        begin
          JSON.parse(domain_response.parsed_response)
        rescue JSON::ParserError => e
          return { error: "Invalid JSON in domain response" }
        end
      else
        domain_response.parsed_response
      end

      return { error: "Invalid domain response format" } unless domain_data.is_a?(Hash)

      {
        domain: domain_data["ldhName"] || domain_data["unicodeName"],
        status: domain_data["status"],
        events: extract_domain_events(domain_data["events"]),
        nameservers: extract_nameservers(domain_data["nameservers"]),
        entities: extract_entities(domain_data["entities"]),
        registrar: registrar_info ? extract_registrar_details(registrar_info) : nil,
        raw_data: {
          domain: domain_data,
          registrar: registrar_info
        }
      }
    end

    def extract_domain_events(events)
      return [] unless events.is_a?(Array)

      events.map do |event|
        next unless event.is_a?(Hash)
        {
          action: event["eventAction"],
          date: event["eventDate"]
        }
      end.compact
    end

    def extract_nameservers(nameservers)
      return [] unless nameservers.is_a?(Array)

      nameservers.map do |ns|
        next unless ns.is_a?(Hash)
        ns["ldhName"] || ns["unicodeName"]
      end.compact
    end

    def extract_entities(entities)
      return [] unless entities.is_a?(Array)

      entities.map do |entity|
        next unless entity.is_a?(Hash)
        {
          handle: entity["handle"],
          roles: entity["roles"],
          vcardArray: entity["vcardArray"]
        }
      end.compact
    end

    def extract_registrar_details(registrar_info)
      return {} unless registrar_info.is_a?(Hash)

      {
        name: registrar_info["fn"] || registrar_info["handle"],
        handle: registrar_info["handle"],
        events: extract_domain_events(registrar_info["events"]),
        vcardArray: registrar_info["vcardArray"]
      }
    end
  end
end
