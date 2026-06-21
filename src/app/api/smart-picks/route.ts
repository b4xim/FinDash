// ============================================================
// GET /api/smart-picks
// Screens Nifty 50, Midcap 150 and Smallcap 250 stocks, then
// uses Google Gemini to generate AI buy rationale + risk/return
// analysis for the top 3 from each segment (9 stocks total)
// plus top mutual fund picks.
//
// Data sources (all free, no paid API keys):
//   - Yahoo Finance (yahoo-finance2) → stock quotes & metrics
//   - MFapi.in → mutual fund NAV history
//   - Google Gemini API (free tier) → AI analysis
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import {
  NIFTY_50_TICKERS,
  NIFTY_MIDCAP_TICKERS,
  NIFTY_SMALLCAP_TICKERS,
  TOP_MF_SCHEMES,
  TOP_ETF_TICKERS,
} from "./nifty50";
import type { SmartPick, PickSignal, RiskLevel, StockCategory } from "@/types";

// ── Yahoo Finance ─────────────────────────────────────────────
interface YFQuote {
  regularMarketPrice?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  regularMarketPreviousClose?: number;
  shortName?: string;
  longName?: string;
}

interface StockScreenResult {
  ticker: string;
  name: string;
  price: number;
  pe: number;
  high52w: number;
  low52w: number;
  returnPct: number;
  distFromLow: number;   // % along 52w range — lower = nearer to support
  distFromHigh: number;  // % below 52w high — higher = more discounted
  volatilityScore: number; // 52w range / price — bigger range = higher vol
  category: StockCategory;
}

// Screen a list of tickers and tag each result with a category
async function screenTickers(
  tickers: string[],
  category: StockCategory
): Promise<StockScreenResult[]> {
  const YahooFinance = await import("yahoo-finance2").then((m) => m.default);
  const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  const results: StockScreenResult[] = [];

  const batchSize = 10;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const promises = batch.map(async (ticker) => {
      try {
        const raw = await yf.quote(ticker);
        const quote = raw as unknown as YFQuote;

        if (!quote || !quote.regularMarketPrice) return null;

        const price = quote.regularMarketPrice;
        const high52w = quote.fiftyTwoWeekHigh ?? price;
        const low52w = quote.fiftyTwoWeekLow ?? price;
        const pe = quote.trailingPE ?? 0;
        const range = high52w - low52w || 1;

        const returnPct = low52w > 0 ? ((price - low52w) / low52w) * 100 : 0;
        const distFromLow = ((price - low52w) / range) * 100;
        const distFromHigh = ((high52w - price) / high52w) * 100;
        const volatilityScore = (range / price) * 100; // larger = wider swing

        return {
          ticker,
          name: quote.shortName || quote.longName || ticker.replace(".NS", ""),
          price,
          pe,
          high52w,
          low52w,
          returnPct,
          distFromLow,
          distFromHigh,
          volatilityScore,
          category,
        };
      } catch {
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...(batchResults.filter(Boolean) as StockScreenResult[]));
  }

  return results;
}

// Pick the top N candidates from a segment:
// Filter out extreme P/E, then score = distFromHigh * 0.6 + (normalPE score) * 0.4
// Higher distFromHigh → more below 52w high → value opportunity
function pickTopN(stocks: StockScreenResult[], n: number): StockScreenResult[] {
  const filtered = stocks.filter((s) => s.pe > 0 && s.pe < 60);

  // Normalise P/E score: lower PE among the set → higher score
  const maxPE = Math.max(...filtered.map((s) => s.pe), 1);
  const scored = filtered.map((s) => ({
    ...s,
    score: s.distFromHigh * 0.6 + ((maxPE - s.pe) / maxPE) * 100 * 0.4,
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, n);
}

// ── Mutual Fund Screening ─────────────────────────────────────
interface MFScreenResult {
  code: string;
  name: string;
  currentNav: number;
  return1y: number;
  return3y: number;
}

async function screenMutualFunds(): Promise<MFScreenResult[]> {
  const results: MFScreenResult[] = [];

  for (const scheme of TOP_MF_SCHEMES) {
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${scheme.code}`);
      if (!res.ok) continue;

      const data = await res.json();
      const navs = data.data;

      if (!navs || navs.length < 30) continue;

      const currentNav = parseFloat(navs[0].nav);
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const threeYearsAgo = new Date(now);
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

      let nav1y = currentNav;
      let nav3y = currentNav;

      for (const entry of navs) {
        const d = parseDDMMYYYY(entry.date);
        if (!d) continue;
        if (Math.abs(d.getTime() - oneYearAgo.getTime()) < 15 * 86400000)
          nav1y = parseFloat(entry.nav);
        if (Math.abs(d.getTime() - threeYearsAgo.getTime()) < 30 * 86400000)
          nav3y = parseFloat(entry.nav);
      }

      const return1y = nav1y > 0 ? ((currentNav - nav1y) / nav1y) * 100 : 0;
      const return3y =
        nav3y > 0 ? (Math.pow(currentNav / nav3y, 1 / 3) - 1) * 100 : 0;

      results.push({ code: scheme.code, name: scheme.name, currentNav, return1y, return3y });
    } catch {
      continue;
    }
  }

  return results;
}

function parseDDMMYYYY(dateStr: string): Date | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

// ── Gemini AI Analysis ────────────────────────────────────────
async function getGeminiAnalysis(
  stocks: StockScreenResult[],
  funds: MFScreenResult[]
): Promise<Map<string, { signal: PickSignal; risk: RiskLevel; rationale: string }>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const map = new Map();
    [...stocks.map((s) => s.ticker), ...funds.map((f) => f.code)].forEach((id) => {
      map.set(id, {
        signal: "Watch" as PickSignal,
        risk: "Medium" as RiskLevel,
        rationale: "AI analysis unavailable — add GEMINI_API_KEY to .env.local",
      });
    });
    return map;
  }

  const stockSummary = stocks
    .map(
      (s) =>
        `${s.name} (${s.ticker}) [${s.category.toUpperCase()}]: Price ₹${s.price.toFixed(0)}, ` +
        `P/E ${s.pe.toFixed(1)}, 52w Low ₹${s.low52w.toFixed(0)}, 52w High ₹${s.high52w.toFixed(0)}, ` +
        `${s.distFromHigh.toFixed(0)}% below 52w high, volatility score ${s.volatilityScore.toFixed(1)}`
    )
    .join("\n");

  const mfSummary = funds
    .map(
      (f) =>
        `${f.name} (${f.code}): NAV ₹${f.currentNav.toFixed(2)}, ` +
        `1Y Return ${f.return1y.toFixed(1)}%, 3Y CAGR ${f.return3y.toFixed(1)}%`
    )
    .join("\n");

  const prompt = `You are an expert Indian equity and mutual fund analyst. Analyze these screened picks and for EACH one provide a JSON object with:
- "id": the ticker symbol or scheme code
- "signal": one of "Strong Buy", "Buy", or "Watch"
- "risk": one of "Low", "Medium", or "High" — for stocks, consider the segment (Nifty50=lower risk, Midcap=medium, Smallcap=higher risk) plus the volatility score
- "rationale": a concise 1-2 sentence risk-adjusted rationale covering both potential returns and key risks for an Indian retail investor

STOCKS & ETFs (12 picks — 3 per segment):
${stockSummary}

MUTUAL FUNDS:
${mfSummary}

Respond with ONLY a JSON array. No markdown, no explanation. Example:
[{"id":"RELIANCE.NS","signal":"Buy","risk":"Low","rationale":"Trading 18% below its 52-week high with stable refining margins; low volatility makes it a suitable core holding, though global oil price swings remain a risk."}]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 3000 },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in Gemini response");

    const analyses = JSON.parse(jsonMatch[0]) as Array<{
      id: string;
      signal: PickSignal;
      risk: RiskLevel;
      rationale: string;
    }>;

    const map = new Map<string, { signal: PickSignal; risk: RiskLevel; rationale: string }>();
    for (const a of analyses) {
      map.set(a.id, { signal: a.signal, risk: a.risk, rationale: a.rationale });
    }
    return map;
  } catch (err) {
    console.error("Gemini analysis error:", err);
    const map = new Map();
    [...stocks.map((s) => s.ticker), ...funds.map((f) => f.code)].forEach((id) => {
      map.set(id, {
        signal: "Watch" as PickSignal,
        risk: "Medium" as RiskLevel,
        rationale: "AI analysis temporarily unavailable.",
      });
    });
    return map;
  }
}

// ── Main Handler ──────────────────────────────────────────────
export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Screen all three segments + ETFs + mutual funds in parallel
    const [nifty50Stocks, midcapStocks, smallcapStocks, etfStocks, allFunds] = await Promise.all([
      screenTickers(NIFTY_50_TICKERS, "nifty50"),
      screenTickers(NIFTY_MIDCAP_TICKERS, "midcap"),
      screenTickers(NIFTY_SMALLCAP_TICKERS, "smallcap"),
      screenTickers(TOP_ETF_TICKERS, "etf"),
      screenMutualFunds(),
    ]);

    // 2. Pick top 3 from each segment
    const top3Nifty50 = pickTopN(nifty50Stocks, 3);
    const top3Midcap = pickTopN(midcapStocks, 3);
    const top3Smallcap = pickTopN(smallcapStocks, 3);
    const top3Etfs = pickTopN(etfStocks, 3);
    const allSelectedStocks = [...top3Nifty50, ...top3Midcap, ...top3Smallcap, ...top3Etfs];

    // 3. Top 5 MF picks by 3Y CAGR
    const filteredFunds = allFunds
      .sort((a, b) => b.return3y - a.return3y)
      .slice(0, 5);

    // 4. AI analysis for all picks
    const aiMap = await getGeminiAnalysis(allSelectedStocks, filteredFunds);

    // 5. Build final SmartPick array
    const picks: SmartPick[] = [];

    for (const s of allSelectedStocks) {
      const ai = aiMap.get(s.ticker) || {
        signal: "Watch" as PickSignal,
        risk: "Medium" as RiskLevel,
        rationale: "",
      };
      picks.push({
        name: s.name,
        ticker: s.ticker,
        assetType: "stock",
        stockCategory: s.category,
        currentPrice: s.price,
        returnPct: s.returnPct,
        signal: ai.signal,
        riskLevel: ai.risk,
        rationale: ai.rationale,
        metrics: {
          pe: s.pe,
          high52w: s.high52w,
          low52w: s.low52w,
          volatility: s.volatilityScore,
        },
      });
    }

    for (const f of filteredFunds) {
      const ai = aiMap.get(f.code) || {
        signal: "Watch" as PickSignal,
        risk: "Medium" as RiskLevel,
        rationale: "",
      };
      picks.push({
        name: f.name,
        ticker: f.code,
        assetType: "mutual_fund",
        currentPrice: f.currentNav,
        returnPct: f.return1y,
        signal: ai.signal,
        riskLevel: ai.risk,
        rationale: ai.rationale,
        metrics: { cagr3y: f.return3y },
      });
    }

    return NextResponse.json({ picks, refreshedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Smart Picks error:", err);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
