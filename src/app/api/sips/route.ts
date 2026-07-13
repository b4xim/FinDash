// ============================================================
// /api/sips
// GET  — fetch all SIPs (cached, invalidated on mutation)
// POST — create a new SIP mandate
//
// POST extras:
//   - If auto_match_holding=true, finds an existing holding with
//     matching mfapi_code or ticker and sets holding_id
//   - If auto_create_holding=true and no match found, creates a
//     new holding with 0 units (populated on first installment)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

const getCachedSips = unstable_cache(
  async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sips")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },
  ["sips_list"],
  { tags: ["sips"] }
);

// GET /api/sips
export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getCachedSips();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/sips error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/sips — create a new SIP mandate
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, asset_type, sip_amount, frequency, sip_date,
    start_date, end_date, total_installments_done, total_invested,
    holding_id: providedHoldingId, account, mfapi_code, ticker, is_active,
    step_up_pct, notes,
    // Auto-link flags
    auto_match_holding,
    auto_create_holding,
  } = body;

  if (!name || !asset_type || !sip_amount || !sip_date || !start_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let holding_id: string | null = providedHoldingId || null;

  // ── Auto-match existing holding ────────────────────────────
  if (!holding_id && auto_match_holding) {
    let matchQuery = supabase.from("holdings").select("id, name");

    if (mfapi_code) {
      const { data: match } = await matchQuery.eq("mfapi_code", mfapi_code).maybeSingle();
      if (match) holding_id = match.id;
    } else if (ticker) {
      const { data: match } = await matchQuery.eq("ticker", ticker).maybeSingle();
      if (match) holding_id = match.id;
    }
  }

  // ── Auto-create a new holding if no match ─────────────────
  if (!holding_id && auto_create_holding) {
    const holdingAssetType =
      asset_type === "mutual_fund" ? "mutual_fund" :
      asset_type === "etf" ? "etf" : "stock";

    const { data: newHolding, error: holdingErr } = await supabase
      .from("holdings")
      .insert([{
        name,
        asset_type: holdingAssetType,
        units: 0,
        buy_price: 0,
        current_price: 0,
        account: account || null,
        mfapi_code: mfapi_code || null,
        ticker: ticker || null,
        notes: `Auto-created for SIP on ${new Date().toLocaleDateString("en-IN")}`,
        price_updated_at: new Date().toISOString(),
      }])
      .select("id")
      .single();

    if (!holdingErr && newHolding) {
      holding_id = newHolding.id;
      revalidateTag("holdings");
    }
  }

  // ── Create the SIP row ─────────────────────────────────────
  const { data, error } = await supabase
    .from("sips")
    .insert([{
      name,
      asset_type,
      sip_amount: parseFloat(sip_amount),
      frequency: frequency || "monthly",
      sip_date: parseInt(sip_date),
      start_date,
      end_date: end_date || null,
      total_installments_done: parseInt(total_installments_done) || 0,
      total_invested: parseFloat(total_invested) || 0,
      holding_id,
      account: account || null,
      mfapi_code: mfapi_code || null,
      ticker: ticker || null,
      is_active: is_active !== false,
      step_up_pct: parseFloat(step_up_pct) || 0,
      notes: notes || null,
    }])
    .select()
    .single();

  if (error) {
    console.error("POST /api/sips error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("sips");
  return NextResponse.json(data, { status: 201 });
}
