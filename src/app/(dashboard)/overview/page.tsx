"use client";

// ============================================================
// Overview Page — live net worth, spend/income stats, charts
// Fetches aggregated data from /api/stats
// ============================================================

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import TrendBarChart from "@/components/spending/TrendBarChart";
import CategoryPieChart from "@/components/spending/CategoryPieChart";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, XCircle, HelpCircle,
} from "lucide-react";
import { formatINR, pctChange } from "@/lib/utils";
import Link from "next/link";

// ── Shared StatCard ──────────────────────────────────────────
function StatCard({
  label, value, change, icon: Icon, accent, changeLabel = "vs last month",
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: React.ElementType;
  accent: string;
  changeLabel?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {change !== null && change !== undefined && (
        <div className="flex items-center gap-1">
          {change === 0 ? (
            <Minus size={14} className="text-text-muted" />
          ) : positive ? (
            <ArrowUpRight size={14} className="text-emerald-fin" />
          ) : (
            <ArrowDownRight size={14} className="text-rose-fin" />
          )}
          <span className={`text-xs font-mono ${change === 0 ? "text-text-muted" : positive ? "text-emerald-fin" : "text-rose-fin"}`}>
            {change === 0 ? "No change" : `${Math.abs(change).toFixed(1)}%`}
          </span>
          <span className="text-text-muted text-xs">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────
interface NecessaryBreakdown {
  necessary: number;
  unnecessary: number;
  untagged: number;
}

interface StatsResponse {
  thisMonth: { spend: number; income: number };
  lastMonth: { spend: number; income: number };
  investmentsTotal: number;
  investmentsGainLoss: number;
  netWorth: number;
  categoryBreakdown: { name: string; value: number }[];
  trendData: { month: string; spend: number; income: number }[];
  necessaryBreakdown: NecessaryBreakdown;
}

// ── Page ─────────────────────────────────────────────────────
export default function OverviewPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false); });
  }, []);

  if (loading || !stats) {
    return (
      <>
        <Header title="Overview" subtitle="Your financial snapshot" />
        <main className="flex-1 p-6">
          <div className="card p-12 text-center text-text-muted">Loading your data...</div>
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

  return (
    <>
      <Header title="Overview" subtitle="Your financial snapshot" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ── Top stat tiles ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Net Worth"            value={formatINR(stats.netWorth, true)}           change={null}                                                                                                                  icon={Wallet}      accent="bg-gradient-violet" />
          <StatCard label="This Month's Spend"   value={formatINR(stats.thisMonth.spend, true)}    change={spendChange === 0 ? 0 : -spendChange}                                                                                  icon={TrendingDown} accent="bg-rose-fin/20" />
          <StatCard label="This Month's Income"  value={formatINR(stats.thisMonth.income, true)}   change={incomeChange}                                                                                                           icon={TrendingUp}   accent="bg-emerald-fin/20" />
          <StatCard label="Investments"          value={formatINR(stats.investmentsTotal, true)}   change={stats.investmentsGainLoss === 0 ? 0 : (stats.investmentsGainLoss / Math.max(stats.investmentsTotal - stats.investmentsGainLoss, 1)) * 100} changeLabel="overall returns" icon={PiggyBank} accent="bg-gradient-gold" />
        </div>

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
              {/* Three mini-tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="bg-surface-overlay rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Necessary</p>
                    <p className="font-mono font-semibold text-emerald-400 text-lg mt-0.5">{formatINR(nb.necessary)}</p>
                    <p className="text-text-muted text-xs mt-0.5">{necessaryPct.toFixed(0)}% of tagged spend</p>
                  </div>
                </div>

                <div className="bg-surface-overlay rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                    <XCircle size={16} className="text-rose-400" />
                  </div>
                  <div>
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Unnecessary</p>
                    <p className="font-mono font-semibold text-rose-400 text-lg mt-0.5">{formatINR(nb.unnecessary)}</p>
                    <p className="text-text-muted text-xs mt-0.5">{unnecessaryPct.toFixed(0)}% of tagged spend</p>
                  </div>
                </div>

                <div className="bg-surface-overlay rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <HelpCircle size={16} className="text-text-muted" />
                  </div>
                  <div>
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Untagged</p>
                    <p className="font-mono font-semibold text-text-secondary text-lg mt-0.5">{formatINR(nb.untagged)}</p>
                    <p className="text-text-muted text-xs mt-0.5">manual / gmail entries</p>
                  </div>
                </div>
              </div>

              {/* Segmented bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Necessary {necessaryPct.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    Unnecessary {unnecessaryPct.toFixed(0)}%
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-400 transition-all duration-700 rounded-l-full" style={{ width: `${necessaryPct}%` }} />
                  <div className="h-full bg-rose-400  transition-all duration-700"               style={{ width: `${unnecessaryPct}%` }} />
                  <div className="h-full bg-white/5 flex-1 rounded-r-full" />
                </div>
                <p className="text-text-muted text-xs text-right">
                  Total tagged: {formatINR(taggedTotal)} · Total spend: {formatINR(stats.thisMonth.spend)}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={22} className="text-text-muted" />
              </div>
              <p className="text-text-secondary text-sm font-medium">No tagged transactions yet</p>
              <p className="text-text-muted text-xs mt-1 max-w-xs mx-auto">
                Sync your Expenses sheet to populate this chart —{" "}
                <Link href="/sync" className="text-violet-light hover:underline">go to Sync</Link>.
              </p>
            </div>
          )}
        </div>

        {/* Getting started banner */}
        {!hasAnyData && (
          <div className="card p-6 border-violet/20 bg-violet/5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gradient-violet rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-white" />
              </div>
              <div>
                <p className="font-display font-semibold text-text-primary">Getting started</p>
                <p className="text-text-secondary text-sm mt-1 max-w-xl">
                  Head to <Link href="/spending" className="text-violet-light font-medium hover:underline">Spending</Link> to
                  add your first transactions, or <Link href="/investing" className="text-violet-light font-medium hover:underline">Investing</Link> to
                  record your holdings. Your stats will appear here automatically.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
