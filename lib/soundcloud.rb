require "stringio"
require "tempfile"
require "aws-sdk-s3"
require "mp3info"

class Soundcloud
  def initialize
    @client_version = find_client_version
    @client_id = find_client_id
  end

  def resolve_short_url(url)
    begin
      response = HTTParty.get(url, follow_redirects: false)
      if [ 301, 302, 303, 307, 308 ].include?(response.code) && response.headers["Location"]
        response.headers["Location"]
      else
        url
      end
    rescue StandardError => e
      Rails.logger.error("Error resolving SoundCloud short URL: #{e.message}")
      nil
    end
  end

  def resolve_track(url)
    begin
      resolve = HTTParty.get("https://api-v2.soundcloud.com/resolve?url=#{url}&client_id=#{@client_id}")

      if resolve.code == 200
        JSON.parse(resolve.body)
      else
        raise "Error resolving SoundCloud track: #{resolve.code} #{resolve.headers["Content-Type"]}"
      end
    rescue StandardError => e
      Rails.logger.error("Error resolving SoundCloud track: #{e.message}")
      nil
    end
  end


  def resolve_audio(url)
    begin
      data = resolve_track(url)

      if data.nil?
        Rails.logger.error("Error resolving SoundCloud track: #{url}")
        return "fetch.fail"
      end

      if data["policy"] == "BLOCK"
        return "country.block"
      end

      if data["policy"] == "SNIP"
        return "paid.content"
      end

      stream_link = data["media"]["transcodings"].find { |t| t["preset"] == "mp3_1_0" }

      if stream_link.nil?
        return "fetch.fail.no.mp3"
      end

      stream_file = HTTParty.get("#{stream_link["url"]}?client_id=#{@client_id}&track_authorization=#{data["track_authorization"]}")

      if stream_file.code == 200 && stream_file.parsed_response["url"]
        m3u8_url = stream_file.parsed_response["url"]
        m3u8_request = HTTParty.get(m3u8_url)
        m3u8_content = m3u8_request.body

        segment_urls = []
        m3u8_content.split("\n").each do |line|
          next if line.start_with?("#") || line.strip.empty?

          if line.start_with?("http")
            segment_urls << line.strip
          else
            base_url = m3u8_url.split("/")[0..-2].join("/")
            segment_urls << "#{base_url}/#{line.strip}"
          end
        end

        if segment_urls.empty?
          Rails.logger.error("No audio segments found in M3U8 playlist")
          return "fetch.fail.no.segments"
        end

        Rails.logger.info("Found #{segment_urls.length} audio segments")

        audio_data = []
        segment_urls.each_with_index do |segment_url, index|
          begin
            Rails.logger.info("Downloading segment #{index + 1}/#{segment_urls.length}")

            response = HTTParty.get(segment_url, {
              headers: {
                "User-Agent" => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
              },
              timeout: 30
            })

            if response.success?
              audio_data << response.body.force_encoding("BINARY")
            else
              Rails.logger.warn("Failed to download segment #{index + 1}: HTTP #{response.code}")
            end
          rescue => segment_error
            Rails.logger.warn("Error downloading segment #{index + 1}: #{segment_error.message}")
          end
        end

        if audio_data.any?
          audio_io = StringIO.new
          audio_data.each { |segment| audio_io.write(segment) }
          audio_io.rewind

          Tempfile.create([ "audio", ".mp3" ]) do |tempfile|
            tempfile.binmode
            tempfile.write(audio_io.string)
            tempfile.flush

            Mp3Info.open(tempfile.path) do |mp3|
              mp3.tag.title = data["title"] if data["title"]
              mp3.tag.artist = data.dig("user", "username")
              mp3.tag.album = data.dig("publisher_metadata", "album_title")
              mp3.tag.genre_s = data["genre"]
              mp3.tag.comments = data["description"]
            end

            tempfile.rewind
            final_mp3 = tempfile.read

            s3 = Aws::S3::Resource.new(
              endpoint: ENV.fetch("R2_ENDPOINT"),
              access_key_id: ENV.fetch("R2_ACCESS_KEY_ID"),
              secret_access_key: ENV.fetch("R2_SECRET_ACCESS_KEY"),
              region: ENV.fetch("R2_REGION", "auto")
            )
            bucket = s3.bucket(ENV.fetch("R2_BUCKET"))
            key = "#{SecureRandom.hex(64)}.mp3"
            obj = bucket.object(key)
            obj.put(body: final_mp3, content_type: "audio/mpeg")
            return "https://cdn.cathop.lat/#{key}"
          end
        else
          Rails.logger.error("No audio segments were successfully downloaded")
          "fetch.fail.no.segments.downloaded"
        end
      else
        Rails.logger.error("Failed to get stream URL: HTTP #{stream_file.code}")
        "fetch.fail.no.mp3.stream"
      end
    rescue StandardError => e
      Rails.logger.error("Internal error in resolve_audio: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      puts e.message
      puts e.backtrace
      "internal.error"
    end
  end

  private

  def find_client_version
    begin
      soundcloud = HTTParty.get("https://soundcloud.com/")
      version = String(soundcloud.body.match(/<script>window\.__sc_version="[0-9]{10}"<\/script>/)[0].match(/[0-9]{10}/))

      if version.nil?
        raise "Could not find SoundCloud client version on the website"
      end

      version
    rescue StandardError => e
      Rails.logger.error("Error finding SoundCloud client version: #{e.message}")
      nil
    end
  end

  def find_client_id
    begin
      soundcloud = HTTParty.get("https://soundcloud.com/")
      scripts = soundcloud.body.scan(/<script.*?src="(.*?)">/i).select { |url| url[0].start_with?("https://a-v2.sndcdn.com/") }

      if scripts.empty?
        raise "Could not find SoundCloud client ID on the website as there was no script with a src attribute starting with https://a-v2.sndcdn.com/"
      end

      scripts.each do |script|
        script_url = script[0]
        script_body = HTTParty.get(script_url).body

        client_id = script_body.match(/\("client_id=[A-Za-z0-9]{32}"\)/)

        if client_id && client_id[0].is_a?(String)
          return client_id[0].match(/[A-Za-z0-9]{32}/)[0]
        end
      end
    rescue StandardError => e
      Rails.logger.error("Error finding SoundCloud client ID: #{e.message}")
      nil
    end
  end
end
