// ============================================================
// GET /api/stats
// Returns aggregated numbers for the Overview page:
//   - This month's total spend, income, savings
//   - Last month's spend (for % change)
//   - Category breakdown for pie chart
//   - Last 6 months spend + income for bar chart
//   - Total investment value (from holdings table)
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

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

  // ── This month's transactions ──
  const thisMonth = monthRange(0);
  const { data: thisMonthTxns } = await supabase
    .from("transactions")
    .select("amount, type, category, necessary")
    .gte("date", thisMonth.start)
    .lte("date", thisMonth.end);


  // ── Last month's transactions (for % change) ──
  const lastMonth = monthRange(-1);
  const { data: lastMonthTxns } = await supabase
    .from("transactions")
    .select("amount, type")
    .gte("date", lastMonth.start)
    .lte("date", lastMonth.end);

  // ── Last 6 months for trend chart ──
  const trendData = [];
  for (let i = -5; i <= 0; i++) {
    const range = monthRange(i);
    const { data: txns } = await supabase
      .from("transactions")
      .select("amount, type")
      .gte("date", range.start)
      .lte("date", range.end);

    const spend  = txns?.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0) ?? 0;
    const income = txns?.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0) ?? 0;
    trendData.push({ month: range.label, spend, income });
  }

  // ── Holdings total ──
  const { data: holdings } = await supabase
    .from("holdings")
    .select("units, current_price, buy_price");
  const investmentsTotal = holdings?.reduce((s, h) => s + h.units * h.current_price, 0) ?? 0;
  const investmentsInvested = holdings?.reduce((s, h) => s + h.units * h.buy_price, 0) ?? 0;
  const investmentsGainLoss = investmentsTotal - investmentsInvested;

  // ── All-time cash flow (for net worth) ──
  // Net worth = (all-time income − all-time spend) + current investment value
  // This treats "Investment" category transactions as a transfer (money moved
  // into holdings, not lost), so we exclude that category from the cash calc
  // to avoid double-counting it alongside the holdings table.
  const { data: allTxns } = await supabase
    .from("transactions")
    .select("amount, type, category");

  const allTimeIncome = allTxns
    ?.filter(t => t.type === "credit")
    .reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const allTimeSpend = allTxns
    ?.filter(t => t.type === "debit" && t.category !== "Investment")
    .reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  const netWorth = (allTimeIncome - allTimeSpend) + investmentsTotal;

  // ── Aggregate this month ──
  const thisSpend  = thisMonthTxns?.filter(t => t.type === "debit").reduce((s, t)  => s + Number(t.amount), 0) ?? 0;
  const thisIncome = thisMonthTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const lastSpend  = lastMonthTxns?.filter(t => t.type === "debit").reduce((s, t)  => s + Number(t.amount), 0) ?? 0;
  const lastIncome = lastMonthTxns?.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  // ── Category breakdown (this month debits only) ──
  const categoryMap: Record<string, number> = {};
  thisMonthTxns
    ?.filter(t => t.type === "debit")
    .forEach(t => {
      categoryMap[t.category] = (categoryMap[t.category] ?? 0) + Number(t.amount);
    });
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── Necessary vs Unnecessary (this month debits only) ──
  const thisMonthDebits = thisMonthTxns?.filter(t => t.type === "debit") ?? [];
  const necessarySpend = thisMonthDebits
    .filter(t => t.necessary === "Necessary")
    .reduce((s, t) => s + Number(t.amount), 0);
  const unnecessarySpend = thisMonthDebits
    .filter(t => t.necessary === "Unnecessary")
    .reduce((s, t) => s + Number(t.amount), 0);
  // Transactions without a necessary label (manual/gmail)
  const untaggedSpend = thisMonthDebits
    .filter(t => !t.necessary)
    .reduce((s, t) => s + Number(t.amount), 0);

  return NextResponse.json({
    thisMonth: { spend: thisSpend, income: thisIncome },
    lastMonth: { spend: lastSpend, income: lastIncome },
    investmentsTotal,
    investmentsGainLoss,
    netWorth,
    categoryBreakdown,
    trendData,
    necessaryBreakdown: { necessary: necessarySpend, unnecessary: unnecessarySpend, untagged: untaggedSpend },
  });
}
