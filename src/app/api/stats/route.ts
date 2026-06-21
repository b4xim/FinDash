// ============================================================
// GET /api/stats
// Returns aggregated numbers for the Overview page:
//   - This month's total spend, income, savings
//   - Last month's spend (for % change)
//   - Category breakdown for pie chart
//   - Last 6 months spend + income for bar chart
//   - Total investment value (from holdings table)
//   - Insight metrics: savings rate, avg daily spend, biggest expense, peak day
//   - Budget alerts: categories near/over their limit
//   - Necessary vs Unnecessary breakdown
// ============================================================

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

const getCachedStatsData = unstable_cache(
  async (
    thisMonthStart: string,
    thisMonthEnd: string,
    lastMonthStart: string,
    lastMonthEnd: string,
    trendRanges: { start: string; end: string; label: string }[]
  ) => {
    const supabase = getSupabaseAdmin();
    const [
      thisMonthRes,
      lastMonthRes,
      holdingsRes,
      allTxnsRes,
      budgetLimitsRes,
      ...trendResults
    ] = await Promise.all([
      supabase.from("transactions").select("amount, type, category, necessary, date, description").gte("date", thisMonthStart).lte("date", thisMonthEnd),
      supabase.from("transactions").select("amount, type").gte("date", lastMonthStart).lte("date", lastMonthEnd),
      supabase.from("holdings").select("units, current_price, buy_price"),
      supabase.from("transactions").select("amount, type, category"),
      supabase.from("budget_limits").select("*"),
      ...trendRanges.map(range => supabase.from("transactions").select("amount, type").gte("date", range.start).lte("date", range.end))
    ]);

    return {
      thisMonthTxns: thisMonthRes.data,
      lastMonthTxns: lastMonthRes.data,
      holdings: holdingsRes.data,
      allTxns: allTxnsRes.data,
      budgetLimits: budgetLimitsRes.data,
      trendDataResults: trendResults.map(r => r.data)
    };
  },
  ["dashboard-stats-data"],
  { tags: ["transactions", "holdings", "budget_limits"] }
);

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const now = new Date();

  // ── Helper: build YYYY-MM-DD range for a given month offset ──
  function monthRange(offset: number) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const end = lastDay.toISOString().split("T")[0];
    const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
    return { start, end, label };
  }

  // ── Fetch all required data concurrently ──
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const trendRanges = [5, 4, 3, 2, 1, 0].map(i => monthRange(-i));

  const cachedData = await getCachedStatsData(
    thisMonth.start,
    thisMonth.end,
    lastMonth.start,
    lastMonth.end,
    trendRanges
  );

  const thisMonthTxns = cachedData.thisMonthTxns;
  const lastMonthTxns = cachedData.lastMonthTxns;
  const holdings = cachedData.holdings;
  const allTxns = cachedData.allTxns;
  const budgetLimits = cachedData.budgetLimits;

  // ── Last 6 months for trend chart ──
  const trendData = trendRanges.map((range, i) => {
    const txns = cachedData.trendDataResults[i];
    const spend  = txns?.filter(t => t.type === "debit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
    const income = txns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
    return { month: range.label, spend, income };
  });

  // ── Holdings total ──
  const investmentsTotal    = holdings?.reduce((s, h) => s + Number(h.units) * Number(h.current_price), 0) ?? 0;
  const investmentsInvested = holdings?.reduce((s, h) => s + Number(h.units) * Number(h.buy_price), 0) ?? 0;
  const investmentsGainLoss = investmentsTotal - investmentsInvested;

  // ── All-time cash flow (for net worth + emergency fund) ──
  const allTimeIncome = allTxns
    ?.filter(t => t.type === "credit")
    .reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const allTimeSpend = allTxns
    ?.filter(t => t.type === "debit" && t.category !== "Investment")
    .reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  const netWorth  = (allTimeIncome - allTimeSpend) + investmentsTotal;
  const netCash   = allTimeIncome - allTimeSpend; // savings without investments

  // ── Aggregate this month ──
  const thisSpend  = thisMonthTxns?.filter(t => t.type === "debit").reduce((s, t)  => s + Number(t.amount), 0) ?? 0;
  const thisIncome = thisMonthTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const lastSpend  = lastMonthTxns?.filter(t => t.type === "debit").reduce((s, t)  => s + Number(t.amount), 0) ?? 0;
  const lastIncome = lastMonthTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  // ── Category breakdown (this month debits only) ──
  const categoryMap: Record<string, number> = {};
  const thisMonthDebits = thisMonthTxns?.filter(t => t.type === "debit") ?? [];
  thisMonthDebits.forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] ?? 0) + Number(t.amount);
  });
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── Necessary vs Unnecessary ──
  const necessarySpend   = thisMonthDebits.filter(t => t.necessary === "Necessary").reduce((s, t) => s + Number(t.amount), 0);
  const unnecessarySpend = thisMonthDebits.filter(t => t.necessary === "Unnecessary").reduce((s, t) => s + Number(t.amount), 0);
  const untaggedSpend    = thisMonthDebits.filter(t => !t.necessary).reduce((s, t) => s + Number(t.amount), 0);

  // ── Insight metrics ──
  const daysElapsed        = Math.max(now.getDate(), 1);
  const daysInMonth        = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const avgDailySpend      = thisSpend / daysElapsed;
  const projectedMonthSpend = avgDailySpend * daysInMonth;
  const savingsRate        = thisIncome > 0 ? ((thisIncome - thisSpend) / thisIncome) * 100 : null;

  // ── Food & Dining specific insights ──
  const foodTxns            = thisMonthDebits.filter(t => t.category === "Food & Dining");
  const foodSpendThisMonth  = foodTxns.reduce((s, t) => s + Number(t.amount), 0);
  const foodTxnCount        = foodTxns.length;
  const avgDailyFoodSpend   = foodSpendThisMonth / daysElapsed;
  const foodSpendPct        = thisSpend > 0 ? (foodSpendThisMonth / thisSpend) * 100 : 0;

  // Biggest single expense this month
  const biggestExpense = thisMonthDebits.reduce<{ description: string; amount: number; category: string } | null>(
    (max, t) => Number(t.amount) > (max?.amount ?? 0)
      ? { description: t.description, amount: Number(t.amount), category: t.category }
      : max,
    null
  );

  // Peak spend day of week (0=Sun … 6=Sat)
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  thisMonthDebits.forEach(t => {
    const day = new Date(t.date + "T00:00:00").getDay();
    dayTotals[day] += Number(t.amount);
  });
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const peakDayIdx  = dayTotals.indexOf(Math.max(...dayTotals));
  const topSpendDay = dayTotals[peakDayIdx] > 0 ? DAY_NAMES[peakDayIdx] : null;

  // Emergency fund months
  const last3MonthSpends = trendData.slice(-3).map(d => d.spend).filter(s => s > 0);
  const avgMonthlySpend  = last3MonthSpends.length > 0
    ? last3MonthSpends.reduce((a, b) => a + b, 0) / last3MonthSpends.length
    : 1;
  const emergencyMonths  = avgMonthlySpend > 0 ? netCash / avgMonthlySpend : 0;

  // ── Budget alerts ──
  const budgetAlerts = (budgetLimits ?? []).map(bl => {
    const spent = categoryMap[bl.category] ?? 0;
    const pct   = bl.monthly_limit > 0 ? (spent / bl.monthly_limit) * 100 : 0;
    return { category: bl.category, spent, limit: bl.monthly_limit, pct, alertAt: bl.alert_at_pct };
  });

  return NextResponse.json({
    thisMonth: { spend: thisSpend, income: thisIncome },
    lastMonth: { spend: lastSpend, income: lastIncome },
    investmentsTotal,
    investmentsGainLoss,
    netWorth,
    netCash,
    categoryBreakdown,
    trendData,
    necessaryBreakdown: { necessary: necessarySpend, unnecessary: unnecessarySpend, untagged: untaggedSpend },
    // New insight fields
    savingsRate,
    avgDailySpend,
    projectedMonthSpend,
    biggestExpense,
    topSpendDay,
    emergencyMonths,
    avgMonthlySpend,
    budgetAlerts,
    // Food & Dining insights
    foodSpendThisMonth,
    avgDailyFoodSpend,
    foodTxnCount,
    foodSpendPct,
  });
}
