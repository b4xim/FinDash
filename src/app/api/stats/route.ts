// ============================================================
// GET /api/stats
// Returns aggregated numbers for the Overview page:
//   - This month's total spend, income, savings
//   - Last month's spend (for % change) + category breakdown
//   - Category breakdown for pie chart
//   - Last 6 months spend + income for bar chart
//   - Total investment value (from holdings table)
//   - Insight metrics: savings rate, avg daily spend, biggest expense, peak day
//   - Budget alerts: categories near/over their limit
//   - Necessary vs Unnecessary breakdown
//   - Savings trend (6-month sparkline data)
//   - EMI obligations summary
//   - Goals progress snapshot
//   - Cash flow breakdown
//   - Top 5 transactions this month
//   - Month-over-month category comparison
//   - Financial health score
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
      emiLoansRes,
      goalsRes,
      ...trendResults
    ] = await Promise.all([
      supabase.from("transactions").select("amount, type, category, necessary, date, description, account").gte("date", thisMonthStart).lte("date", thisMonthEnd),
      // Now also select category for month-over-month comparison
      supabase.from("transactions").select("amount, type, category, account").gte("date", lastMonthStart).lte("date", lastMonthEnd),
      supabase.from("holdings").select("units, current_price, buy_price"),
      supabase.from("transactions").select("amount, type, category"),
      supabase.from("budget_limits").select("*"),
      // New: EMI loans
      supabase.from("emi_loans").select("emi_amount, is_active, is_no_cost_emi, name, tenure_months, start_date").eq("is_active", true),
      // New: Financial goals
      supabase.from("financial_goals").select("name, target_amount, saved_amount, color, icon, deadline, completed").eq("completed", false),
      ...trendRanges.map(range => supabase.from("transactions").select("amount, type").gte("date", range.start).lte("date", range.end))
    ]);

    return {
      thisMonthTxns: thisMonthRes.data,
      lastMonthTxns: lastMonthRes.data,
      holdings: holdingsRes.data,
      allTxns: allTxnsRes.data,
      budgetLimits: budgetLimitsRes.data,
      emiLoans: emiLoansRes.data,
      goals: goalsRes.data,
      trendDataResults: trendResults.map(r => r.data)
    };
  },
  ["dashboard-stats-data"],
  { tags: ["transactions", "holdings", "budget_limits", "emi_loans", "financial_goals"] }
);

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const emiLoans = cachedData.emiLoans ?? [];
  const rawGoals = cachedData.goals ?? [];

  // ── Last 6 months for trend chart ──
  const trendData = trendRanges.map((range, i) => {
    const txns = cachedData.trendDataResults[i];
    const spend  = txns?.filter(t => t.type === "debit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
    const income = txns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
    return { month: range.label, spend, income };
  });

  // ── Savings trend sparkline (6 months) ──
  const savingsTrend = trendData.map(d => ({
    month: d.month,
    savings: d.income - d.spend,
  }));

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
  const netCash   = allTimeIncome - allTimeSpend;

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

  // ── Last month category breakdown (for comparison) ──
  const lastMonthCategoryMap: Record<string, number> = {};
  const lastMonthDebits = lastMonthTxns?.filter(t => t.type === "debit") ?? [];
  lastMonthDebits.forEach(t => {
    lastMonthCategoryMap[t.category] = (lastMonthCategoryMap[t.category] ?? 0) + Number(t.amount);
  });

  // ── Month-over-month category comparison ──
  const allCategories = new Set([
    ...Object.keys(categoryMap),
    ...Object.keys(lastMonthCategoryMap),
  ]);
  const categoryComparison = Array.from(allCategories)
    .map(cat => {
      const thisMonthAmt = categoryMap[cat] ?? 0;
      const lastMonthAmt = lastMonthCategoryMap[cat] ?? 0;
      const change = thisMonthAmt - lastMonthAmt;
      const changePct = lastMonthAmt > 0 ? (change / lastMonthAmt) * 100 : (thisMonthAmt > 0 ? 100 : 0);
      return { category: cat, thisMonth: thisMonthAmt, lastMonth: lastMonthAmt, change, changePct };
    })
    .filter(c => c.category !== "Income" && c.category !== "Transfer" && (Math.abs(c.change) >= 500 || Math.abs(c.changePct) >= 10))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

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

  // ── Top 5 transactions this month ──
  const topTransactions = [...thisMonthDebits]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map(t => ({
      description: t.description,
      amount: Number(t.amount),
      category: t.category,
      date: t.date,
    }));

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

  // ── EMI obligations ──
  const activeEmiCount  = emiLoans.length;
  const totalMonthlyEmi = emiLoans.reduce((s, l) => s + Number(l.emi_amount), 0);
  const emiAsPctOfIncome = thisIncome > 0 ? (totalMonthlyEmi / thisIncome) * 100 : 0;

  // ── Goals progress ──
  const goalsData = rawGoals.map(g => ({
    name: g.name,
    target: Number(g.target_amount),
    saved: Number(g.saved_amount),
    pct: g.target_amount > 0 ? Math.min((Number(g.saved_amount) / Number(g.target_amount)) * 100, 100) : 0,
    color: g.color,
    icon: g.icon,
    deadline: g.deadline ?? null,
  }));
  const totalGoalTarget = goalsData.reduce((s, g) => s + g.target, 0);
  const totalGoalSaved  = goalsData.reduce((s, g) => s + g.saved, 0);

  // ── Cash flow breakdown ──
  const investmentSpendThisMonth = thisMonthDebits
    .filter(t => t.category === "Investment")
    .reduce((s, t) => s + Number(t.amount), 0);
  const remaining = Math.max(thisIncome - necessarySpend - unnecessarySpend - totalMonthlyEmi - investmentSpendThisMonth, 0);
  const cashFlowBreakdown = [
    { label: "Necessities",   amount: necessarySpend,              color: "#10D98C" },
    { label: "Discretionary", amount: unnecessarySpend,            color: "#F5A623" },
    { label: "EMIs",          amount: totalMonthlyEmi,             color: "#F472B6" },
    { label: "Investments",   amount: investmentSpendThisMonth,    color: "#7C5CFC" },
    { label: "Remaining",     amount: remaining,                   color: "#38BDF8" },
  ].filter(item => item.amount > 0);

  // ── Credit Card Spends (from transactions 'account' column) ──
  const creditCardSpends = Object.entries(
    thisMonthDebits.reduce((acc: Record<string, number>, t) => {
      // Assuming accounts that aren't "Cash" or generic bank accounts might be credit cards
      // Or we just return all non-cash accounts that have spend
      if (t.account && t.account.toLowerCase() !== "cash") {
        acc[t.account] = (acc[t.account] || 0) + Number(t.amount);
      }
      return acc;
    }, {})
  ).map(([account, spend]) => ({ account, spend }))
  .sort((a, b) => b.spend - a.spend)
  .slice(0, 6); // Top 6 cards

  // ── Financial health score ──
  // 1. Savings rate (25 pts): >= 20% = full, linear below
  const savingsScore = savingsRate !== null
    ? Math.min(25, Math.round((Math.max(savingsRate, 0) / 20) * 25))
    : 0;
  const savingsTip = savingsRate !== null && savingsRate >= 20
    ? "Great savings rate! Keep it up."
    : `Try to save at least 20% of income (currently ${savingsRate !== null ? savingsRate.toFixed(1) : 0}%).`;

  // 2. Budget adherence (20 pts): % of budgets under their limit
  const budgetsUnderLimit = budgetAlerts.filter(b => b.pct < 100).length;
  const budgetAdherenceScore = budgetAlerts.length > 0
    ? Math.round((budgetsUnderLimit / budgetAlerts.length) * 20)
    : 20; // full score if no budgets set
  const budgetTip = budgetAlerts.length === 0
    ? "Set budget limits to track adherence."
    : budgetsUnderLimit === budgetAlerts.length
    ? "All budgets on track — well done!"
    : `${budgetAlerts.length - budgetsUnderLimit} budget(s) exceeded this month.`;

  // 3. Emergency fund (20 pts): >= 3 months = full, linear below
  const emergencyScore = Math.min(20, Math.round((Math.min(emergencyMonths, 3) / 3) * 20));
  const emergencyTip = emergencyMonths >= 3
    ? `Emergency fund covers ${emergencyMonths.toFixed(1)} months — solid!`
    : `Build an emergency fund covering ≥ 3 months of expenses (currently ${emergencyMonths.toFixed(1)} months).`;

  // 4. Necessary vs unnecessary ratio (15 pts): >= 60% necessary = full
  const taggedTotal = necessarySpend + unnecessarySpend;
  const necessaryRatio = taggedTotal > 0 ? (necessarySpend / taggedTotal) * 100 : 60; // default neutral
  const necessaryScore = Math.min(15, Math.round((Math.min(necessaryRatio, 60) / 60) * 15));
  const necessaryTip = necessaryRatio >= 60
    ? "Good balance of necessary vs discretionary spending."
    : `Reduce discretionary spending — currently ${unnecessarySpend > 0 ? ((unnecessarySpend / taggedTotal) * 100).toFixed(0) : 0}% of tagged spend is discretionary.`;

  // 5. EMI-to-income ratio (10 pts): <= 30% = full, linear above
  const emiRatio = emiAsPctOfIncome;
  const emiScore = emiRatio === 0 ? 10 : Math.max(0, Math.round(((30 - Math.min(emiRatio, 30)) / 30) * 10));
  const emiTip = emiRatio <= 30
    ? emiRatio === 0 ? "No active EMIs — financially flexible." : `EMI load at ${emiRatio.toFixed(1)}% of income — healthy.`
    : `EMIs consume ${emiRatio.toFixed(1)}% of income — consider reducing debt.`;

  // 6. Investment allocation (10 pts): >= 10% of income invested = full
  const investmentPct = thisIncome > 0 ? (investmentSpendThisMonth / thisIncome) * 100 : 0;
  const investmentScore = Math.min(10, Math.round((Math.min(investmentPct, 10) / 10) * 10));
  const investmentTip = investmentPct >= 10
    ? `Investing ${investmentPct.toFixed(1)}% of income — great habit!`
    : `Try to invest at least 10% of income (currently ${investmentPct.toFixed(1)}%).`;

  const financialHealthScore = savingsScore + budgetAdherenceScore + emergencyScore + necessaryScore + emiScore + investmentScore;

  const healthBreakdown = [
    { label: "Savings Rate",        score: savingsScore,          maxScore: 25, tip: savingsTip },
    { label: "Budget Adherence",    score: budgetAdherenceScore,  maxScore: 20, tip: budgetTip },
    { label: "Emergency Fund",      score: emergencyScore,        maxScore: 20, tip: emergencyTip },
    { label: "Spend Quality",       score: necessaryScore,        maxScore: 15, tip: necessaryTip },
    { label: "EMI Load",            score: emiScore,              maxScore: 10, tip: emiTip },
    { label: "Investment Habit",    score: investmentScore,       maxScore: 10, tip: investmentTip },
  ];

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
    // Existing insight fields
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
    // New fields
    savingsTrend,
    activeEmiCount,
    totalMonthlyEmi,
    emiAsPctOfIncome,
    goals: goalsData,
    totalGoalTarget,
    totalGoalSaved,
    cashFlowBreakdown,
    topTransactions,
    categoryComparison,
    creditCardSpends,
    financialHealthScore,
    healthBreakdown,
  });
}
