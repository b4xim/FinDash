"use client";

// ============================================================
// SmartPicksGrid — three stock segments + mutual funds
// Nifty 50 | Midcap | Smallcap, each with 3 picks + risk tags
// ============================================================

import type { SmartPick } from "@/types";
import SmartPickCard from "./SmartPickCard";
import { TrendingUp, Landmark, BarChart2, Zap } from "lucide-react";

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

interface SegmentHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
}

function SegmentHeader({ icon, title, subtitle, badge, badgeColor }: SegmentHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-violet/15 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-text-primary">{title}</h2>
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        </div>
        <p className="text-text-muted text-xs">{subtitle}</p>
      </div>
    </div>
  );
}

const SEGMENT_META = {
  nifty50: {
    title: "Nifty 50 Picks",
    subtitle: "Large-cap leaders screened by value & discount from 52w high",
    badge: "Low–Medium Risk",
    badgeColor: "bg-emerald-fin/15 text-emerald-fin border border-emerald-fin/20",
    icon: <TrendingUp size={16} className="text-violet-light" />,
  },
  midcap: {
    title: "Midcap Picks",
    subtitle: "Nifty Midcap 150 — growth stories at reasonable valuations",
    badge: "Medium Risk",
    badgeColor: "bg-gold/15 text-gold border border-gold/20",
    icon: <BarChart2 size={16} className="text-violet-light" />,
  },
  smallcap: {
    title: "Smallcap Picks",
    subtitle: "Nifty Smallcap 250 — high-growth potential, higher volatility",
    badge: "High Risk",
    badgeColor: "bg-rose-fin/15 text-rose-fin border border-rose-fin/20",
    icon: <Zap size={16} className="text-violet-light" />,
  },
};

export default function SmartPicksGrid({ picks, loading }: SmartPicksGridProps) {
  const nifty50Picks = picks.filter((p) => p.assetType === "stock" && p.stockCategory === "nifty50");
  const midcapPicks = picks.filter((p) => p.assetType === "stock" && p.stockCategory === "midcap");
  const smallcapPicks = picks.filter((p) => p.assetType === "stock" && p.stockCategory === "smallcap");
  const mfPicks = picks.filter((p) => p.assetType === "mutual_fund");

  if (loading) {
    return (
      <div className="space-y-10">
        {(["nifty50", "midcap", "smallcap"] as const).map((seg) => {
          const meta = SEGMENT_META[seg];
          return (
            <section key={seg}>
              <SegmentHeader {...meta} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </section>
          );
        })}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-violet/15 flex items-center justify-center">
              <Landmark size={16} className="text-violet-light" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-text-primary">Mutual Fund Picks</h2>
              <p className="text-text-muted text-xs">Top funds screened by 3-year CAGR performance</p>
            </div>
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
    <div className="space-y-10">
      {/* ── Nifty 50 Picks ── */}
      {nifty50Picks.length > 0 && (
        <section>
          <SegmentHeader {...SEGMENT_META.nifty50} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {nifty50Picks.map((pick) => (
              <SmartPickCard key={pick.ticker} pick={pick} />
            ))}
          </div>
        </section>
      )}

      {/* ── Midcap Picks ── */}
      {midcapPicks.length > 0 && (
        <section>
          <SegmentHeader {...SEGMENT_META.midcap} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {midcapPicks.map((pick) => (
              <SmartPickCard key={pick.ticker} pick={pick} />
            ))}
          </div>
        </section>
      )}

      {/* ── Smallcap Picks ── */}
      {smallcapPicks.length > 0 && (
        <section>
          <SegmentHeader {...SEGMENT_META.smallcap} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {smallcapPicks.map((pick) => (
              <SmartPickCard key={pick.ticker} pick={pick} />
            ))}
          </div>
        </section>
      )}

      {/* ── Mutual Fund Picks ── */}
      {mfPicks.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-violet/15 flex items-center justify-center">
              <Landmark size={16} className="text-violet-light" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-semibold text-text-primary">Mutual Fund Picks</h2>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet/15 text-violet-light border border-violet/20">
                  Diversified
                </span>
              </div>
              <p className="text-text-muted text-xs">Top funds screened by 3-year CAGR performance</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mfPicks.map((pick) => (
              <SmartPickCard key={pick.ticker} pick={pick} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
