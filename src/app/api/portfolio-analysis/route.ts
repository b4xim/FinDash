// ============================================================
// POST /api/portfolio-analysis
// Sends the user's full holdings to Google Gemini for a
// comprehensive portfolio health analysis:
//   - Sell / trim recommendations
//   - Quantity (top-up / reduce) suggestions
//   - Category / sector allocation advice
//   - Overall portfolio structure improvements
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import type { Holding } from "@/types";

// ── Types ──────────────────────────────────────────────────────

export interface HoldingAnalysis {
  holdingId: string;
  name: string;
  action: "Hold" | "Sell" | "Trim" | "Add More" | "Reduce";
  urgency: "High" | "Medium" | "Low";
  reason: string;
  suggestedQtyChange?: string; // e.g. "+50 units", "-30%", "Exit fully"
}

export interface CategoryInsight {
  category: string;
  currentPct: number;
  recommendedPct: string; // e.g. "20–30%"
  gap: "Over" | "Under" | "Balanced";
  advice: string;
}

export interface PortfolioAnalysisResult {
  overallScore: number;         // 1–10 portfolio health score
  overallSummary: string;       // 2–3 sentence executive summary
  riskProfile: "Conservative" | "Moderate" | "Aggressive";
  diversificationComment: string;
  holdingRecommendations: HoldingAnalysis[];
  categoryInsights: CategoryInsight[];
  topActions: string[];         // 3-5 immediate action items
  longTermAdvice: string;       // 2-3 sentences of strategic advice
  analysedAt: string;
}

// ── Handler ────────────────────────────────────────────────────

export async function POST() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all holdings
  const { data: holdings, error } = await supabase
    .from("holdings")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch holdings" }, { status: 500 });
  }

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ error: "No holdings found to analyse" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI analysis unavailable — GEMINI_API_KEY missing" }, { status: 500 });
  }

  // ── Compute derived metrics per holding ─────────────────────
  const totalPortfolioValue = (holdings as Holding[]).reduce(
    (sum, h) => sum + h.units * h.current_price,
    0
  );

  const holdingSummaries = (holdings as Holding[]).map((h) => {
    const currentValue = h.units * h.current_price;
    const investedValue = h.units * h.buy_price;
    const gainLoss = currentValue - investedValue;
    const gainLossPct = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;
    const portfolioWeight = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

    return {
      id: h.id,
      name: h.name,
      ticker: h.ticker || "—",
      assetType: h.asset_type,
      account: h.account || "—",
      units: h.units,
      buyPrice: h.buy_price,
      currentPrice: h.current_price,
      currentValue: Math.round(currentValue),
      investedValue: Math.round(investedValue),
      gainLossPct: Math.round(gainLossPct * 10) / 10,
      portfolioWeight: Math.round(portfolioWeight * 10) / 10,
    };
  });

  // ── Category allocation breakdown ───────────────────────────
  const categoryBreakdown: Record<string, number> = {};
  holdingSummaries.forEach((h) => {
    categoryBreakdown[h.assetType] = (categoryBreakdown[h.assetType] ?? 0) + h.currentValue;
  });
  const categoryPcts = Object.entries(categoryBreakdown).map(([cat, val]) => ({
    category: cat,
    value: val,
    pct: totalPortfolioValue > 0 ? Math.round((val / totalPortfolioValue) * 100 * 10) / 10 : 0,
  }));

  // ── Build Gemini prompt ─────────────────────────────────────
  const holdingLines = holdingSummaries
    .map(
      (h) =>
        `ID:${h.id} | ${h.name} (${h.ticker}) | Type:${h.assetType} | Units:${h.units} | ` +
        `BuyPrice:₹${h.buyPrice} | CurrPrice:₹${h.currentPrice} | Value:₹${h.currentValue} | ` +
        `Gain/Loss:${h.gainLossPct > 0 ? "+" : ""}${h.gainLossPct}% | Weight:${h.portfolioWeight}%`
    )
    .join("\n");

  const categoryLines = categoryPcts
    .map((c) => `${c.category}: ₹${c.value} (${c.pct}%)`)
    .join(", ");

  const prompt = `You are an expert Indian retail investment advisor. Analyse this portfolio and return a detailed, actionable JSON report.

TOTAL PORTFOLIO VALUE: ₹${Math.round(totalPortfolioValue).toLocaleString("en-IN")}
NUMBER OF HOLDINGS: ${holdings.length}

HOLDINGS (each line: ID | Name | Ticker | Type | Units | BuyPrice | CurrentPrice | CurrentValue | Gain/Loss% | Portfolio Weight%):
${holdingLines}

CURRENT ALLOCATION:
${categoryLines}

Provide a comprehensive analysis with the following JSON structure. Return ONLY valid JSON, no markdown, no explanation:

{
  "overallScore": <integer 1-10, portfolio health score>,
  "overallSummary": "<2-3 sentences summarising overall portfolio health, key strengths and weaknesses>",
  "riskProfile": "<one of: Conservative, Moderate, Aggressive>",
  "diversificationComment": "<1-2 sentences about diversification quality>",
  "holdingRecommendations": [
    {
      "holdingId": "<ID from the holding>",
      "name": "<holding name>",
      "action": "<one of: Hold, Sell, Trim, Add More, Reduce>",
      "urgency": "<one of: High, Medium, Low>",
      "reason": "<concise 1-2 sentence rationale tailored to this specific holding's metrics>",
      "suggestedQtyChange": "<optional: e.g. '+50 units', 'Sell 30%', 'Exit fully', 'Add ₹5,000 SIP'>", 
    }
  ],
  "categoryInsights": [
    {
      "category": "<asset type e.g. mutual_fund, stock, etf, fd, ppf, other>",
      "currentPct": <current portfolio % as number>,
      "recommendedPct": "<recommended range e.g. '20-30%'>",
      "gap": "<one of: Over, Under, Balanced>",
      "advice": "<1 sentence specific advice for this category>"
    }
  ],
  "topActions": ["<action 1>", "<action 2>", "<action 3>", "<action 4 if needed>", "<action 5 if needed>"],
  "longTermAdvice": "<2-3 sentences of strategic long-term wealth building advice specific to this portfolio>"
}

Rules:
- Be specific to the actual holdings and numbers provided, not generic.
- For Indian market: stocks = higher risk, mutual funds (especially index) = balanced, FD/PPF = conservative.
- If a holding has >25% weight, flag it as over-concentrated regardless of performance.
- If gain/loss is below -15%, suggest reviewing for a potential tax-loss harvest or averaging down.
- If gain/loss is above +100%, suggest considering partial profit booking.
- Prioritise actionability — every recommendation must be concrete.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 4000 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error: ${res.status} — ${errText}`);
    }

    const json = await res.json();
    const rawText: string = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object in Gemini response");

    const analysis = JSON.parse(jsonMatch[0]) as Omit<PortfolioAnalysisResult, "analysedAt">;

    const result: PortfolioAnalysisResult = {
      ...analysis,
      analysedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Portfolio analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyse portfolio — please try again" },
      { status: 500 }
    );
  }
}
