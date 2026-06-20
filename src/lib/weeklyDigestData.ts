// ============================================================
// weeklyDigestData.ts
// Fetches and aggregates all data needed for the weekly email digest.
// Reuses the same Supabase queries as /api/stats but scoped to
// the last 7 days (week view) AND the current month (for context).
// ============================================================

import { getSupabaseAdmin } from "@/lib/supabase";

export interface WeeklyDigestData {
  // Period labels
  weekLabel: string;       // e.g. "14 Jun – 20 Jun 2026"
  monthLabel: string;      // e.g. "June 2026"

  // This-week numbers
  weekSpend: number;
  weekIncome: number;
  weekSavings: number;
  weekTopCategories: { name: string; amount: number }[];

  // Month-to-date numbers
  monthSpend: number;
  monthIncome: number;
  savingsRate: number | null;

  // Portfolio
  investmentsTotal: number;
  investmentsGainLoss: number;

  // Net worth
  netWorth: number;

  // Budget alerts (categories over their limit)
  budgetAlerts: { category: string; spent: number; limit: number; pct: number }[];

  // Top transactions this week (by amount)
  topTransactions: { description: string; amount: number; category: string; date: string }[];

  // Recipient email
  recipientEmail: string;
}

export async function getWeeklyDigestData(): Promise<WeeklyDigestData> {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  // ── Date ranges ────────────────────────────────────────────
  const weekEnd = new Date(now);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const weekStartStr = fmt(weekStart);
  const weekEndStr   = fmt(weekEnd);

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay    = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEnd   = fmt(lastDay);

  // Pretty labels
  const dayMonthFmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const weekLabel = `${dayMonthFmt(weekStart)} – ${dayMonthFmt(weekEnd)} ${now.getFullYear()}`;
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // ── This week's transactions ───────────────────────────────
  const { data: weekTxns } = await supabase
    .from("transactions")
    .select("amount, type, category, description, date")
    .gte("date", weekStartStr)
    .lte("date", weekEndStr);

  const weekDebits  = weekTxns?.filter(t => t.type === "debit")  ?? [];
  const weekCredits = weekTxns?.filter(t => t.type === "credit") ?? [];

  const weekSpend  = weekDebits.reduce((s, t) => s + Number(t.amount), 0);
  const weekIncome = weekCredits.reduce((s, t) => s + Number(t.amount), 0);
  const weekSavings = weekIncome - weekSpend;

  // Category breakdown for the week
  const catMap: Record<string, number> = {};
  weekDebits.forEach(t => {
    catMap[t.category] = (catMap[t.category] ?? 0) + Number(t.amount);
  });
  const weekTopCategories = Object.entries(catMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Top 5 transactions this week by amount
  const topTransactions = [...weekDebits]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map(t => ({
      description: t.description,
      amount: Number(t.amount),
      category: t.category,
      date: t.date,
    }));

  // ── Month-to-date ──────────────────────────────────────────
  const { data: monthTxns } = await supabase
    .from("transactions")
    .select("amount, type")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const monthSpend  = monthTxns?.filter(t => t.type === "debit").reduce((s, t)  => s + Number(t.amount), 0) ?? 0;
  const monthIncome = monthTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const savingsRate = monthIncome > 0 ? ((monthIncome - monthSpend) / monthIncome) * 100 : null;

  // ── Portfolio ──────────────────────────────────────────────
  const { data: holdings } = await supabase
    .from("holdings")
    .select("units, current_price, buy_price");

  const investmentsTotal    = holdings?.reduce((s, h) => s + h.units * h.current_price, 0) ?? 0;
  const investmentsInvested = holdings?.reduce((s, h) => s + h.units * h.buy_price, 0)    ?? 0;
  const investmentsGainLoss = investmentsTotal - investmentsInvested;

  // ── Net worth (simple: all-time income - spend + investments) ──
  const { data: allTxns } = await supabase
    .from("transactions")
    .select("amount, type, category");

  const allTimeIncome = allTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const allTimeSpend  = allTxns?.filter(t => t.type === "debit" && t.category !== "Investment").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const netWorth = (allTimeIncome - allTimeSpend) + investmentsTotal;

  // ── Budget alerts ──────────────────────────────────────────
  const { data: budgetLimits } = await supabase.from("budget_limits").select("*");
  const budgetAlerts = (budgetLimits ?? [])
    .map(bl => {
      const spent = catMap[bl.category] ?? 0; // week spend per category
      const pct   = bl.monthly_limit > 0 ? (spent / bl.monthly_limit) * 100 : 0;
      return { category: bl.category, spent, limit: bl.monthly_limit, pct };
    })
    .filter(a => a.pct >= 50) // only surface meaningful alerts
    .sort((a, b) => b.pct - a.pct);

  const recipientEmail = process.env.WEEKLY_DIGEST_TO ?? "";

  return {
    weekLabel,
    monthLabel,
    weekSpend,
    weekIncome,
    weekSavings,
    weekTopCategories,
    monthSpend,
    monthIncome,
    savingsRate,
    investmentsTotal,
    investmentsGainLoss,
    netWorth,
    budgetAlerts,
    topTransactions,
    recipientEmail,
  };
}
