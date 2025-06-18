require "test_helper"

class TestSoundcloud < ActiveSupport::TestCase
  test "should resolve short URL" do
    resolved_url = Soundcloud.new.resolve_short_url("https://on.soundcloud.com/84VP4S4xeiuv2Kqg27")
    assert_equal URI("https://soundcloud.com/menthol100s/carve-out-my-left-eye-idiot").path, URI(resolved_url).path
  end

  test "should resolve track" do
    track = Soundcloud.new.resolve_track("https://soundcloud.com/menthol100s/carve-out-my-left-eye-idiot")
    assert_equal "gothangelz", track["genre"]
  end
end
