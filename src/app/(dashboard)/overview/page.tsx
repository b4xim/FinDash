"use client";

// ============================================================
// Overview Page — live net worth, spend/income stats, charts
// Fetches aggregated data from /api/stats
// ============================================================

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import TrendBarChart from "@/components/spending/TrendBarChart";
import CategoryPieChart from "@/components/spending/CategoryPieChart";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatINR, pctChange } from "@/lib/utils";
import Link from "next/link";

// Stat card — shared visual component for the 4 top tiles
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

interface StatsResponse {
  thisMonth: { spend: number; income: number };
  lastMonth: { spend: number; income: number };
  investmentsTotal: number;
  investmentsGainLoss: number;
  netWorth: number;
  categoryBreakdown: { name: string; value: number }[];
  trendData: { month: string; spend: number; income: number }[];
}

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
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

  const hasAnyData = stats.trendData.some(d => d.spend > 0 || d.income > 0) || stats.investmentsTotal > 0;
  const spendChange  = pctChange(stats.thisMonth.spend, stats.lastMonth.spend);
  const incomeChange = pctChange(stats.thisMonth.income, stats.lastMonth.income);

  return (
    <>
      <Header title="Overview" subtitle="Your financial snapshot" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Net Worth"
            value={formatINR(stats.netWorth, true)}
            change={null}
            icon={Wallet}
            accent="bg-gradient-violet"
          />
          <StatCard
            label="This Month's Spend"
            value={formatINR(stats.thisMonth.spend, true)}
            change={spendChange === 0 ? 0 : -spendChange}
            icon={TrendingDown}
            accent="bg-rose-fin/20"
          />
          <StatCard
            label="This Month's Income"
            value={formatINR(stats.thisMonth.income, true)}
            change={incomeChange}
            icon={TrendingUp}
            accent="bg-emerald-fin/20"
          />
          <StatCard
            label="Investments"
            value={formatINR(stats.investmentsTotal, true)}
            change={stats.investmentsGainLoss === 0 ? 0 : (stats.investmentsGainLoss / Math.max(stats.investmentsTotal - stats.investmentsGainLoss, 1)) * 100}
            changeLabel="overall returns"
            icon={PiggyBank}
            accent="bg-gradient-gold"
          />
        </div>

        {/* Charts */}
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

        {/* Getting started banner — only show if no data yet */}
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
