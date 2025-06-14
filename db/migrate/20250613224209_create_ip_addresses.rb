class CreateIpAddresses < ActiveRecord::Migration[8.0]
  def change
    create_table :ip_addresses do |t|
      t.string :ip_address, null: false

      t.string :asn, null: false
      t.string :range, null: false

      t.string :provider, null: false
      t.string :organisation, null: false

      t.string :city, null: false
      t.string :region, null: false
      t.string :country, null: false
      t.string :continent, null: false

      t.integer :latitude, null: false
      t.integer :longitude, null: false

      t.timestamps
    end
  end
end
