require "test_helper"

class ApiControllerTest < ActionDispatch::IntegrationTest
  # DOMAIN LOOKUP TESTS
  test "should get domain lookup" do
    get "/api/lookup/domain/example.com"
    json_response = JSON.parse(@response.body)
    assert_equal "EXAMPLE.COM", json_response["domain"]
    assert_response :success
  end

  test "should fail with a invalid domain" do
    get "/api/lookup/domain/hahafunnyguy"
    assert_response :bad_request
    json_response = JSON.parse(@response.body)
    assert_equal "The provided domain is invalid, please check if it's a valid domain", json_response["error"]
  end

  test "should fail with a non-registered domain" do
    get "/api/lookup/domain/asdvaksdasdaspasd.com"
    assert_response :internal_server_error
    json_response = JSON.parse(@response.body)
    assert_equal "No RDAP server responded successfully for this domain", json_response["error"]
  end

  # URL LOOKUP TESTS
  test "should get url lookup" do
    get api_request_url_url(url: "https://example.com")
    assert_response :success
    json_response = JSON.parse(@response.body)
    assert_equal "https://example.com", json_response["url"]
  end

  test "should fail with a invalid url" do
    get api_request_url_url(url: "asdvaksdpasd://.com")
    assert_response :bad_request
    json_response = JSON.parse(@response.body)
    assert_equal "The provided URL is invalid, please check if it's a valid url", json_response["error"]
  end

  test "should not be able to request a url that's not working" do
    get api_request_url_url(url: "https://asdvak52b35235b23sdpasd.com")
    assert_response :internal_server_error
    json_response = JSON.parse(@response.body)
    assert_equal "Something went wrong while requesting the URL, are you sure the URL is not down?", json_response["error"]
  end

  # IP LOOKUP TESTS
  test "should get ip lookup" do
    get api_lookup_ip_url(ip: "8.8.8.8")

    json_response = JSON.parse(@response.body)

    assert_equal "8.8.8.8", json_response["ip"]
    assert_equal "AS15169", json_response["asn"]
    assert_equal "8.8.8.0/24", json_response["range"]
    assert_equal "Google LLC", json_response["provider"]
    assert_equal "Google LLC", json_response["organisation"]
  end

  test "should fail with local ip" do
    get api_lookup_ip_url(ip: "127.0.0.1")
    assert_response :not_found
    json_response = JSON.parse(@response.body)
    assert_equal "There was no valid IP Addresses supplied.", json_response["error"]
  end

  test "should fail with invalid ip" do
    get api_lookup_ip_url(ip: "127.0.0.1.1")
    assert_response :not_found
    json_response = JSON.parse(@response.body)
    assert_equal "There was no valid IP Addresses supplied.", json_response["error"]
  end
end
