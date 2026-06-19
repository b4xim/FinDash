"use client";

// ============================================================
// SmartPicksGrid — two-section grid layout for stock and MF picks
// ============================================================

import type { SmartPick } from "@/types";
import SmartPickCard from "./SmartPickCard";
import { TrendingUp, Landmark } from "lucide-react";

interface SmartPicksGridProps {
  picks: SmartPick[];
  loading: boolean;
}

// Skeleton loader card
function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-4 w-32 bg-white/5 rounded" />
          <div className="h-3 w-20 bg-white/5 rounded mt-2" />
        </div>
        <div className="h-5 w-16 bg-white/5 rounded-full" />
      </div>
      <div className="flex justify-between mb-4">
        <div className="h-6 w-24 bg-white/5 rounded" />
        <div className="h-4 w-14 bg-white/5 rounded" />
      </div>
      <div className="h-3 w-full bg-white/5 rounded mb-4 pb-4 border-b border-white/5" />
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-white/5 rounded" />
        <div className="h-3 w-3/4 bg-white/5 rounded" />
      </div>
    </div>
  );
}

export default function SmartPicksGrid({ picks, loading }: SmartPicksGridProps) {
  const stockPicks = picks.filter(p => p.assetType === "stock");
  const mfPicks = picks.filter(p => p.assetType === "mutual_fund");

  if (loading) {
    return (
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet/15 flex items-center justify-center">
              <TrendingUp size={16} className="text-violet-light" />
            </div>
            <h2 className="font-display font-semibold text-text-primary">Stock Picks</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </section>
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet/15 flex items-center justify-center">
              <Landmark size={16} className="text-violet-light" />
            </div>
            <h2 className="font-display font-semibold text-text-primary">Mutual Fund Picks</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </section>
      </div>
    );
  }

  if (picks.length === 0) {
    return (
      <div className="card p-12 text-center">
        <TrendingUp size={40} className="mx-auto text-text-muted mb-3" />
        <p className="text-text-primary font-display font-medium">No picks yet</p>
        <p className="text-text-muted text-sm mt-1">
          Click &quot;Refresh Picks&quot; to generate AI-powered recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stock Picks */}
      {stockPicks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet/15 flex items-center justify-center">
              <TrendingUp size={16} className="text-violet-light" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-text-primary">Stock Picks</h2>
              <p className="text-text-muted text-xs">Nifty 50 stocks screened by value &amp; momentum</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {stockPicks.map(pick => (
              <SmartPickCard key={pick.ticker} pick={pick} />
            ))}
          </div>
        </section>
      )}

      {/* Mutual Fund Picks */}
      {mfPicks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet/15 flex items-center justify-center">
              <Landmark size={16} className="text-violet-light" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-text-primary">Mutual Fund Picks</h2>
              <p className="text-text-muted text-xs">Top funds screened by 3-year CAGR performance</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mfPicks.map(pick => (
              <SmartPickCard key={pick.ticker} pick={pick} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
