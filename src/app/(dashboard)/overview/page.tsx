"use client";

// ============================================================
// Overview Page — net worth, spend/income, charts, insights,
//                 budget alerts, necessary vs unnecessary,
//                 + health score, savings sparkline, EMI,
//                 goals, cash flow, top transactions, MoM diff
// ============================================================

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import TrendBarChart from "@/components/spending/TrendBarChart";
import CategoryPieChart from "@/components/spending/CategoryPieChart";
import CreditCardQuickView from "@/components/credit-cards/CreditCardQuickView";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, XCircle, HelpCircle,
  Zap, Calendar, Trophy, BarChart3, AlertTriangle, Target, UtensilsCrossed,
  CreditCard as CardIcon, Loader2, Heart, Banknote, ChevronDown, ChevronUp,
  Receipt, TrendingDown as TrendDown, Landmark, Flag, Star,
  HandCoins, ArrowDownLeft, Scale,
} from "lucide-react";
import { formatINR, pctChange, CATEGORY_COLORS } from "@/lib/utils";
import Link from "next/link";
import { LendingEntry } from "@/types";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip,
  XAxis, YAxis,
} from "recharts";

// ── Shared StatCard ──────────────────────────────────────────
function StatCard({
  label, value, change, icon: Icon, accent, changeLabel = "vs last month", sub,
}: {
  label: string; value: string; change?: number | null;
  icon: React.ElementType; accent: string; changeLabel?: string; sub?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="card p-6 flex flex-col justify-between h-full gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          {sub && <p className="text-text-muted text-xs mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={20} className="text-[#FFFFFF]" />
        </div>
      </div>
      <div className="flex items-center gap-1 min-h-[20px] mt-auto">
        {change !== null && change !== undefined && (
          <>
            {change === 0 ? <Minus size={14} className="text-text-muted" />
              : positive ? <ArrowUpRight size={14} className="text-emerald-fin" />
              : <ArrowDownRight size={14} className="text-rose-fin" />}
            <span className={`text-xs font-mono ${change === 0 ? "text-text-muted" : positive ? "text-emerald-fin" : "text-rose-fin"}`}>
              {change === 0 ? "No change" : `${Math.abs(change).toFixed(1)}%`}
            </span>
            <span className="text-text-muted text-xs">{changeLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Insight mini-tile ────────────────────────────────────────
function InsightTile({ icon: Icon, iconClass, label, value, sub }: {
  icon: React.ElementType; iconClass: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon size={17} className="text-[#FFFFFF]" />
      </div>
      <div className="min-w-0">
        <p className="text-text-muted text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="font-mono font-semibold text-text-primary text-lg mt-0.5 truncate">{value}</p>
        {sub && <p className="text-text-muted text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Savings sparkline tooltip ──────────────────────────────
function SavingsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-surface-overlay border border-white/10 rounded-xl px-3 py-2 text-xs shadow-card">
      <p className="text-text-muted mb-1">{label}</p>
      <p className={`font-mono font-semibold ${val >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
        {val >= 0 ? "+" : ""}{formatINR(val)}
      </p>
    </div>
  );
}

// ── Financial health gauge (SVG ring) ─────────────────────
function HealthGauge({ score }: { score: number }) {
  const size = 140;
  const strokeW = 12;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#10D98C" : score >= 50 ? "#F59E0B" : "#F43F5E";
  const label = score >= 75 ? "Excellent" : score >= 50 ? "Good" : "Needs Work";

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeW} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeW}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono font-bold text-3xl text-text-primary leading-none">{score}</p>
        <p className="text-xs font-medium mt-1" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

// ── Goal progress ring (small SVG) ──────────────────────────
function GoalRing({ pct, color }: { pct: number; color: string }) {
  const size = 56;
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90 flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

// ── Types ────────────────────────────────────────────────────
interface NecessaryBreakdown { necessary: number; unnecessary: number; untagged: number }
interface BiggestExpense     { description: string; amount: number; category: string }
interface BudgetAlert        { category: string; spent: number; limit: number; pct: number; alertAt: number }
interface GoalItem           { name: string; target: number; saved: number; pct: number; color: string; icon: string; deadline: string | null }
interface CashFlowItem       { label: string; amount: number; color: string }
interface TopTxn             { description: string; amount: number; category: string; date: string }
interface CategoryDiff       { category: string; thisMonth: number; lastMonth: number; change: number; changePct: number }
interface HealthItem         { label: string; score: number; maxScore: number; tip: string }

interface StatsResponse {
  thisMonth:           { spend: number; income: number };
  lastMonth:           { spend: number; income: number };
  investmentsTotal:    number;
  investmentsInvested: number;
  investmentsGainLoss: number;
  netWorth:            number;
  netCash:             number;
  categoryBreakdown:   { name: string; value: number }[];
  trendData:           { month: string; spend: number; income: number }[];
  necessaryBreakdown:  NecessaryBreakdown;
  savingsRate:         number | null;
  avgDailySpend:       number;
  projectedMonthSpend: number;
  biggestExpense:      BiggestExpense | null;
  topSpendDay:         string | null;
  emergencyMonths:     number;
  budgetAlerts:        BudgetAlert[];
  foodSpendThisMonth:  number;
  avgDailyFoodSpend:   number;
  foodTxnCount:        number;
  foodSpendPct:        number;
  // New fields
  savingsTrend:        { month: string; savings: number }[];
  activeEmiCount:      number;
  totalMonthlyEmi:     number;
  emiAsPctOfIncome:    number;
  goals:               GoalItem[];
  totalGoalTarget:     number;
  totalGoalSaved:      number;
  cashFlowBreakdown:   CashFlowItem[];
  topTransactions:     TopTxn[];
  categoryComparison:  CategoryDiff[];
  creditCardSpends:    { account: string; spend: number }[];
  financialHealthScore: number;
  healthBreakdown:     HealthItem[];
}

// ── Page ─────────────────────────────────────────────────────
export default function OverviewPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [lendings, setLendings] = useState<LendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthExpanded, setHealthExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then(res => res.json()),
      fetch("/api/lendings").then(res => res.json()).catch(() => []),
    ]).then(([statsData, lendingData]) => {
      setStats(statsData);
      setLendings(Array.isArray(lendingData) ? lendingData : []);
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
    return (
      <>
        <Header title="Overview" subtitle="Your financial snapshot" />
        <main className="flex-1 p-6">
          <div className="card p-12 flex flex-col items-center justify-center text-center text-text-muted">
            <Loader2 size={32} className="animate-spin text-violet-light mb-4" />
            <p className="text-text-secondary font-medium">Loading your data...</p>
          </div>
        </main>
      </>
    );
  }

  const hasAnyData   = stats.trendData.some(d => d.spend > 0 || d.income > 0) || stats.investmentsTotal > 0;
  const spendChange  = pctChange(stats.thisMonth.spend, stats.lastMonth.spend);
  const incomeChange = pctChange(stats.thisMonth.income, stats.lastMonth.income);

  // Necessary vs Unnecessary
  const nb             = stats.necessaryBreakdown ?? { necessary: 0, unnecessary: 0, untagged: 0 };
  const taggedTotal    = nb.necessary + nb.unnecessary;
  const hasNecsData    = taggedTotal > 0;
  const necessaryPct   = hasNecsData ? (nb.necessary   / taggedTotal) * 100 : 0;
  const unnecessaryPct = hasNecsData ? (nb.unnecessary / taggedTotal) * 100 : 0;

  // Budget alerts (only show those at/above threshold)
  const activeAlerts = (stats.budgetAlerts ?? []).filter(a => a.pct >= a.alertAt);

  // Health score color
  const healthColor = stats.financialHealthScore >= 75 ? "#10D98C" : stats.financialHealthScore >= 50 ? "#F59E0B" : "#F43F5E";

  // Savings this month
  const savedThisMonth = stats.thisMonth.income - stats.thisMonth.spend;

  // Cash flow total for % calc
  const cfTotal = stats.cashFlowBreakdown.reduce((s, c) => s + c.amount, 0);

  // Lending overview stats
  const pendingLendings = lendings.filter(e => e.status !== "settled");
  const lentOut         = pendingLendings.filter(e => e.direction === "lent").reduce((s, e) => s + (Number(e.amount) - Number(e.settled_amount)), 0);
  const borrowedIn      = pendingLendings.filter(e => e.direction === "borrowed").reduce((s, e) => s + (Number(e.amount) - Number(e.settled_amount)), 0);
  const lendingNet      = lentOut - borrowedIn;
  const lendingOverdue  = pendingLendings.filter(e => e.due_date && new Date(e.due_date) < new Date()).length;

  return (
    <>
      <Header title="Overview" subtitle="Your financial snapshot" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ══ 🔴 ALERTS ══ */}
        {activeAlerts.length > 0 && (
          <div className="card p-4 border border-amber-400/20 bg-amber-400/5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-text-primary text-sm font-medium">Budget alerts this month</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {activeAlerts.map(a => (
                  <span key={a.category} className="text-xs px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    {a.category}: {a.pct.toFixed(0)}% of {formatINR(a.limit)}
                  </span>
                ))}
              </div>
            </div>
            <Link href="/budget" className="text-xs text-violet-light hover:underline whitespace-nowrap">Manage →</Link>
          </div>
        )}

        {/* ══ 📊 SECTION 1: SNAPSHOT ══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Net Worth"           value={formatINR(stats.netWorth, true)}         change={null} icon={Wallet} accent="bg-gradient-violet" />
          <StatCard label="This Month's Spend"  value={formatINR(stats.thisMonth.spend, true)}  change={spendChange === 0 ? 0 : -spendChange} icon={TrendingDown} accent="bg-rose-fin/20" />
          <StatCard label="This Month's Income" value={formatINR(stats.thisMonth.income, true)} change={incomeChange} icon={TrendingUp} accent="bg-emerald-fin/20" />
          <StatCard
            label="Investments"
            value={formatINR(stats.investmentsTotal, true)}
            change={stats.investmentsGainLoss === 0 ? 0 : (stats.investmentsGainLoss / Math.max(stats.investmentsTotal - stats.investmentsGainLoss, 1)) * 100}
            changeLabel="overall returns"
            icon={PiggyBank}
            accent="bg-gradient-gold"
          />
        </div>

        {/* ══ 📈 SECTION 2: TRENDS & FLOW ══ */}

        {/* Charts — trend bar (2/3) + pie (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6 flex flex-col">
            <p className="font-display font-medium text-text-primary mb-1">Monthly Trend</p>
            <p className="text-text-muted text-sm mb-4">Spending vs Income · last 6 months</p>
            <div className="flex-1 min-h-[220px]">
              <TrendBarChart data={stats.trendData} />
            </div>
          </div>
          <div className="card p-6">
            <p className="font-display font-medium text-text-primary mb-1">Top Categories</p>
            <p className="text-text-muted text-sm mb-2">This month</p>
            <CategoryPieChart data={stats.categoryBreakdown} />
          </div>
        </div>

        {/* Cash Flow Breakdown */}
        {stats.thisMonth.income > 0 && stats.cashFlowBreakdown.length > 0 && (
          <div className="card p-6">
            <div className="flex items-start justify-between mb-5 gap-2 flex-wrap">
              <div>
                <p className="font-display font-semibold text-text-primary flex items-center gap-2">
                  <Banknote size={16} className="text-cyan-400" /> Cash Flow Breakdown
                </p>
                <p className="text-text-muted text-sm mt-0.5">Where your income goes this month</p>
              </div>
              <span className="text-xs font-mono text-text-muted bg-white/5 px-3 py-1 rounded-full">
                Income: {formatINR(stats.thisMonth.income)}
              </span>
            </div>
            <div className="h-8 rounded-xl overflow-hidden flex mb-4 gap-0.5">
              {stats.cashFlowBreakdown.map(item => (
                <div
                  key={item.label}
                  className="h-full transition-all duration-700 first:rounded-l-xl last:rounded-r-xl"
                  style={{
                    width: `${cfTotal > 0 ? (item.amount / Math.max(cfTotal, stats.thisMonth.income)) * 100 : 0}%`,
                    background: item.color,
                    opacity: 0.85,
                  }}
                  title={`${item.label}: ${formatINR(item.amount)}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {stats.cashFlowBreakdown.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <div className="min-w-0">
                    <p className="text-text-muted text-xs truncate">{item.label}</p>
                    <p className="font-mono text-text-primary text-xs font-medium">{formatINR(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        <div>
          <h2 className="font-display font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-400" /> Insights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Savings sparkline */}
            <div className="card p-5 flex flex-col gap-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Savings Trend</p>
                  <p className={`font-mono font-semibold text-xl mt-0.5 ${savedThisMonth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {savedThisMonth >= 0 ? "+" : ""}{formatINR(savedThisMonth)}
                  </p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {stats.savingsRate !== null ? `Savings rate: ${stats.savingsRate.toFixed(1)}%` : "No income recorded this month"}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${savedThisMonth >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70"}`}>
                  <TrendingUp size={17} className="text-[#FFFFFF]" />
                </div>
              </div>
              {stats.savingsTrend.length > 0 && (
                <div className="h-20 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.savingsTrend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10D98C" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10D98C" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" hide />
                      <YAxis hide />
                      <RechartsTooltip content={<SavingsTooltip />} />
                      <Area type="monotone" dataKey="savings" stroke="#10D98C" strokeWidth={2} fill="url(#savingsGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <InsightTile icon={BarChart3} iconClass="bg-violet/70" label="Avg Daily Spend" value={formatINR(stats.avgDailySpend)} sub={`Projected: ${formatINR(stats.projectedMonthSpend)} this month`} />
            <InsightTile icon={Trophy}   iconClass="bg-amber-500/70" label="Biggest Expense" value={stats.biggestExpense ? formatINR(stats.biggestExpense.amount) : "—"} sub={stats.biggestExpense ? stats.biggestExpense.description : "No expenses yet"} />
            <InsightTile icon={Calendar} iconClass="bg-cyan-500/70" label="Peak Spend Day"  value={stats.topSpendDay ?? "—"} sub="Most spend happens on this day" />
            <InsightTile icon={Landmark} iconClass="bg-indigo-500/70" label="Emergency Fund" value={`${stats.emergencyMonths.toFixed(1)} mo`} sub={stats.emergencyMonths >= 3 ? "Healthy buffer ✓" : "Aim for 3+ months"} />
          </div>
        </div>

        {/* ══ 💳 SECTION 3: OBLIGATIONS & COMMITMENTS ══ */}
        {(stats.activeEmiCount > 0 || pendingLendings.length > 0) && (
          <div>
            <h2 className="font-display font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Scale size={16} className="text-pink-400" /> Obligations &amp; Lending
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* EMI */}
              {stats.activeEmiCount > 0 && (
                <div className="card p-6 flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-semibold text-text-primary flex items-center gap-2">
                        <CardIcon size={16} className="text-pink-400" /> EMI Obligations
                      </p>
                      <p className="text-text-muted text-sm mt-0.5">Fixed monthly outflows</p>
                    </div>
                    <Link href="/emi" className="text-xs text-violet-light hover:underline">Manage →</Link>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface-overlay rounded-xl p-3">
                      <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Active</p>
                      <p className="font-mono font-bold text-2xl mt-1 text-text-primary">{stats.activeEmiCount}</p>
                      <p className="text-text-muted text-xs mt-0.5">loans</p>
                    </div>
                    <div className="bg-surface-overlay rounded-xl p-3">
                      <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Monthly</p>
                      <p className="font-mono font-bold text-xl mt-1 text-text-primary">{formatINR(stats.totalMonthlyEmi)}</p>
                      <p className="text-text-muted text-xs mt-0.5">outflow</p>
                    </div>
                    <div className="bg-surface-overlay rounded-xl p-3">
                      <p className="text-text-muted text-xs font-medium uppercase tracking-wider">% Income</p>
                      <p className={`font-mono font-bold text-xl mt-1 ${stats.emiAsPctOfIncome > 30 ? "text-rose-400" : stats.emiAsPctOfIncome > 20 ? "text-amber-400" : "text-emerald-400"}`}>
                        {stats.emiAsPctOfIncome.toFixed(1)}%
                      </p>
                      <p className="text-text-muted text-xs mt-0.5">{stats.emiAsPctOfIncome <= 30 ? "healthy" : "high"}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-text-muted mb-1.5">
                      <span>EMI as % of monthly income</span>
                      <span className="font-mono">{stats.emiAsPctOfIncome.toFixed(1)}% / 30%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(stats.emiAsPctOfIncome, 100)}%`,
                          background: stats.emiAsPctOfIncome > 30 ? "linear-gradient(90deg,#f43f5e,#ef4444)" : "linear-gradient(90deg,#7C5CFC,#F472B6)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Lending */}
              {pendingLendings.length > 0 && (
                <div className="card p-6 flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-semibold text-text-primary flex items-center gap-2">
                        <HandCoins size={16} className="text-violet-light" /> Lending Overview
                      </p>
                      <p className="text-text-muted text-sm mt-0.5">Unsettled balances</p>
                    </div>
                    <Link href="/lending" className="text-xs text-violet-light hover:underline">View all →</Link>
                  </div>

                  {/* Two summary tiles */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-overlay rounded-xl p-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <ArrowUpRight size={14} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-text-muted text-xs font-medium uppercase tracking-wider">You&apos;re Owed</p>
                        <p className="font-mono font-semibold text-emerald-400 text-base mt-0.5">{formatINR(lentOut)}</p>
                      </div>
                    </div>
                    <div className="bg-surface-overlay rounded-xl p-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-400/10 flex items-center justify-center flex-shrink-0">
                        <ArrowDownLeft size={14} className="text-rose-400" />
                      </div>
                      <div>
                        <p className="text-text-muted text-xs font-medium uppercase tracking-wider">You Owe</p>
                        <p className="font-mono font-semibold text-rose-400 text-base mt-0.5">{formatINR(borrowedIn)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Per-person breakdown */}
                  <div className="space-y-1.5">
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-2">By Person</p>
                    {pendingLendings.map(e => {
                      const outstanding = Number(e.amount) - Number(e.settled_amount);
                      const isLent = e.direction === "lent";
                      return (
                        <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLent ? "bg-emerald-400" : "bg-rose-400"}`} />
                            <span className="text-text-primary text-sm font-medium truncate">{e.person}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 ${isLent ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>
                              {isLent ? "owes you" : "you owe"}
                            </span>
                          </div>
                          <span className={`font-mono text-sm font-semibold flex-shrink-0 ml-2 ${isLent ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatINR(outstanding)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ══ 💳 CREDIT CARDS QUICK VIEW ══ */}
        <CreditCardQuickView />

        {/* ── Credit Card Spends This Month ── */}
        {stats.creditCardSpends && stats.creditCardSpends.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-text-primary mb-3 flex items-center gap-2">
              <CardIcon size={16} className="text-emerald-400" /> Credit Card Spends (This Month)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.creditCardSpends.map(card => (
                <div key={card.account} className="card p-4 flex flex-col justify-between border border-emerald-500/10 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                  <div className="mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-2">
                      <CardIcon size={14} className="text-emerald-400" />
                    </div>
                    <p className="font-display font-medium text-text-primary text-xs leading-snug line-clamp-2" title={card.account}>
                      {card.account}
                    </p>
                  </div>
                  <p className="font-mono font-semibold text-text-primary">{formatINR(card.spend)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ 🎯 SECTION 4: GOALS & BUDGETS ══ */}
        {(stats.goals.length > 0 || (stats.budgetAlerts && stats.budgetAlerts.length > 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Goals */}
            {stats.goals.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="font-display font-semibold text-text-primary flex items-center gap-2">
                      <Flag size={16} className="text-violet-light" /> Goals Progress
                    </p>
                    <p className="text-text-muted text-sm mt-0.5">Active financial goals</p>
                  </div>
                  <Link href="/goals" className="text-xs text-violet-light hover:underline">View all →</Link>
                </div>
                {stats.totalGoalTarget > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-text-muted mb-1.5">
                      <span>Overall: {formatINR(stats.totalGoalSaved)} of {formatINR(stats.totalGoalTarget)}</span>
                      <span className="font-mono">{((stats.totalGoalSaved / stats.totalGoalTarget) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 bg-gradient-violet" style={{ width: `${Math.min((stats.totalGoalSaved / stats.totalGoalTarget) * 100, 100)}%` }} />
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {stats.goals.slice(0, 4).map(goal => (
                    <div key={goal.name} className="flex items-center gap-3 bg-surface-overlay rounded-xl p-3">
                      <div className="relative flex-shrink-0">
                        <GoalRing pct={goal.pct} color={goal.color} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-mono font-bold text-text-primary">{goal.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-sm font-medium truncate">{goal.name}</p>
                        <p className="text-text-muted text-xs">{formatINR(goal.saved)} of {formatINR(goal.target)}</p>
                      </div>
                      {goal.deadline && (
                        <p className="text-text-muted text-xs flex-shrink-0">
                          {new Date(goal.deadline).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Budget Progress */}
            {stats.budgetAlerts && stats.budgetAlerts.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="font-display font-semibold text-text-primary flex items-center gap-2">
                      <Target size={16} className="text-violet-light" /> Budget Progress
                    </p>
                    <p className="text-text-muted text-sm mt-0.5">Monthly category limits</p>
                  </div>
                  <Link href="/budget" className="text-xs text-violet-light hover:underline">View all →</Link>
                </div>
                <div className="space-y-3">
                  {stats.budgetAlerts.slice(0, 6).map(bl => {
                    const clampedPct = Math.min(bl.pct, 100);
                    const barColor   = bl.pct >= 100 ? "bg-rose-500" : bl.pct >= bl.alertAt ? "bg-amber-400" : "bg-emerald-400";
                    return (
                      <div key={bl.category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-text-primary text-sm">{bl.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted text-xs font-mono">{formatINR(bl.spent)} / {formatINR(bl.limit)}</span>
                            <span className={`text-xs font-mono ${bl.pct >= 100 ? "text-rose-400" : bl.pct >= bl.alertAt ? "text-amber-400" : "text-text-muted"}`}>{bl.pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${clampedPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ══ 📋 SECTION 5: DEEP DIVES ══ */}

        {/* Top expenses + Category changes — side by side */}
        {(stats.topTransactions.length > 0 || stats.categoryComparison.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {stats.topTransactions.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-text-primary flex items-center gap-2">
                    <Receipt size={16} className="text-violet-light" /> Top Expenses This Month
                  </h2>
                  <Link href="/spending" className="text-xs text-violet-light hover:underline">View all →</Link>
                </div>
                <div className="space-y-2">
                  {stats.topTransactions.map((txn, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-overlay hover:bg-white/5 transition-colors">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[txn.category] ?? "#4A5270" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-sm font-medium truncate">{txn.description}</p>
                        <p className="text-text-muted text-xs">{txn.category} · {new Date(txn.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </div>
                      <p className="font-mono font-semibold text-text-primary text-sm flex-shrink-0">{formatINR(txn.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.categoryComparison.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-text-primary flex items-center gap-2">
                    <BarChart3 size={16} className="text-amber-400" /> Category Changes vs Last Month
                  </h2>
                </div>
                <div className="space-y-2">
                  {stats.categoryComparison.slice(0, 5).map(c => {
                    const isIncrease = c.change > 0;
                    return (
                      <div key={c.category} className="flex items-center gap-3 p-3 rounded-xl bg-surface-overlay">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[c.category] ?? "#4A5270" }} />
                          <span className="text-text-primary text-sm font-medium truncate">{c.category}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono text-sm text-text-primary">{formatINR(c.thisMonth)}</p>
                          <p className="text-text-muted text-xs">{formatINR(c.lastMonth)}</p>
                        </div>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0 ${
                          isIncrease ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                        }`}>
                          {isIncrease ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {Math.abs(c.changePct).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Financial Health + Food & Dining — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Financial Health Score */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-display font-semibold text-text-primary flex items-center gap-2">
                  <Heart size={16} className="text-rose-400" /> Financial Health Score
                </p>
                <p className="text-text-muted text-sm mt-0.5">Based on 6 key financial indicators</p>
              </div>
              <button onClick={() => setHealthExpanded(v => !v)} className="text-xs text-violet-light hover:underline flex items-center gap-1">
                {healthExpanded ? "Less" : "Details"}
                {healthExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <HealthGauge score={stats.financialHealthScore} />
              <div className="flex-1 w-full space-y-3">
                {stats.healthBreakdown.map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-text-secondary text-xs font-medium">{item.label}</span>
                      <span className="text-xs font-mono" style={{ color: item.score >= item.maxScore * 0.7 ? "#10D98C" : item.score >= item.maxScore * 0.4 ? "#F59E0B" : "#F43F5E" }}>
                        {item.score}/{item.maxScore}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(item.score / item.maxScore) * 100}%`,
                          background: item.score >= item.maxScore * 0.7 ? "#10D98C" : item.score >= item.maxScore * 0.4 ? "#F59E0B" : "#F43F5E",
                        }}
                      />
                    </div>
                    {healthExpanded && <p className="text-text-muted text-xs mt-1">{item.tip}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Food & Dining Spotlight */}
          {(stats.foodSpendThisMonth > 0 || stats.foodTxnCount > 0) ? (
            <div className="card p-6">
              <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316 60%, #ef4444)" }}>
                    <UtensilsCrossed size={18} className="text-[#FFFFFF]" />
                  </div>
                  <div>
                    <p className="font-display font-medium text-text-primary">Food &amp; Dining</p>
                    <p className="text-text-muted text-sm mt-0.5">Spotlight this month</p>
                  </div>
                </div>
                <span className="text-xs px-3 py-1.5 rounded-full font-mono font-medium" style={{
                  background: stats.foodSpendPct > 40 ? "rgba(239,68,68,0.12)" : stats.foodSpendPct > 25 ? "rgba(251,191,36,0.12)" : "rgba(16,185,129,0.12)",
                  color:      stats.foodSpendPct > 40 ? "#f43f5e" : stats.foodSpendPct > 25 ? "#f59e0b" : "#10b981",
                  border:     `1px solid ${stats.foodSpendPct > 40 ? "rgba(239,68,68,0.25)" : stats.foodSpendPct > 25 ? "rgba(251,191,36,0.25)" : "rgba(16,185,129,0.25)"}`,
                }}>{stats.foodSpendPct.toFixed(1)}% of spend</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface-overlay rounded-xl p-3">
                  <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Avg Daily</p>
                  <p className="font-mono font-bold text-xl mt-1" style={{ color: "#f97316" }}>{formatINR(stats.avgDailyFoodSpend)}</p>
                </div>
                <div className="bg-surface-overlay rounded-xl p-3">
                  <p className="text-text-muted text-xs font-medium uppercase tracking-wider">This Month</p>
                  <p className="font-mono font-bold text-xl mt-1 text-text-primary">{formatINR(stats.foodSpendThisMonth)}</p>
                  <p className="text-text-muted text-xs">{stats.foodTxnCount} txns</p>
                </div>
                <div className="bg-surface-overlay rounded-xl p-3">
                  <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Projected</p>
                  <p className="font-mono font-bold text-xl mt-1 text-text-primary">{formatINR(stats.avgDailyFoodSpend * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())}</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1.5">
                  <span>Food share of total spend</span>
                  <span className="font-mono">{stats.foodSpendPct.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${Math.min(stats.foodSpendPct, 100)}%`,
                    background: stats.foodSpendPct > 40 ? "linear-gradient(90deg,#f97316,#ef4444)" : stats.foodSpendPct > 25 ? "linear-gradient(90deg,#f97316,#f59e0b)" : "linear-gradient(90deg,#f97316,#10b981)",
                  }} />
                </div>
                <p className="text-text-muted text-xs mt-2 text-right">
                  {stats.foodSpendPct > 40 ? "⚠️ High food share — consider meal prepping" : stats.foodSpendPct > 25 ? "💡 Moderate food spend" : "✅ Well-balanced food spend"}
                </p>
              </div>
            </div>
          ) : (
            <div className="card p-6 flex items-center justify-center text-text-muted">
              <p className="text-sm">No food spend recorded this month.</p>
            </div>
          )}

        </div>

        {/* Necessary vs Unnecessary */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-display font-medium text-text-primary">Necessary vs Unnecessary</p>
              <p className="text-text-muted text-sm mt-0.5">This month · based on your Sheets tags</p>
            </div>
            {!hasNecsData && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">Sync Sheets to see data</span>
            )}
          </div>
          {hasNecsData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="bg-surface-overlay rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={16} className="text-emerald-400" /></div>
                  <div>
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Necessary</p>
                    <p className="font-mono font-semibold text-emerald-400 text-lg mt-0.5">{formatINR(nb.necessary)}</p>
                    <p className="text-text-muted text-xs mt-0.5">{necessaryPct.toFixed(0)}% of tagged</p>
                  </div>
                </div>
                <div className="bg-surface-overlay rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0"><XCircle size={16} className="text-rose-400" /></div>
                  <div>
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Unnecessary</p>
                    <p className="font-mono font-semibold text-rose-400 text-lg mt-0.5">{formatINR(nb.unnecessary)}</p>
                    <p className="text-text-muted text-xs mt-0.5">{unnecessaryPct.toFixed(0)}% of tagged</p>
                  </div>
                </div>
                <div className="bg-surface-overlay rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"><HelpCircle size={16} className="text-text-muted" /></div>
                  <div>
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Untagged</p>
                    <p className="font-mono font-semibold text-text-secondary text-lg mt-0.5">{formatINR(nb.untagged)}</p>
                    <p className="text-text-muted text-xs mt-0.5">manual / gmail</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Necessary {necessaryPct.toFixed(0)}%</span>
                  <span className="flex items-center gap-1.5">Unnecessary {unnecessaryPct.toFixed(0)}%<span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /></span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-400 transition-all duration-700 rounded-l-full" style={{ width: `${necessaryPct}%` }} />
                  <div className="h-full bg-rose-400  transition-all duration-700"               style={{ width: `${unnecessaryPct}%` }} />
                  <div className="h-full bg-white/5 flex-1 rounded-r-full" />
                </div>
                <p className="text-text-muted text-xs text-right">Tagged: {formatINR(taggedTotal)} · Total spend: {formatINR(stats.thisMonth.spend)}</p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={22} className="text-text-muted" /></div>
              <p className="text-text-secondary text-sm font-medium">No tagged transactions yet</p>
              <p className="text-text-muted text-xs mt-1 max-w-xs mx-auto">
                Sync your Expenses sheet — <Link href="/sync" className="text-violet-light hover:underline">go to Sync</Link>.
              </p>
            </div>
          )}
        </div>

        {/* ══ 🆕 ONBOARDING ══ */}
        {!hasAnyData && (
          <div className="card p-6 border-violet/20 bg-violet/5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gradient-violet rounded-xl flex items-center justify-center flex-shrink-0"><TrendingUp size={20} className="text-[#FFFFFF]" /></div>
              <div>
                <p className="font-display font-semibold text-text-primary">Getting started</p>
                <p className="text-text-secondary text-sm mt-1 max-w-xl">
                  Head to <Link href="/spending" className="text-violet-light font-medium hover:underline">Spending</Link> to add your first transactions,
                  <Link href="/budget" className="text-violet-light font-medium hover:underline ml-1">Budget</Link> to set category limits, or
                  <Link href="/goals" className="text-violet-light font-medium hover:underline ml-1">Goals</Link> to track your savings.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}

