const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use SUPABASE_SERVICE_ROLE_KEY if available to bypass RLS, otherwise fallback to Anon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  try {
    const jsonPath = path.join(__dirname, '../public/bevco_outlets_kerala.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const outlets = JSON.parse(rawData);

    console.log(`Loaded ${outlets.length} outlets from JSON.`);

    const records = outlets.map(outlet => {
      const code = outlet.ShopCode.toLowerCase();
      const pinMatch = outlet.Address.match(/\b\d{6}\b/);
      const pincode = pinMatch ? pinMatch[0] : '';
      const name = outlet.ShopName;
      const cleanId = `bevco-${code}`;

      return {
        id: cleanId,
        name: name.toUpperCase().includes('OUTLET') || name.toUpperCase().includes('BEVCO') ? name : `BEVCO Outlet, ${name}`,
        category: 'bevco',
        address: outlet.Address,
        district: outlet.District,
        pincode: pincode,
        latitude: parseFloat(outlet.Latitude) || 10.8505,
        longitude: parseFloat(outlet.Longitude) || 76.2711
      };
    });

    // Chunk size of 100 for batch upserting
    const chunkSize = 100;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      console.log(`Upserting batch ${i / chunkSize + 1} of ${Math.ceil(records.length / chunkSize)} (${chunk.length} items)...`);
      
      const { error } = await supabase
        .from('outlets')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.error(`Error in batch ${i / chunkSize + 1}:`, error.message);
        throw error;
      }
    }

    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
  }
}

seed();
