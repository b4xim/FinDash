// ============================================================
// /api/holdings
// GET  — fetch all holdings
// POST — create a new holding, or MERGE into an existing one
//        if a holding with the same name + asset_type exists,
//        the new units are appended and the buy price is
//        recalculated as a weighted average.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Auto-create an Investment transaction when a holding is added ──
// amount = cash actually deployed (units × buy_price), not market value.
// Idempotent: uses a unique dedup key so re-runs never duplicate.
async function createInvestmentTransaction(
  supabase: SupabaseClient,
  {
    name,
    amount,
    account,
    dedupKey,
    date,
  }: {
    name: string;
    amount: number;
    account?: string | null;
    dedupKey: string;
    date: string;
  }
) {
  // Skip if the key already exists (guards against double-clicks etc.)
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("gmail_msg_id", dedupKey)
    .maybeSingle();

  if (existing) return; // already recorded

  await supabase.from("transactions").insert([{
    date,
    description: `Investment — ${name}`,
    amount:      parseFloat(amount.toFixed(2)),
    type:        "debit",
    category:    "Investment",
    account:     account || null,
    source:      "auto",
    gmail_msg_id: dedupKey,
  }]);

  revalidateTag("transactions");
}

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

// POST /api/holdings — create a new holding, or merge into existing
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

  const newUnits     = parseFloat(units);
  const newBuyPrice  = parseFloat(buy_price);
  const newCurPrice  = parseFloat(current_price) || newBuyPrice;

  if (isNaN(newUnits) || newUnits <= 0) {
    return NextResponse.json({ error: "Units must be a positive number" }, { status: 400 });
  }
  if (isNaN(newBuyPrice) || newBuyPrice < 0) {
    return NextResponse.json({ error: "Buy price must be a non-negative number" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // ── Check for an existing holding with the same name + asset_type ──
  const { data: existing, error: lookupError } = await supabase
    .from("holdings")
    .select("*")
    .ilike("name", name.trim())          // case-insensitive match
    .eq("asset_type", asset_type)
    .maybeSingle();

  if (lookupError) {
    console.error("POST /api/holdings lookup error:", lookupError);
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  // ── MERGE path: holding already exists ────────────────────────────
  if (existing) {
    const existingUnits    = existing.units as number;
    const existingBuyPrice = existing.buy_price as number;

    // Weighted average buy price:
    //   avgPrice = (existingUnits × existingBuyPrice + newUnits × newBuyPrice)
    //            / (existingUnits + newUnits)
    const mergedUnits    = existingUnits + newUnits;
    const mergedBuyPrice =
      (existingUnits * existingBuyPrice + newUnits * newBuyPrice) / mergedUnits;

    const { data: updated, error: updateError } = await supabase
      .from("holdings")
      .update({
        units:     mergedUnits,
        buy_price: parseFloat(mergedBuyPrice.toFixed(4)),
        // Keep current_price as-is (auto-sync will refresh it); only
        // update it if the caller explicitly supplied one different from buy price.
        ...(current_price && newCurPrice !== newBuyPrice
          ? { current_price: newCurPrice }
          : {}),
        // Allow updating metadata fields if provided
        ...(account ? { account } : {}),
        ...(notes   ? { notes }   : {}),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      console.error("POST /api/holdings merge error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    revalidateTag("holdings");

    // Auto-create an Investment transaction for the incremental amount added
    const investedAmount = newUnits * newBuyPrice;
    const dedupKey = `holding_${existing.id}_${Date.now()}`;
    await createInvestmentTransaction(supabase, {
      name:    existing.name as string,
      amount:  investedAmount,
      account: (account || existing.account) as string | null,
      dedupKey,
      date:    new Date().toISOString().split("T")[0],
    });

    return NextResponse.json(
      { ...updated, merged: true, addedUnits: newUnits, prevBuyPrice: existingBuyPrice },
      { status: 200 }
    );
  }

  // ── INSERT path: brand-new holding ────────────────────────────────
  const { data, error } = await supabase
    .from("holdings")
    .insert([{
      name:              name.trim(),
      ticker:            ticker || null,
      asset_type,
      units:             newUnits,
      buy_price:         newBuyPrice,
      current_price:     newCurPrice,
      account:           account || null,
      notes:             notes || null,
      mfapi_code:        mfapi_code || null,
      price_updated_at:  new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    console.error("POST /api/holdings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("holdings");

  // Auto-create an Investment transaction for the full amount
  const investedAmount = newUnits * newBuyPrice;
  const dedupKey = `holding_${data.id}_${Date.now()}`;
  await createInvestmentTransaction(supabase, {
    name:    data.name as string,
    amount:  investedAmount,
    account: account || null,
    dedupKey,
    date:    new Date().toISOString().split("T")[0],
  });

  return NextResponse.json(data, { status: 201 });
}
