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
    // Dynamic import to keep this server-side only
    const YahooFinance = await import("yahoo-finance2").then((m) => m.default);
    // Suppress the survey notice that can clutter logs
    // @ts-ignore - yahooFinance type is a bit tricky with dynamic imports
    const yf = typeof YahooFinance === "function" ? new YahooFinance({ suppressNotices: ["yahooSurvey"] }) : YahooFinance;

    // Use yahoo-finance2 search which handles crumb/cookie auth properly
    const result = await yf.search(q, {
      newsCount: 0,
      quotesCount: 20,
    });

    const quotes = result.quotes ?? [];

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
