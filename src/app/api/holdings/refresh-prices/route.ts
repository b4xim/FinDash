// ============================================================
// POST /api/holdings/refresh-prices
//
// Refreshes current_price for ALL auto-syncable holdings in one go:
//   - Mutual Funds  (mfapi_code set)  → api.mfapi.in
//   - Stocks / ETFs (ticker set)      → Yahoo Finance chart endpoint
// FD/PPF/Other are skipped — those stay manual, there's no price feed for them.
//
// NOTE on Yahoo Finance: we deliberately do NOT use yahoo-finance2's
// .quote() method here. That method depends on Yahoo's v7/finance/quote
// endpoint, which requires a "crumb" security token — and Yahoo has been
// blocking crumb issuance (401/429 errors) intermittently since late 2024,
// breaking .quote() even for valid, correctly-formatted symbols. Instead
// we call the v8/finance/chart endpoint directly, which still works
// without a crumb and returns the same regularMarketPrice we need.
//
// Each holding is refreshed independently — one bad symbol or a
// dead fund code never breaks the rest of the batch. Every
// failure is captured per-holding in `results` and returned to
// the client instead of throwing.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

interface MFApiLatestResponse {
  data: { date: string; nav: string }[];
}

interface YahooChartMeta {
  regularMarketPrice?: number | null;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { description?: string } | null;
  };
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

    // ── Stock / ETF branch — fetch latest price from Yahoo Finance chart endpoint ──
    if (holding.ticker && (holding.asset_type === "stock" || holding.asset_type === "etf")) {
      try {
        const chartRes = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(holding.ticker)}?region=US&lang=en-US&includePrePost=false&interval=2m&range=1d`
        );

        if (!chartRes.ok) {
          results.push({ name: holding.name, status: "failed", reason: `Yahoo chart endpoint returned ${chartRes.status}` });
          continue;
        }

        const chartJson = (await chartRes.json()) as YahooChartResponse;
        const price = chartJson.chart?.result?.[0]?.meta?.regularMarketPrice;

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
