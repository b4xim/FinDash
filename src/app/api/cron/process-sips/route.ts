// ============================================================
// GET /api/cron/process-sips
//
// Triggered daily (e.g., 9:30 AM IST) by Vercel Cron.
// For each active SIP whose sip_date matches today's date:
//   1. Fetches current NAV/price
//   2. Calculates units bought = sip_amount / price
//   3. Updates linked holding (if any): units + avg buy price
//   4. Increments SIP: total_installments_done + total_invested
//   5. Sends a push notification summarising what was processed
//
// Auth: Bearer CRON_SECRET (same as all other cron routes)
//
// Add to vercel.json:
//   { "path": "/api/cron/process-sips", "schedule": "0 4 * * *" }
//   (0 4 UTC = 9:30 AM IST)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";

interface MFApiLatestResponse {
  data: { date: string; nav: string }[];
}

interface YahooChartResponse {
  chart?: {
    result?: { meta?: { regularMarketPrice?: number | null } }[];
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
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

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

export async function GET(req: NextRequest) {
  // ── Auth guard ─────────────────────────────────────────────
  const cronSecret     = process.env.CRON_SECRET;
  const authHeader     = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // ── Find today's SIPs ──────────────────────────────────────
  // sip_date is the day of month (1–31). We check if today matches.
  const todayIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const dayOfMonth = todayIST.getDate();

  const { data: dueSips, error: fetchErr } = await supabase
    .from("sips")
    .select("*")
    .eq("is_active", true)
    .eq("sip_date", dayOfMonth);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!dueSips || dueSips.length === 0) {
    return NextResponse.json({ processed: 0, message: "No SIPs due today" });
  }

  // ── Process each due SIP ───────────────────────────────────
  const results: {
    name: string;
    status: "processed" | "no_price" | "failed";
    unitsAdded?: number;
    price?: number;
    holdingUpdated?: boolean;
  }[] = [];

  for (const sip of dueSips) {
    const sipAmount = parseFloat(sip.sip_amount);
    let priceUsed: number | null = null;
    let unitsAdded: number | null = null;
    let holdingUpdated = false;

    try {
      // ── If linked to holding, fetch price + update ─────────
      if (sip.holding_id) {
        const { data: holding } = await supabase
          .from("holdings")
          .select("id, units, buy_price, mfapi_code, ticker, asset_type")
          .eq("id", sip.holding_id)
          .single();

        if (holding) {
          const mfCode = holding.mfapi_code || sip.mfapi_code;
          const ticker = holding.ticker || sip.ticker;
          const assetType = holding.asset_type || sip.asset_type;

          if (mfCode) {
            priceUsed = await fetchMFNav(mfCode);
          } else if (ticker && (assetType === "stock" || assetType === "etf")) {
            priceUsed = await fetchStockPrice(ticker);
          }

          if (priceUsed && priceUsed > 0) {
            unitsAdded = sipAmount / priceUsed;
            const currentUnits = parseFloat(holding.units) || 0;
            const currentAvgBuy = parseFloat(holding.buy_price) || 0;
            const newAvgBuy = calcNewAvgBuyPrice(currentUnits, currentAvgBuy, unitsAdded, priceUsed);

            const { error: holdingErr } = await supabase
              .from("holdings")
              .update({
                units: currentUnits + unitsAdded,
                buy_price: newAvgBuy,
                current_price: priceUsed,
                price_updated_at: new Date().toISOString(),
              })
              .eq("id", holding.id);

            holdingUpdated = !holdingErr;
          }
        }
      } else {
        // No holding linked — try fetching price for info only
        if (sip.mfapi_code) {
          priceUsed = await fetchMFNav(sip.mfapi_code);
        } else if (sip.ticker && (sip.asset_type === "stock" || sip.asset_type === "etf")) {
          priceUsed = await fetchStockPrice(sip.ticker);
        }
        if (priceUsed) unitsAdded = sipAmount / priceUsed;
      }

      // ── Increment SIP counters ─────────────────────────────
      const { error: sipErr } = await supabase
        .from("sips")
        .update({
          total_installments_done: sip.total_installments_done + 1,
          total_invested: parseFloat(sip.total_invested) + sipAmount,
        })
        .eq("id", sip.id);

      results.push({
        name: sip.name,
        status: sipErr ? "failed" : "processed",
        unitsAdded: unitsAdded ? parseFloat(unitsAdded.toFixed(4)) : undefined,
        price: priceUsed ?? undefined,
        holdingUpdated,
      });
    } catch (err) {
      results.push({ name: sip.name, status: "failed" });
    }
  }

  const processed = results.filter(r => r.status === "processed").length;
  const failed    = results.filter(r => r.status === "failed").length;

  if (processed > 0) {
    revalidateTag("sips");
    revalidateTag("holdings");
  }

  // ── Push notification ──────────────────────────────────────
  const nowIST = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });

  const sipLines = results
    .filter(r => r.status === "processed")
    .map(r => r.unitsAdded
      ? `${r.name}: ${r.unitsAdded} units @ ₹${r.price?.toFixed(2)}`
      : r.name
    )
    .join("\n");

  const failedPart = failed > 0 ? ` · ${failed} failed` : "";

  await sendPushNotification({
    title: `🔄 ${processed} SIP${processed !== 1 ? "s" : ""} Processed`,
    body: sipLines || `${processed} SIP installment${processed !== 1 ? "s" : ""} recorded${failedPart} · ${nowIST}`,
    url: "/investing",
  });

  return NextResponse.json({ processed, failed, results });
}
