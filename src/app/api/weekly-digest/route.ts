// ============================================================
// GET /api/weekly-digest
// Sends the weekly financial summary email via Resend.
//
// Protected by CRON_SECRET header so only trusted callers
// (cron-job.org, manual trigger from Settings) can fire it.
//
// Trigger options:
//   1. Manual "Send Now" button in the Settings page
//   2. cron-job.org free tier — set to call this URL every Sunday
//      with header:  Authorization: Bearer <CRON_SECRET>
//
// Required env vars:
//   RESEND_API_KEY       — from resend.com dashboard
//   WEEKLY_DIGEST_TO     — your email address
//   CRON_SECRET          — any random string you choose
//   GEMINI_API_KEY       — optional, for AI insight paragraph
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAuth } from "@/lib/session";
import { getWeeklyDigestData } from "@/lib/weeklyDigestData";
import { renderWeeklyDigestEmail } from "@/lib/weeklyDigestTemplate";

// ── Optional: Gemini AI insight ───────────────────────────────
async function getAIInsight(
  weekSpend: number,
  weekIncome: number,
  savingsRate: number | null,
  topCategory: string | undefined,
  foodSpendPct: number,
  portfolioGainLoss: number,
  totalMonthlyEmi: number,
): Promise<string | undefined> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return undefined;

  const srText   = savingsRate !== null ? `${savingsRate.toFixed(1)}% savings rate` : "unknown savings rate";
  const catText  = topCategory ? `highest spending in ${topCategory}` : "spending across various categories";
  const foodText = foodSpendPct > 0 ? `food & dining is ${foodSpendPct.toFixed(1)}% of monthly spend` : "";
  const pfText   = portfolioGainLoss !== 0
    ? `portfolio is ${portfolioGainLoss >= 0 ? "up" : "down"} ₹${Math.abs(portfolioGainLoss).toFixed(0)} overall`
    : "";
  const emiText  = totalMonthlyEmi > 0 ? `monthly EMI commitments of ₹${totalMonthlyEmi.toFixed(0)}` : "";

  const contextParts = [srText, catText, foodText, pfText, emiText].filter(Boolean).join(", ");

  const prompt = `You are a friendly, encouraging personal finance advisor for an Indian user.
Based on this week's data: spent ₹${weekSpend.toFixed(0)}, earned ₹${weekIncome.toFixed(0)}, ${contextParts}.
Write exactly 2–3 sentences of personalised, specific financial insight. Reference the actual numbers.
Mention food spend if it is above 25%. Reference portfolio if gains/losses are significant. Be warm and actionable.
Do not use bullet points, headers, or markdown. Just plain text.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
        }),
      }
    );
    if (!res.ok) return undefined;
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  } catch {
    return undefined;
  }
}

// ── Main handler ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // ── Auth: accept CRON_SECRET header (cron-job.org)
  //         OR a valid session cookie (Settings "Send Now" button)
  const cronSecret     = process.env.CRON_SECRET;
  const authHeader     = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();
  const cronMatches    = cronSecret && providedSecret === cronSecret;

  // If the cron secret doesn't match, fall back to session auth
  if (!cronMatches) {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Check required env vars ───────────────────────────────
  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail      = process.env.WEEKLY_DIGEST_TO;

  if (!resendApiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set. Add it to .env.local." },
      { status: 500 }
    );
  }
  if (!toEmail) {
    return NextResponse.json(
      { error: "WEEKLY_DIGEST_TO is not set. Add your email to .env.local." },
      { status: 500 }
    );
  }

  try {
    // 1. Gather all digest data
    const data = await getWeeklyDigestData();

    // 2. Optional Gemini AI insight
    const aiInsight = await getAIInsight(
      data.weekSpend,
      data.weekIncome,
      data.savingsRate,
      data.weekTopCategories[0]?.name,
      data.foodSpendPct,
      data.investmentsGainLoss,
      data.totalMonthlyEmi,
    );

    // 3. Render the HTML email
    const html = renderWeeklyDigestEmail(data, aiInsight);

    // 4. Send via Resend
    const resend = new Resend(resendApiKey);
    const { data: sendData, error } = await resend.emails.send({
      from: "FinDash <onboarding@resend.dev>", // swap for your verified domain email
      to: [toEmail],
      subject: `📊 FinDash Weekly Summary — ${data.weekLabel}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sent: true,
      id: sendData?.id,
      recipient: toEmail,
      week: data.weekLabel,
    });
  } catch (err) {
    console.error("Weekly digest error:", err);
    return NextResponse.json(
      { error: "Failed to send weekly digest" },
      { status: 500 }
    );
  }
}
