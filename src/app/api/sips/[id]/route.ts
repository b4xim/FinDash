// ============================================================
// /api/sips/[id]
// PATCH  — update a SIP (edit, toggle active, record installment)
// DELETE — permanently delete a SIP mandate
//
// record_installment action:
//   1. Fetches current NAV/price for the linked holding (if any)
//   2. Calculates units bought = sip_amount / price
//   3. Updates holding.units + recalculates avg buy price
//   4. Increments SIP total_installments_done + total_invested
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

// ── Price fetchers (same logic as refresh-prices route) ──────

interface MFApiLatestResponse {
  data: { date: string; nav: string }[];
}

interface YahooChartResponse {
  chart?: {
    result?: { meta?: { regularMarketPrice?: number | null } }[];
    error?: { description?: string } | null;
  };
}

async function fetchMFNav(mfapiCode: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${mfapiCode}`);
    if (!res.ok) return null;
    const json: MFApiLatestResponse = await res.json();
    const nav = json.data?.[0]?.nav;
    return nav ? parseFloat(nav) : null;
  } catch {
    return null;
  }
}

async function fetchStockPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?region=IN&lang=en-IN&includePrePost=false&interval=2m&range=1d`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as YahooChartResponse;
    const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price ?? null;
  } catch {
    return null;
  }
}

// Weighted average buy price recalculation
function calcNewAvgBuyPrice(
  existingUnits: number,
  existingAvgBuy: number,
  newUnits: number,
  newBuyPrice: number
): number {
  const totalUnits = existingUnits + newUnits;
  if (totalUnits === 0) return newBuyPrice;
  return (existingUnits * existingAvgBuy + newUnits * newBuyPrice) / totalUnits;
}

// PATCH /api/sips/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const supabase = getSupabaseAdmin();

  // ── Special action: "record_installment" ──────────────────
  if (body.action === "record_installment") {

    // Fetch the SIP row
    const { data: sip, error: sipErr } = await supabase
      .from("sips")
      .select("name, sip_amount, total_installments_done, total_invested, holding_id, mfapi_code, ticker, asset_type, account")
      .eq("id", params.id)
      .single();

    if (sipErr || !sip) {
      return NextResponse.json({ error: "SIP not found" }, { status: 404 });
    }

    const sipAmount = parseFloat(sip.sip_amount);
    let unitsAdded: number | null = null;
    let priceUsed: number | null = null;
    let holdingUpdated = false;

    // ── If linked to a holding, fetch price + update holding ──
    if (sip.holding_id) {
      // Fetch holding details
      const { data: holding } = await supabase
        .from("holdings")
        .select("id, units, buy_price, mfapi_code, ticker, asset_type")
        .eq("id", sip.holding_id)
        .single();

      if (holding) {
        // Determine which price source to use
        const mfCode = holding.mfapi_code || sip.mfapi_code;
        const ticker = holding.ticker || sip.ticker;
        const assetType = holding.asset_type || sip.asset_type;

        let fetchedPrice: number | null = null;

        if (mfCode) {
          fetchedPrice = await fetchMFNav(mfCode);
        } else if (ticker && (assetType === "stock" || assetType === "etf")) {
          fetchedPrice = await fetchStockPrice(ticker);
        }

        if (fetchedPrice && fetchedPrice > 0) {
          priceUsed = fetchedPrice;
          unitsAdded = sipAmount / fetchedPrice;

          const currentUnits = parseFloat(holding.units) || 0;
          const currentAvgBuy = parseFloat(holding.buy_price) || 0;
          const newAvgBuy = calcNewAvgBuyPrice(currentUnits, currentAvgBuy, unitsAdded, fetchedPrice);

          // Update the holding
          const { error: holdingErr } = await supabase
            .from("holdings")
            .update({
              units: currentUnits + unitsAdded,
              buy_price: newAvgBuy,
              current_price: fetchedPrice,
              price_updated_at: new Date().toISOString(),
            })
            .eq("id", holding.id);

          if (!holdingErr) {
            holdingUpdated = true;
            revalidateTag("holdings");
          }
        }
      }
    }

    // ── Update SIP counters ──────────────────────────────────
    const { data: updatedSip, error: sipUpdateErr } = await supabase
      .from("sips")
      .update({
        total_installments_done: sip.total_installments_done + 1,
        total_invested: parseFloat(sip.total_invested) + sipAmount,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (sipUpdateErr) {
      return NextResponse.json({ error: sipUpdateErr.message }, { status: 500 });
    }

    revalidateTag("sips");

    // Auto-create an Investment transaction for this installment
    // Dedup key uses installment number so it's safe to re-run.
    const installmentNum = sip.total_installments_done + 1;
    const dedupKey = `sip_${params.id}_installment_${installmentNum}`;
    const today = new Date().toISOString().split("T")[0];

    const { data: txnExisting } = await supabase
      .from("transactions")
      .select("id")
      .eq("gmail_msg_id", dedupKey)
      .maybeSingle();

    if (!txnExisting) {
      await supabase.from("transactions").insert([{
        date:         today,
        description:  `SIP — ${sip.name} (Installment #${installmentNum})`,
        amount:       parseFloat(sipAmount.toFixed(2)),
        type:         "debit",
        category:     "Investment",
        account:      sip.account || null,
        source:       "auto",
        gmail_msg_id: dedupKey,
      }]);
      revalidateTag("transactions");
    }

    return NextResponse.json({
      sip: updatedSip,
      holdingUpdated,
      unitsAdded: unitsAdded ? parseFloat(unitsAdded.toFixed(4)) : null,
      priceUsed,
    });
  }

  // ── General update ─────────────────────────────────────────
  const allowedFields = [
    "name", "asset_type", "sip_amount", "frequency", "sip_date",
    "start_date", "end_date", "total_installments_done", "total_invested",
    "holding_id", "account", "mfapi_code", "ticker", "is_active",
    "step_up_pct", "notes",
  ];

  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field] === "" ? null : body[field];
    }
  }

  if ("sip_amount" in updates) updates.sip_amount = parseFloat(updates.sip_amount);
  if ("sip_date" in updates) updates.sip_date = parseInt(updates.sip_date);
  if ("total_installments_done" in updates) updates.total_installments_done = parseInt(updates.total_installments_done);
  if ("total_invested" in updates) updates.total_invested = parseFloat(updates.total_invested);
  if ("step_up_pct" in updates) updates.step_up_pct = parseFloat(updates.step_up_pct) || 0;

  const { data, error } = await supabase
    .from("sips")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/sips error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("sips");
  return NextResponse.json(data);
}

// DELETE /api/sips/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("sips").delete().eq("id", params.id);

  if (error) {
    console.error("DELETE /api/sips error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("sips");
  return NextResponse.json({ ok: true });
}
