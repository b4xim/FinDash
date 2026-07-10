// ============================================================
// GET /api/cron/refresh-prices
//
// Triggered by Vercel Cron (or any external cron service) at:
//   05:30 UTC → 11:00 AM IST
//   09:30 UTC → 03:00 PM IST
//
// Refreshes current_price for all auto-syncable holdings and
// sends a push notification summarising the result.
//
// Auth: Bearer CRON_SECRET (same pattern as other cron routes)
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
    error?: { description?: string } | null;
  };
}

interface RefreshResult {
  name: string;
  status: "updated" | "skipped" | "failed";
  price?: number;
  reason?: string;
}

export async function GET(req: NextRequest) {
  // ── Auth guard (same pattern as all other cron routes) ──
  const cronSecret    = process.env.CRON_SECRET;
  const authHeader    = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // ── Fetch all auto-refreshable holdings ──
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
    // ── Mutual Fund → MFapi.in ──
    if (holding.mfapi_code) {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/${holding.mfapi_code}`);
        if (!res.ok) {
          results.push({ name: holding.name, status: "failed", reason: `MFapi ${res.status}` });
          continue;
        }
        const json: MFApiLatestResponse = await res.json();
        const latestNav = json.data?.[0]?.nav;
        if (!latestNav) {
          results.push({ name: holding.name, status: "failed", reason: "No NAV returned" });
          continue;
        }
        const { error } = await supabase
          .from("holdings")
          .update({ current_price: parseFloat(latestNav), price_updated_at: new Date().toISOString() })
          .eq("id", holding.id);
        results.push(error
          ? { name: holding.name, status: "failed", reason: error.message }
          : { name: holding.name, status: "updated", price: parseFloat(latestNav) });
      } catch (err) {
        results.push({ name: holding.name, status: "failed", reason: "Network/parse error" });
      }
      continue;
    }

    // ── Stock / ETF → Yahoo Finance chart endpoint ──
    if (holding.ticker && (holding.asset_type === "stock" || holding.asset_type === "etf")) {
      try {
        const chartRes = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(holding.ticker)}?region=IN&lang=en-IN&includePrePost=false&interval=2m&range=1d`
        );
        if (!chartRes.ok) {
          results.push({ name: holding.name, status: "failed", reason: `Yahoo chart ${chartRes.status}` });
          continue;
        }
        const chartJson = (await chartRes.json()) as YahooChartResponse;
        const price = chartJson.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price === undefined || price === null) {
          results.push({ name: holding.name, status: "failed", reason: `No price for "${holding.ticker}"` });
          continue;
        }
        const { error } = await supabase
          .from("holdings")
          .update({ current_price: price, price_updated_at: new Date().toISOString() })
          .eq("id", holding.id);
        results.push(error
          ? { name: holding.name, status: "failed", reason: error.message }
          : { name: holding.name, status: "updated", price });
      } catch (err) {
        results.push({
          name: holding.name,
          status: "failed",
          reason: err instanceof Error ? err.message : "Yahoo Finance lookup failed",
        });
      }
      continue;
    }

    results.push({ name: holding.name, status: "skipped", reason: "Not auto-refreshable" });
  }

  const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const failed  = results.filter(r => r.status === "failed").length;

  // Bust the holdings cache so next page load sees fresh prices
  if (updated > 0) {
    revalidateTag("holdings");
  }

  // ── Send push notification ──
  const nowIST = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });

  let notifBody: string;
  if (updated === 0 && failed === 0) {
    notifBody = "No auto-refreshable holdings found.";
  } else if (failed > 0 && updated === 0) {
    notifBody = `All ${failed} price update${failed !== 1 ? "s" : ""} failed. Check your tickers/fund codes.`;
  } else {
    const failedPart = failed > 0 ? `, ${failed} failed` : "";
    notifBody = `${updated} price${updated !== 1 ? "s" : ""} updated${failedPart} as of ${nowIST}.`;
  }

  await sendPushNotification({
    title: "📈 Investment Prices Refreshed",
    body: notifBody,
    url: "/investing",
  });

  return NextResponse.json({ updated, skipped, failed, results });
}
