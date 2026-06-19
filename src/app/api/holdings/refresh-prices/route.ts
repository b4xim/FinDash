// ============================================================
// POST /api/holdings/refresh-prices
// Fetches the latest NAV for every holding that has an mfapi_code
// (i.e. mutual funds only) and updates current_price in Supabase.
// Stocks/ETFs/FD/PPF are untouched — those stay manual.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

interface MFApiLatestResponse {
  data: { date: string; nav: string }[];
}

export async function POST() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Only fetch holdings that have an mfapi_code set
  const { data: holdings, error: fetchError } = await supabase
    .from("holdings")
    .select("id, mfapi_code, name")
    .not("mfapi_code", "is", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ updated: 0, failed: 0, results: [] });
  }

  const results: { name: string; status: "updated" | "failed"; price?: number }[] = [];

  // Fetch each fund's latest NAV — done sequentially to be polite to the free API
  for (const holding of holdings) {
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${holding.mfapi_code}/latest`);
      if (!res.ok) {
        results.push({ name: holding.name, status: "failed" });
        continue;
      }

      const json: MFApiLatestResponse = await res.json();
      const latestNav = json.data?.[0]?.nav;

      if (!latestNav) {
        results.push({ name: holding.name, status: "failed" });
        continue;
      }

      // Update this holding's current_price
      const { error: updateError } = await supabase
        .from("holdings")
        .update({
          current_price: parseFloat(latestNav),
          price_updated_at: new Date().toISOString(),
        })
        .eq("id", holding.id);

      if (updateError) {
        results.push({ name: holding.name, status: "failed" });
      } else {
        results.push({ name: holding.name, status: "updated", price: parseFloat(latestNav) });
      }
    } catch (err) {
      console.error(`Failed to refresh ${holding.name}:`, err);
      results.push({ name: holding.name, status: "failed" });
    }
  }

  const updated = results.filter(r => r.status === "updated").length;
  const failed  = results.filter(r => r.status === "failed").length;

  return NextResponse.json({ updated, failed, results });
}
