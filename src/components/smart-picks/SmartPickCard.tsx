"use client";

// ============================================================
// SmartPickCard — individual recommendation card
// Shows asset name, price, signal, risk, volatility & AI rationale
// ============================================================

import type { SmartPick } from "@/types";
import {
  TrendingUp, TrendingDown, Shield, AlertTriangle,
  BarChart3, Activity, Zap, Moon,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

const SIGNAL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Buy": { bg: "bg-emerald-fin/15", text: "text-emerald-fin", border: "border-emerald-fin/30" },
  "Buy":        { bg: "bg-emerald-fin/10", text: "text-emerald-fin", border: "border-emerald-fin/20" },
  "Watch":      { bg: "bg-gold/10",        text: "text-gold",        border: "border-gold/20" },
};

const RISK_STYLES: Record<string, { icon: typeof Shield; color: string; bar: string }> = {
  "Low":    { icon: Shield,        color: "text-emerald-fin", bar: "bg-emerald-fin" },
  "Medium": { icon: Activity,      color: "text-gold",        bar: "bg-gold" },
  "High":   { icon: AlertTriangle, color: "text-rose-fin",    bar: "bg-rose-fin" },
};

const RISK_BAR_WIDTH: Record<string, string> = {
  "Low": "w-1/3",
  "Medium": "w-2/3",
  "High": "w-full",
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
    <div className="card p-5 hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 group flex flex-col gap-0">
      {/* Header row: name + signal badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-text-primary text-sm truncate group-hover:text-violet-light transition-colors">
            {pick.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-text-muted text-xs font-mono">
              {pick.assetType === "stock" ? pick.ticker.replace(".NS", "") : "Mutual Fund"}
            </p>
            {pick.assetType === "stock" && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-fin/10 text-emerald-fin border border-emerald-fin/20">
                <Moon size={8} />
                Shariah
              </span>
            )}
          </div>
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${signalStyle.bg} ${signalStyle.text} ${signalStyle.border} whitespace-nowrap flex-shrink-0`}
        >
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
            {pick.assetType === "stock"
              ? formatINR(pick.currentPrice)
              : `₹${pick.currentPrice.toFixed(2)}`}
          </p>
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-mono font-medium ${
            isPositive ? "text-emerald-fin" : "text-rose-fin"
          }`}
        >
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {isPositive ? "+" : ""}{pick.returnPct.toFixed(1)}%
        </div>
      </div>

      {/* Metrics bar */}
      <div className="flex items-center gap-3 text-[10px] text-text-muted mb-3 flex-wrap">
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
        {pick.metrics.volatility != null && (
          <div className="flex items-center gap-1">
            <Zap size={10} />
            <span>Vol {pick.metrics.volatility.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Risk meter */}
      <div className="mb-4 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <div className={`flex items-center gap-1 text-[10px] font-medium ${riskInfo.color}`}>
            <RiskIcon size={10} />
            <span>{pick.riskLevel} Risk</span>
          </div>
          <span className="text-[10px] text-text-muted">
            {pick.riskLevel === "Low" ? "Stable" : pick.riskLevel === "Medium" ? "Moderate" : "Volatile"}
          </span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${riskInfo.bar} ${RISK_BAR_WIDTH[pick.riskLevel]}`}
          />
        </div>
      </div>

      {/* AI Rationale */}
      <p className="text-text-secondary text-xs leading-relaxed">
        {pick.rationale}
      </p>
    </div>
  );
}
