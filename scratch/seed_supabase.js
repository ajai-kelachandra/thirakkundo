const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read configurations from the local environment file
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ahxfyqardwjainorqbbz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey || supabaseKey.trim() === "") {
  console.error("\n❌ Error: Please paste your public 'anon' api key inside NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local first!");
  console.error("👉 Follow Step 2 in the guidelines to retrieve it.\n");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  try {
    console.log("📂 Reading local outlets catalog (bevco_outlets_kerala.json)...");
    const rawData = fs.readFileSync(path.resolve(__dirname, '../public/bevco_outlets_kerala.json'), 'utf8');
    const outlets = JSON.parse(rawData);

    console.log(`📡 Loaded ${outlets.length} outlets from JSON. Formatting for database...`);

    const rows = outlets.map(o => {
      const pin = o.Address.match(/\b\d{6}\b/)?.[0] || '682016';
      const cleanName = `BEVCO Outlet, ${o.ShopName}`;
      const id = `bevco-${o.ShopCode.toLowerCase()}`;
      
      const lat = Number(o.Latitude);
      const lng = Number(o.Longitude);
      
      return {
        id,
        name: cleanName,
        category: 'bevco',
        address: o.Address,
        district: o.District,
        pincode: pin,
        latitude: isNaN(lat) || lat === 0 ? null : lat,
        longitude: isNaN(lng) || lng === 0 ? null : lng
      };
    });

    console.log("⚡ Uploading to Supabase (upserting in chunks of 50)...");

    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('outlets')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        throw new Error(`Failed on chunk ${i / chunkSize + 1}: ${error.message}`);
      }
      
      console.log(`✅ Uploaded outlets ${i + 1} to ${Math.min(i + chunkSize, rows.length)}`);
    }

    console.log("\n🎉 Database Seeding successfully completed! All 300+ BEVCO outlets are active on your Supabase instance.\n");
  } catch (err) {
    console.error("\n❌ Seeding failed:", err.message);
    console.error("👉 Make sure your 'outlets' table is created by running Step 1 SQL script in Supabase first.\n");
  }
}

seed();
