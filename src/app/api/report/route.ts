import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { outletId, name, pincode, crowdStatus, waitMinutes, latitude, longitude, district, notAvailableItems } = body;

    // Simple validation
    if (!outletId || !name || !pincode || !crowdStatus || waitMinutes === undefined) {
      return NextResponse.json({ error: 'Missing mandatory fields' }, { status: 400 });
    }

    // 1. Ensure the outlet exists in the outlets table
    const { error: outletError } = await supabase
      .from('outlets')
      .upsert({
        id: outletId,
        name: name.toUpperCase().includes('OUTLET') || name.toUpperCase().includes('BEVCO') ? name : `BEVCO Outlet, ${name}`,
        category: 'bevco',
        address: district ? `${district} District, Pincode: ${pincode}, Kerala` : `Pincode: ${pincode}, Kerala`,
        district: district,
        pincode: pincode,
        latitude: latitude || 10.8505,
        longitude: longitude || 76.2711
      }, { onConflict: 'id' });

    if (outletError) {
      console.error('Outlet upsert error on server:', outletError.message);
      return NextResponse.json({ error: outletError.message }, { status: 500 });
    }

    // 2. Insert the wait status report linked to this outlet
    const { error: reportError } = await supabase
      .from('reports')
      .insert({
        outlet_id: outletId,
        crowd_status: crowdStatus,
        wait_minutes: Number(waitMinutes),
        not_available_items: notAvailableItems || []
      });

    if (reportError) {
      console.error('Wait report insert error on server:', reportError.message);
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
