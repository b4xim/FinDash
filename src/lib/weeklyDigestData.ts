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
  topGainers: { name: string; gainLossPct: number; currentValue: number }[];
  topLosers:  { name: string; gainLossPct: number; currentValue: number }[];

  // Net worth
  netWorth: number;

  // Budget alerts (categories over their limit)
  budgetAlerts: { category: string; spent: number; limit: number; pct: number }[];

  // Top transactions this week (by amount)
  topTransactions: { description: string; amount: number; category: string; date: string }[];

  // Food & Dining spotlight
  foodSpendThisMonth: number;
  avgDailyFoodSpend:  number;
  foodTxnCount:       number;
  foodSpendPct:       number;

  // EMI summary
  activeEmiCount:      number;
  totalMonthlyEmi:     number;
  noCostEmiCount:      number;

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
  const weekLabel  = `${dayMonthFmt(weekStart)} – ${dayMonthFmt(weekEnd)} ${now.getFullYear()}`;
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // ── This week's transactions ───────────────────────────────
  const { data: weekTxns } = await supabase
    .from("transactions")
    .select("amount, type, category, description, date")
    .gte("date", weekStartStr)
    .lte("date", weekEndStr);

  const weekDebits  = weekTxns?.filter(t => t.type === "debit")  ?? [];
  const weekCredits = weekTxns?.filter(t => t.type === "credit") ?? [];

  const weekSpend   = weekDebits.reduce((s, t)  => s + Number(t.amount), 0);
  const weekIncome  = weekCredits.reduce((s, t) => s + Number(t.amount), 0);
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

  // ── Month-to-date transactions ─────────────────────────────
  const { data: monthTxns } = await supabase
    .from("transactions")
    .select("amount, type, category")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const monthDebits  = monthTxns?.filter(t => t.type === "debit")  ?? [];
  const monthSpend   = monthDebits.reduce((s, t) => s + Number(t.amount), 0);
  const monthIncome  = monthTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const savingsRate  = monthIncome > 0 ? ((monthIncome - monthSpend) / monthIncome) * 100 : null;

  // ── Food & Dining spotlight ────────────────────────────────
  const daysElapsed        = Math.max(now.getDate(), 1);
  const foodTxns           = monthDebits.filter(t => t.category === "Food & Dining");
  const foodSpendThisMonth = foodTxns.reduce((s, t) => s + Number(t.amount), 0);
  const foodTxnCount       = foodTxns.length;
  const avgDailyFoodSpend  = foodSpendThisMonth / daysElapsed;
  const foodSpendPct       = monthSpend > 0 ? (foodSpendThisMonth / monthSpend) * 100 : 0;

  // ── Portfolio ──────────────────────────────────────────────
  const { data: holdings } = await supabase
    .from("holdings")
    .select("name, units, current_price, buy_price");

  const investmentsTotal    = holdings?.reduce((s, h) => s + h.units * h.current_price, 0) ?? 0;
  const investmentsInvested = holdings?.reduce((s, h) => s + h.units * h.buy_price,    0) ?? 0;
  const investmentsGainLoss = investmentsTotal - investmentsInvested;

  // Top gainers & losers (by % gain/loss, exclude 0-priced)
  const holdingsWithPnl = (holdings ?? [])
    .map(h => {
      const currentValue = h.units * h.current_price;
      const investedValue = h.units * h.buy_price;
      const gainLossPct = investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : 0;
      return { name: h.name, gainLossPct, currentValue };
    })
    .filter(h => h.currentValue > 0);

  const sorted     = [...holdingsWithPnl].sort((a, b) => b.gainLossPct - a.gainLossPct);
  const topGainers = sorted.filter(h => h.gainLossPct > 0).slice(0, 3);
  const topLosers  = sorted.filter(h => h.gainLossPct < 0).reverse().slice(0, 3);

  // ── Net worth ──────────────────────────────────────────────
  const { data: allTxns } = await supabase
    .from("transactions")
    .select("amount, type, category");

  const allTimeIncome = allTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const allTimeSpend  = allTxns?.filter(t => t.type === "debit" && t.category !== "Investment").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const netWorth      = (allTimeIncome - allTimeSpend) + investmentsTotal;

  // ── Budget alerts ──────────────────────────────────────────
  const { data: budgetLimits } = await supabase.from("budget_limits").select("*");
  const budgetAlerts = (budgetLimits ?? [])
    .map(bl => {
      const spent = catMap[bl.category] ?? 0; // week spend per category
      const pct   = bl.monthly_limit > 0 ? (spent / bl.monthly_limit) * 100 : 0;
      return { category: bl.category, spent, limit: bl.monthly_limit, pct };
    })
    .filter(a => a.pct >= 50)
    .sort((a, b) => b.pct - a.pct);

  // ── EMI summary ────────────────────────────────────────────
  const { data: emiLoans } = await supabase
    .from("emi_loans")
    .select("emi_amount, is_active, is_no_cost_emi");

  const activeLoans     = (emiLoans ?? []).filter(l => l.is_active);
  const activeEmiCount  = activeLoans.length;
  const totalMonthlyEmi = activeLoans.reduce((s, l) => s + Number(l.emi_amount), 0);
  const noCostEmiCount  = activeLoans.filter(l => l.is_no_cost_emi).length;

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
    topGainers,
    topLosers,
    netWorth,
    budgetAlerts,
    topTransactions,
    foodSpendThisMonth,
    avgDailyFoodSpend,
    foodTxnCount,
    foodSpendPct,
    activeEmiCount,
    totalMonthlyEmi,
    noCostEmiCount,
    recipientEmail,
  };
}
