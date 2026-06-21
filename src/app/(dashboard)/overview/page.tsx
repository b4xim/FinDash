"use client";

// ============================================================
// Overview Page — net worth, spend/income, charts, insights,
//                 budget alerts, necessary vs unnecessary
// ============================================================

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import TrendBarChart from "@/components/spending/TrendBarChart";
import CategoryPieChart from "@/components/spending/CategoryPieChart";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, XCircle, HelpCircle,
  Zap, Calendar, Trophy, BarChart3, AlertTriangle, Target, UtensilsCrossed, CreditCard as CardIcon, Loader2
} from "lucide-react";
import { formatINR, pctChange } from "@/lib/utils";
import Link from "next/link";

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

// ── Types ────────────────────────────────────────────────────
interface NecessaryBreakdown { necessary: number; unnecessary: number; untagged: number }
interface BiggestExpense     { description: string; amount: number; category: string }
interface BudgetAlert        { category: string; spent: number; limit: number; pct: number; alertAt: number }

interface StatsResponse {
  thisMonth:           { spend: number; income: number };
  lastMonth:           { spend: number; income: number };
  investmentsTotal:    number;
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
  // Food & Dining
  foodSpendThisMonth:  number;
  avgDailyFoodSpend:   number;
  foodTxnCount:        number;
  foodSpendPct:        number;
}

interface CardGroup {
  account: string;
  last4: string | null;
  thisCycleSpend: number;
  totalSpend: number;
}

// ── Page ─────────────────────────────────────────────────────
export default function OverviewPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [creditCards, setCreditCards] = useState<CardGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then(res => res.json()),
      fetch("/api/credit-cards").then(res => res.json())
    ]).then(([statsData, ccData]) => {
      setStats(statsData);
      setCreditCards(ccData.cards || []);
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

  return (
    <>
      <Header title="Overview" subtitle="Your financial snapshot" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ── Budget alert banner ── */}
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

        {/* ── Top stat tiles ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Net Worth"           value={formatINR(stats.netWorth, true)}         change={null}                                                                                                                   icon={Wallet}       accent="bg-gradient-violet" />
          <StatCard label="This Month's Spend"  value={formatINR(stats.thisMonth.spend, true)}  change={spendChange === 0 ? 0 : -spendChange}                                                                                   icon={TrendingDown}  accent="bg-rose-fin/20" />
          <StatCard label="This Month's Income" value={formatINR(stats.thisMonth.income, true)} change={incomeChange}                                                                                                            icon={TrendingUp}    accent="bg-emerald-fin/20" />
          <StatCard
            label="Investments"
            value={formatINR(stats.investmentsTotal, true)}
            change={stats.investmentsGainLoss === 0 ? 0 : (stats.investmentsGainLoss / Math.max(stats.investmentsTotal - stats.investmentsGainLoss, 1)) * 100}
            changeLabel="overall returns"
            icon={PiggyBank}
            accent="bg-gradient-gold"
          />
        </div>

        {/* ── Credit Card Split-up ── */}
        {creditCards.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-text-primary mb-3 flex items-center gap-2">
              <CardIcon size={16} className="text-emerald-400" /> Credit Cards (This Cycle)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditCards.map(card => (
                <div key={card.account} className="card p-4 flex flex-col h-full border border-emerald-500/10 bg-emerald-500/5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <CardIcon size={18} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="font-display font-medium text-text-primary text-sm leading-snug break-words">
                        {card.account}
                      </p>
                      {card.last4 && <p className="text-text-muted text-xs font-mono mt-1 opacity-70">•••• {card.last4}</p>}
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-emerald-500/10">
                    <p className="font-mono font-semibold text-text-primary text-lg">{formatINR(card.thisCycleSpend)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <p className="font-display font-medium text-text-primary mb-1">Monthly Trend</p>
            <p className="text-text-muted text-sm mb-2">Spending vs Income · last 6 months</p>
            <TrendBarChart data={stats.trendData} />
          </div>
          <div className="card p-6">
            <p className="font-display font-medium text-text-primary mb-1">Top Categories</p>
            <p className="text-text-muted text-sm mb-2">This month</p>
            <CategoryPieChart data={stats.categoryBreakdown} />
          </div>
        </div>

        {/* ── Insight tiles ── */}
        <div>
          <h2 className="font-display font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-400" /> Insights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <InsightTile
              icon={TrendingUp}
              iconClass={stats.savingsRate !== null && stats.savingsRate >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70"}
              label="Savings Rate"
              value={stats.savingsRate !== null ? `${stats.savingsRate.toFixed(1)}%` : "—"}
              sub="of income saved this month"
            />
            <InsightTile
              icon={BarChart3}
              iconClass="bg-violet/70"
              label="Avg Daily Spend"
              value={formatINR(stats.avgDailySpend)}
              sub={`Projected: ${formatINR(stats.projectedMonthSpend)} this month`}
            />
            <InsightTile
              icon={Trophy}
              iconClass="bg-amber-500/70"
              label="Biggest Expense"
              value={stats.biggestExpense ? formatINR(stats.biggestExpense.amount) : "—"}
              sub={stats.biggestExpense ? stats.biggestExpense.description : "No expenses yet"}
            />
            <InsightTile
              icon={Calendar}
              iconClass="bg-cyan-500/70"
              label="Peak Spend Day"
              value={stats.topSpendDay ?? "—"}
              sub="Most spend happens on this day"
            />
          </div>
        </div>

        {/* ── Food & Dining spotlight ── */}
        {(stats.foodSpendThisMonth > 0 || stats.foodTxnCount > 0) && (
          <div className="card p-6">
            <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #f97316 60%, #ef4444)" }}>
                  <UtensilsCrossed size={18} className="text-[#FFFFFF]" />
                </div>
                <div>
                  <p className="font-display font-medium text-text-primary">Food &amp; Dining</p>
                  <p className="text-text-muted text-sm mt-0.5">Your top spend category this month</p>
                </div>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-full font-mono font-medium"
                style={{
                  background: stats.foodSpendPct > 40 ? "rgba(239,68,68,0.12)" : stats.foodSpendPct > 25 ? "rgba(251,191,36,0.12)" : "rgba(16,185,129,0.12)",
                  color:      stats.foodSpendPct > 40 ? "#f43f5e"               : stats.foodSpendPct > 25 ? "#f59e0b"               : "#10b981",
                  border:     `1px solid ${stats.foodSpendPct > 40 ? "rgba(239,68,68,0.25)" : stats.foodSpendPct > 25 ? "rgba(251,191,36,0.25)" : "rgba(16,185,129,0.25)"}`,
                }}
              >
                {stats.foodSpendPct.toFixed(1)}% of spend
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {/* Avg daily food spend */}
              <div className="bg-surface-overlay rounded-xl p-4">
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Avg Daily</p>
                <p className="font-mono font-bold text-2xl mt-1" style={{ color: "#f97316" }}>
                  {formatINR(stats.avgDailyFoodSpend)}
                </p>
                <p className="text-text-muted text-xs mt-1">per day so far this month</p>
              </div>

              {/* Total this month */}
              <div className="bg-surface-overlay rounded-xl p-4">
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">This Month</p>
                <p className="font-mono font-bold text-2xl mt-1 text-text-primary">
                  {formatINR(stats.foodSpendThisMonth)}
                </p>
                <p className="text-text-muted text-xs mt-1">
                  across {stats.foodTxnCount} transaction{stats.foodTxnCount !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Projected end-of-month */}
              <div className="bg-surface-overlay rounded-xl p-4">
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Projected</p>
                <p className="font-mono font-bold text-2xl mt-1 text-text-primary">
                  {formatINR(stats.avgDailyFoodSpend * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())}
                </p>
                <p className="text-text-muted text-xs mt-1">by end of month</p>
              </div>
            </div>

            {/* Share-of-spend bar */}
            <div>
              <div className="flex justify-between text-xs text-text-muted mb-1.5">
                <span>Food &amp; Dining share of total spend</span>
                <span className="font-mono">{stats.foodSpendPct.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(stats.foodSpendPct, 100)}%`,
                    background: stats.foodSpendPct > 40
                      ? "linear-gradient(90deg,#f97316,#ef4444)"
                      : stats.foodSpendPct > 25
                      ? "linear-gradient(90deg,#f97316,#f59e0b)"
                      : "linear-gradient(90deg,#f97316,#10b981)",
                  }}
                />
              </div>
              <p className="text-text-muted text-xs mt-2 text-right">
                {stats.foodSpendPct > 40
                  ? "⚠️ High food share — consider meal prepping to cut costs"
                  : stats.foodSpendPct > 25
                  ? "💡 Moderate — you're spending a notable chunk on food"
                  : "✅ Well-balanced food spend"}
              </p>
            </div>
          </div>
        )}

        {/* ── Budget progress (if limits set) ── */}
        {stats.budgetAlerts && stats.budgetAlerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-text-primary flex items-center gap-2">
                <Target size={16} className="text-violet-light" /> Budget Progress
              </h2>
              <Link href="/budget" className="text-xs text-violet-light hover:underline">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {stats.budgetAlerts.slice(0, 6).map(bl => {
                const clampedPct = Math.min(bl.pct, 100);
                const barColor   = bl.pct >= 100 ? "bg-rose-500" : bl.pct >= bl.alertAt ? "bg-amber-400" : "bg-emerald-400";
                return (
                  <div key={bl.category} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-primary text-sm font-medium">{bl.category}</span>
                      <span className={`text-xs font-mono ${bl.pct >= 100 ? "text-rose-400" : bl.pct >= bl.alertAt ? "text-amber-400" : "text-text-muted"}`}>
                        {bl.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${clampedPct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-text-muted mt-1.5">
                      <span>{formatINR(bl.spent)}</span>
                      <span>{formatINR(bl.limit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Necessary vs Unnecessary ── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-display font-medium text-text-primary">Necessary vs Unnecessary</p>
              <p className="text-text-muted text-sm mt-0.5">This month · based on your Sheets tags</p>
            </div>
            {!hasNecsData && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                Sync Sheets to see data
              </span>
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

        {/* Getting started */}
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
