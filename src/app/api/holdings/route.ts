// ============================================================
// /api/holdings
// GET  — fetch all holdings
// POST — create a new holding
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

const getCachedHoldings = unstable_cache(
  async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("holdings")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data;
  },
  ["holdings_list"],
  { tags: ["holdings"] }
);

// GET /api/holdings
export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let data;
  try {
    data = await getCachedHoldings();
  } catch (error: any) {
    console.error("GET /api/holdings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/holdings — create a new holding
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, ticker, asset_type, units, buy_price,
    current_price, account, notes, mfapi_code,
  } = body;

  // Basic validation
  if (!name || !asset_type || units === undefined || buy_price === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("holdings")
    .insert([{
      name,
      ticker: ticker || null,
      asset_type,
      units: parseFloat(units),
      buy_price: parseFloat(buy_price),
      current_price: parseFloat(current_price) || parseFloat(buy_price), // default to buy price if not given
      account: account || null,
      notes: notes || null,
      mfapi_code: mfapi_code || null,
      price_updated_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    console.error("POST /api/holdings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("holdings");

  return NextResponse.json(data, { status: 201 });
}
