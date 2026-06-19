"use client";

// ============================================================
// SmartPickCard — individual recommendation card
// Shows asset name, price, signal, risk, AI rationale
// ============================================================

import type { SmartPick } from "@/types";
import {
  TrendingUp, TrendingDown, Shield, AlertTriangle,
  BarChart3, Activity,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

const SIGNAL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Buy": { bg: "bg-emerald-fin/15", text: "text-emerald-fin", border: "border-emerald-fin/30" },
  "Buy":        { bg: "bg-emerald-fin/10", text: "text-emerald-fin", border: "border-emerald-fin/20" },
  "Watch":      { bg: "bg-gold/10",        text: "text-gold",        border: "border-gold/20" },
};

const RISK_STYLES: Record<string, { icon: typeof Shield; color: string }> = {
  "Low":    { icon: Shield,          color: "text-emerald-fin" },
  "Medium": { icon: Activity,        color: "text-gold" },
  "High":   { icon: AlertTriangle,   color: "text-rose-fin" },
};

interface SmartPickCardProps {
  pick: SmartPick;
}

export default function SmartPickCard({ pick }: SmartPickCardProps) {
  const signalStyle = SIGNAL_STYLES[pick.signal] || SIGNAL_STYLES["Watch"];
  const riskInfo = RISK_STYLES[pick.riskLevel] || RISK_STYLES["Medium"];
  const RiskIcon = riskInfo.icon;
  const isPositive = pick.returnPct >= 0;

  return (
    <div className="card p-5 hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 group">
      {/* Header row: name + signal badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-text-primary text-sm truncate group-hover:text-violet-light transition-colors">
            {pick.name}
          </h3>
          <p className="text-text-muted text-xs font-mono mt-0.5">
            {pick.assetType === "stock" ? pick.ticker.replace(".NS", "") : "Mutual Fund"}
          </p>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${signalStyle.bg} ${signalStyle.text} ${signalStyle.border} whitespace-nowrap`}>
          {pick.signal}
        </span>
      </div>

      {/* Price + return */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider mb-0.5">
            {pick.assetType === "stock" ? "Price" : "NAV"}
          </p>
          <p className="font-display font-semibold text-text-primary text-lg">
            {pick.assetType === "stock" ? formatINR(pick.currentPrice) : `₹${pick.currentPrice.toFixed(2)}`}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-sm font-mono font-medium ${isPositive ? "text-emerald-fin" : "text-rose-fin"}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {isPositive ? "+" : ""}{pick.returnPct.toFixed(1)}%
        </div>
      </div>

      {/* Metrics bar */}
      <div className="flex items-center gap-3 text-[10px] text-text-muted mb-4 pb-4 border-b border-white/5">
        {pick.metrics.pe != null && pick.metrics.pe > 0 && (
          <div className="flex items-center gap-1">
            <BarChart3 size={10} />
            <span>P/E {pick.metrics.pe.toFixed(1)}</span>
          </div>
        )}
        {pick.metrics.high52w != null && (
          <div className="flex items-center gap-1">
            <TrendingUp size={10} />
            <span>52w H ₹{pick.metrics.high52w.toFixed(0)}</span>
          </div>
        )}
        {pick.metrics.low52w != null && (
          <div className="flex items-center gap-1">
            <TrendingDown size={10} />
            <span>52w L ₹{pick.metrics.low52w.toFixed(0)}</span>
          </div>
        )}
        {pick.metrics.cagr3y != null && (
          <div className="flex items-center gap-1">
            <BarChart3 size={10} />
            <span>3Y CAGR {pick.metrics.cagr3y.toFixed(1)}%</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ml-auto ${riskInfo.color}`}>
          <RiskIcon size={10} />
          <span>{pick.riskLevel} Risk</span>
        </div>
      </div>

      {/* AI Rationale */}
      <p className="text-text-secondary text-xs leading-relaxed">
        {pick.rationale}
      </p>
    </div>
  );
}
