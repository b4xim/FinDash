// ============================================================
// /api/sips
// GET  — fetch all SIPs (cached, invalidated on mutation)
// POST — create a new SIP mandate
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
    holding_id, account, mfapi_code, ticker, is_active,
    step_up_pct, notes,
  } = body;

  if (!name || !asset_type || !sip_amount || !sip_date || !start_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
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
      holding_id: holding_id || null,
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
