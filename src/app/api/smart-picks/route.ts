// ============================================================
// GET /api/smart-picks
// Screens Nifty 50 stocks + top mutual funds, then uses
// Google Gemini to generate AI buy rationale for the best picks.
//
// Data sources (all free, no paid API keys):
//   - Yahoo Finance (yahoo-finance2) → stock quotes & metrics
//   - MFapi.in → mutual fund NAV history
//   - Google Gemini API (free tier) → AI analysis
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { NIFTY_50_TICKERS, TOP_MF_SCHEMES } from "./nifty50";
import type { SmartPick, PickSignal, RiskLevel } from "@/types";

// ── Yahoo Finance ────────────────────────────────────────────
// Loose typed interface for the fields we actually use from yahoo-finance2
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
  distFromLow: number; // % above 52w low — lower = more attractive
}

// Fetch key metrics for a batch of tickers
async function screenStocks(): Promise<StockScreenResult[]> {
  // Dynamic import to avoid ESM/CJS issues at build time
  const yf = await import("yahoo-finance2").then(m => m.default);
  const results: StockScreenResult[] = [];

  // Fetch in small batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < NIFTY_50_TICKERS.length; i += batchSize) {
    const batch = NIFTY_50_TICKERS.slice(i, i + batchSize);
    const promises = batch.map(async (ticker) => {
      try {
        // Cast via unknown to avoid the complex yahoo-finance2 union type
        const raw = await yf.quote(ticker);
        const quote = raw as unknown as YFQuote;

        if (!quote || !quote.regularMarketPrice) return null;

        const price = quote.regularMarketPrice;
        const high52w = quote.fiftyTwoWeekHigh ?? price;
        const low52w = quote.fiftyTwoWeekLow ?? price;
        const pe = quote.trailingPE ?? 0;
        // Approximate 1Y return using distance from 52w low
        const returnPct = low52w > 0 ? ((price - low52w) / low52w) * 100 : 0;
        const distFromLow = low52w > 0 ? ((price - low52w) / (high52w - low52w || 1)) * 100 : 50;

        return {
          ticker,
          name: quote.shortName || quote.longName || ticker.replace(".NS", ""),
          price,
          pe,
          high52w,
          low52w,
          returnPct,
          distFromLow,
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

// ── Mutual Fund Screening ────────────────────────────────────
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
      const navs = data.data; // array of { date, nav } sorted newest-first

      if (!navs || navs.length < 30) continue;

      const currentNav = parseFloat(navs[0].nav);

      // Find NAV closest to 1 year ago and 3 years ago
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
        if (Math.abs(d.getTime() - oneYearAgo.getTime()) < 15 * 86400000) {
          nav1y = parseFloat(entry.nav);
        }
        if (Math.abs(d.getTime() - threeYearsAgo.getTime()) < 30 * 86400000) {
          nav3y = parseFloat(entry.nav);
        }
      }

      const return1y = nav1y > 0 ? ((currentNav - nav1y) / nav1y) * 100 : 0;
      const return3y = nav3y > 0 ? (Math.pow(currentNav / nav3y, 1 / 3) - 1) * 100 : 0; // CAGR

      results.push({
        code: scheme.code,
        name: scheme.name,
        currentNav,
        return1y,
        return3y,
      });
    } catch {
      continue;
    }
  }

  return results;
}

// Parse dd-mm-yyyy date format from mfapi.in
function parseDDMMYYYY(dateStr: string): Date | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

// ── Gemini AI Analysis ───────────────────────────────────────
async function getGeminiAnalysis(
  stocks: StockScreenResult[],
  funds: MFScreenResult[]
): Promise<Map<string, { signal: PickSignal; risk: RiskLevel; rationale: string }>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Return default analysis if no key
    const map = new Map();
    [...stocks.map(s => s.ticker), ...funds.map(f => f.code)].forEach(id => {
      map.set(id, { signal: "Watch" as PickSignal, risk: "Medium" as RiskLevel, rationale: "AI analysis unavailable — add GEMINI_API_KEY to .env.local" });
    });
    return map;
  }

  // Build a structured prompt
  const stockSummary = stocks.map(s =>
    `${s.name} (${s.ticker}): Price ₹${s.price.toFixed(0)}, P/E ${s.pe.toFixed(1)}, 52w Low ₹${s.low52w.toFixed(0)}, 52w High ₹${s.high52w.toFixed(0)}, Dist from low ${s.distFromLow.toFixed(0)}%`
  ).join("\n");

  const mfSummary = funds.map(f =>
    `${f.name} (${f.code}): NAV ₹${f.currentNav.toFixed(2)}, 1Y Return ${f.return1y.toFixed(1)}%, 3Y CAGR ${f.return3y.toFixed(1)}%`
  ).join("\n");

  const prompt = `You are an expert Indian equity and mutual fund analyst. Analyze these screened picks and for EACH one provide a JSON object with:
- "id": the ticker symbol or scheme code
- "signal": one of "Strong Buy", "Buy", or "Watch"
- "risk": one of "Low", "Medium", or "High"
- "rationale": a concise 1-2 sentence buy/watch rationale for an Indian retail investor

STOCKS:
${stockSummary}

MUTUAL FUNDS:
${mfSummary}

Respond with ONLY a JSON array. No markdown, no explanation. Example format:
[{"id":"RELIANCE.NS","signal":"Buy","risk":"Medium","rationale":"Trading near support with strong refining margins..."}]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text());
      throw new Error("Gemini API request failed");
    }

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in Gemini response");

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
    // Fallback — return basic analysis
    const map = new Map();
    [...stocks.map(s => s.ticker), ...funds.map(f => f.code)].forEach(id => {
      map.set(id, { signal: "Watch" as PickSignal, risk: "Medium" as RiskLevel, rationale: "AI analysis temporarily unavailable." });
    });
    return map;
  }
}

// ── Main Handler ─────────────────────────────────────────────
export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Screen stocks and mutual funds in parallel
    const [allStocks, allFunds] = await Promise.all([
      screenStocks(),
      screenMutualFunds(),
    ]);

    // 2. Filter top stock picks — nearest to 52-week low with reasonable P/E
    const filteredStocks = allStocks
      .filter(s => s.pe > 0 && s.pe < 50) // Filter out extreme P/E
      .sort((a, b) => a.distFromLow - b.distFromLow) // Nearest to 52w low = most attractive
      .slice(0, 5);

    // 3. Filter top MF picks — highest 3Y CAGR
    const filteredFunds = allFunds
      .sort((a, b) => b.return3y - a.return3y)
      .slice(0, 5);

    // 4. Get AI analysis for the filtered picks
    const aiMap = await getGeminiAnalysis(filteredStocks, filteredFunds);

    // 5. Build final SmartPick array
    const picks: SmartPick[] = [];

    for (const s of filteredStocks) {
      const ai = aiMap.get(s.ticker) || { signal: "Watch" as PickSignal, risk: "Medium" as RiskLevel, rationale: "" };
      picks.push({
        name: s.name,
        ticker: s.ticker,
        assetType: "stock",
        currentPrice: s.price,
        returnPct: s.returnPct,
        signal: ai.signal,
        riskLevel: ai.risk,
        rationale: ai.rationale,
        metrics: {
          pe: s.pe,
          high52w: s.high52w,
          low52w: s.low52w,
        },
      });
    }

    for (const f of filteredFunds) {
      const ai = aiMap.get(f.code) || { signal: "Watch" as PickSignal, risk: "Medium" as RiskLevel, rationale: "" };
      picks.push({
        name: f.name,
        ticker: f.code,
        assetType: "mutual_fund",
        currentPrice: f.currentNav,
        returnPct: f.return1y,
        signal: ai.signal,
        riskLevel: ai.risk,
        rationale: ai.rationale,
        metrics: {
          cagr3y: f.return3y,
        },
      });
    }

    return NextResponse.json({
      picks,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Smart Picks error:", err);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
