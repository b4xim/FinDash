"use client";

// ============================================================
// HoldingsTable — shows all holdings with computed current value
// and gain/loss. All math is derived, not stored.
// ============================================================

import { Holding } from "@/types";
import { formatINR, ASSET_COLORS } from "@/lib/utils";
import { Pencil, Trash2, Zap, Clock } from "lucide-react";

const ASSET_LABELS: Record<string, string> = {
  mutual_fund: "Mutual Fund",
  stock: "Stock",
  etf: "ETF",
  fd: "Fixed Deposit",
  ppf: "PPF",
  other: "Other",
};

interface HoldingsTableProps {
  holdings: Holding[];
  onEdit: (h: Holding) => void;
  onDelete: (h: Holding) => void;
}

// A holding auto-syncs if it's a linked mutual fund, or a stock/ETF with a symbol set
function isAutoSync(h: Holding): boolean {
  if (h.mfapi_code) return true;
  if ((h.asset_type === "stock" || h.asset_type === "etf") && h.ticker) return true;
  return false;
}

// Format the "last updated" relative time
function relativeTime(iso?: string): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HoldingsTable({ holdings, onEdit, onDelete }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-text-secondary">No holdings yet</p>
        <p className="text-text-muted text-sm mt-1">Add your first investment to start tracking performance</p>
      </div>
    );
  }

  return (
    <div className="card">
      {/* ── Mobile card list (below sm breakpoint only) ── */}
      <div className="sm:hidden divide-y divide-white/5">
        {holdings.map(h => {
          const currentValue = h.units * h.current_price;
          const investedValue = h.units * h.buy_price;
          const gainLoss = currentValue - investedValue;
          const gainLossPct = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;
          const isProfit = gainLoss >= 0;

          return (
            <div key={h.id} className="px-4 py-3">
              {/* Row 1: Name + Current Value */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-text-primary truncate">{h.name}</span>
                    {isAutoSync(h) && <Zap size={11} className="text-gold flex-shrink-0" />}
                  </div>
                  {h.ticker && <p className="text-text-muted text-[10px] font-mono mt-0.5">{h.ticker}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-mono font-semibold text-sm text-text-primary">{formatINR(currentValue)}</p>
                    <p className={`font-mono text-[11px] ${isProfit ? "text-emerald-fin" : "text-rose-fin"}`}>
                      {isProfit ? "+" : ""}{formatINR(gainLoss)} ({isProfit ? "+" : ""}{gainLossPct.toFixed(1)}%)
                    </p>
                  </div>
                  <button
                    onClick={() => onEdit(h)}
                    className="p-1 rounded-md text-text-muted hover:text-violet-light hover:bg-violet/10 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </div>

              {/* Row 2: Type + Account + Units + Price info */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span
                  className="inline-flex items-center text-[10px] px-1.5 py-px rounded"
                  style={{
                    background: `${ASSET_COLORS[h.asset_type]}1A`,
                    color: ASSET_COLORS[h.asset_type],
                  }}
                >
                  {ASSET_LABELS[h.asset_type]}
                </span>
                {h.account && <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-px rounded">{h.account}</span>}
                <span className="text-[10px] text-text-muted font-mono">{h.units.toLocaleString("en-IN")} × {formatINR(h.buy_price)}</span>
                {isAutoSync(h) && h.price_updated_at && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-text-muted">
                    <Clock size={8} />{relativeTime(h.price_updated_at)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop/tablet table (sm and above) ── */}
      <div className="overflow-x-auto hidden sm:block">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Type</th>
              <th className="table-header">Account</th>
              <th className="table-header text-right">Units</th>
              <th className="table-header text-right">Avg Buy</th>
              <th className="table-header text-right">Current</th>
              <th className="table-header text-right">Value</th>
              <th className="table-header text-right">Gain/Loss</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => {
              const currentValue = h.units * h.current_price;
              const investedValue = h.units * h.buy_price;
              const gainLoss = currentValue - investedValue;
              const gainLossPct = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;
              const isProfit = gainLoss >= 0;

              return (
                <tr key={h.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{h.name}</span>
                      {isAutoSync(h) && <Zap size={12} className="text-gold flex-shrink-0" />}
                    </div>
                    {h.ticker && <p className="text-text-muted text-xs mt-0.5">{h.ticker}</p>}
                  </td>
                  <td className="table-cell">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        background: `${ASSET_COLORS[h.asset_type]}1A`,
                        color: ASSET_COLORS[h.asset_type],
                      }}
                    >
                      {ASSET_LABELS[h.asset_type]}
                    </span>
                  </td>
                  <td className="table-cell text-text-muted">{h.account || "—"}</td>
                  <td className="table-cell text-right font-mono">{h.units.toLocaleString("en-IN")}</td>
                  <td className="table-cell text-right font-mono text-text-secondary">{formatINR(h.buy_price)}</td>
                  <td className="table-cell text-right font-mono">
                    {formatINR(h.current_price)}
                    {isAutoSync(h) && (
                      <div className="flex items-center justify-end gap-1 text-text-muted text-[10px] mt-0.5">
                        <Clock size={9} /> {relativeTime(h.price_updated_at)}
                      </div>
                    )}
                  </td>
                  <td className="table-cell text-right font-mono font-medium">{formatINR(currentValue)}</td>
                  <td className={`table-cell text-right font-mono font-medium ${isProfit ? "text-emerald-fin" : "text-rose-fin"}`}>
                    {isProfit ? "+" : ""}{formatINR(gainLoss)}
                    <div className="text-[10px] opacity-80">
                      {isProfit ? "+" : ""}{gainLossPct.toFixed(1)}%
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(h)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-violet-light hover:bg-violet/10 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(h)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-rose-fin hover:bg-rose-fin/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
