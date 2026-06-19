// ============================================================
// POST /api/holdings/refresh-prices
//
// Refreshes current_price for ALL auto-syncable holdings in one go:
//   - Mutual Funds  (mfapi_code set)  → api.mfapi.in
//   - Stocks / ETFs (ticker set)      → Yahoo Finance via yahoo-finance2
// FD/PPF/Other are skipped — those stay manual, there's no price feed for them.
//
// Each holding is refreshed independently — one bad symbol or a
// dead fund code never breaks the rest of the batch. Every
// failure is captured per-holding in the `errors` list returned
// to the client instead of throwing.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import yahooFinance from "yahoo-finance2";

interface MFApiLatestResponse {
  data: { date: string; nav: string }[];
}

interface RefreshResult {
  name: string;
  status: "updated" | "skipped" | "failed";
  price?: number;
  reason?: string; // populated when status === "failed"
}

export async function POST() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Pull every holding that's a candidate for auto-refresh —
  // either a linked mutual fund (mfapi_code) or a stock/ETF with a ticker
  const { data: holdings, error: fetchError } = await supabase
    .from("holdings")
    .select("id, name, asset_type, mfapi_code, ticker")
    .or("mfapi_code.not.is.null,ticker.not.is.null");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, failed: 0, results: [] });
  }

  const results: RefreshResult[] = [];

  for (const holding of holdings) {
    // ── Mutual Fund branch — fetch latest NAV from MFapi.in ──
    if (holding.mfapi_code) {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/${holding.mfapi_code}`);
        if (!res.ok) {
          results.push({ name: holding.name, status: "failed", reason: `MFapi returned ${res.status}` });
          continue;
        }

        const json: MFApiLatestResponse = await res.json();
        const latestNav = json.data?.[0]?.nav;

        if (!latestNav) {
          results.push({ name: holding.name, status: "failed", reason: "No NAV data returned" });
          continue;
        }

        const { error: updateError } = await supabase
          .from("holdings")
          .update({
            current_price: parseFloat(latestNav),
            price_updated_at: new Date().toISOString(),
          })
          .eq("id", holding.id);

        if (updateError) {
          results.push({ name: holding.name, status: "failed", reason: updateError.message });
        } else {
          results.push({ name: holding.name, status: "updated", price: parseFloat(latestNav) });
        }
      } catch (err) {
        console.error(`MF refresh failed for ${holding.name}:`, err);
        results.push({ name: holding.name, status: "failed", reason: "Network or parsing error" });
      }
      continue;
    }

    // ── Stock / ETF branch — fetch latest quote from Yahoo Finance ──
    if (holding.ticker && (holding.asset_type === "stock" || holding.asset_type === "etf")) {
      try {
        const quote = await yahooFinance.quote(holding.ticker);
        const price = quote?.regularMarketPrice;

        if (price === undefined || price === null) {
          results.push({ name: holding.name, status: "failed", reason: `No price found for symbol "${holding.ticker}"` });
          continue;
        }

        const { error: updateError } = await supabase
          .from("holdings")
          .update({
            current_price: price,
            price_updated_at: new Date().toISOString(),
          })
          .eq("id", holding.id);

        if (updateError) {
          results.push({ name: holding.name, status: "failed", reason: updateError.message });
        } else {
          results.push({ name: holding.name, status: "updated", price });
        }
      } catch (err) {
        // Bad/unknown symbol, Yahoo rate limit, network issue, etc. —
        // caught here so it never breaks the rest of the batch
        console.error(`Yahoo Finance refresh failed for ${holding.name} (${holding.ticker}):`, err);
        results.push({
          name: holding.name,
          status: "failed",
          reason: err instanceof Error ? err.message : "Yahoo Finance lookup failed",
        });
      }
      continue;
    }

    // ── Anything else with a ticker but not stock/etf (shouldn't normally happen) — skip ──
    results.push({ name: holding.name, status: "skipped", reason: "Not an auto-refreshable asset type" });
  }

  const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const failed  = results.filter(r => r.status === "failed").length;

  return NextResponse.json({ updated, skipped, failed, results });
}
