// ============================================================
// GET /api/ticker-search?q=suzlon&type=stock
// Proxies Yahoo Finance's autocomplete search endpoint,
// filters results to NSE (.NS) symbols, and returns the
// top 8 matches — keeping Yahoo calls server-side to avoid CORS.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";

// Shape returned by Yahoo Finance v1 search
interface YFSearchResult {
  symbol:       string;
  shortname?:   string;
  longname?:    string;
  exchDisp?:    string;   // "NSE", "BSE", "MCX" …
  typeDisp?:    string;   // "Equity", "ETF", "Mutual Fund" …
  quoteType?:   string;   // "EQUITY", "ETF" …
}

interface YFSearchResponse {
  quotes?: YFSearchResult[];
}

export interface TickerResult {
  symbol:   string;   // e.g. "SUZLON.NS"
  name:     string;   // e.g. "Suzlon Energy Limited"
  exchange: string;   // e.g. "NSE"
  type:     string;   // e.g. "Equity"
}

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    // Yahoo Finance autocomplete — add .NS suffix hint for Indian stocks
    const url =
      `https://query2.finance.yahoo.com/v1/finance/search` +
      `?q=${encodeURIComponent(q)}` +
      `&lang=en-US&region=IN` +
      `&quotesCount=20&newsCount=0&enableFuzzyQuery=false` +
      `&quotesQueryId=tss_match_phrase_query`;

    const res = await fetch(url, {
      headers: {
        // Yahoo expects a browser-like UA; otherwise it may return 429
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      // 5 second timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`Yahoo Finance search error: ${res.status}`);
      return NextResponse.json([], { status: 200 }); // fail gracefully, empty results
    }

    const json = (await res.json()) as YFSearchResponse;
    const quotes = json.quotes ?? [];

    // Filter to NSE/BSE equity & ETF results only — exclude US, mutual funds, etc.
    const filtered: TickerResult[] = quotes
      .filter(q =>
        q.symbol &&
        (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO")) &&
        (q.quoteType === "EQUITY" || q.quoteType === "ETF")
      )
      .map(q => ({
        symbol:   q.symbol,
        name:     q.longname || q.shortname || q.symbol,
        exchange: q.symbol.endsWith(".NS") ? "NSE" : "BSE",
        type:     q.quoteType === "ETF" ? "ETF" : "Equity",
      }))
      // Prefer NSE over BSE when both exist for the same company
      .filter((item, idx, arr) => {
        if (item.exchange === "NSE") return true;
        // Keep BSE result only if no NSE version exists
        const nseVersion = item.symbol.replace(".BO", ".NS");
        return !arr.some(x => x.symbol === nseVersion);
      })
      .slice(0, 8);

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("Ticker search error:", err);
    return NextResponse.json([]); // fail gracefully
  }
}
