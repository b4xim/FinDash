"use client";

// ============================================================
// SipCard — individual SIP mandate display card
// Shows: name, amount, next SIP date, totals, status, actions
// Linked holding: shows holding name + units detail after recording
// ============================================================

import { SipEntry } from "@/types";
import { formatINR } from "@/lib/utils";
import {
  Pencil, Trash2, CheckCircle2, PauseCircle, PlayCircle,
  CalendarClock, TrendingUp, Repeat2, Zap, Link2, AlertCircle
} from "lucide-react";

export interface RecordResult {
  holdingUpdated: boolean;
  unitsAdded: number | null;
  priceUsed: number | null;
}

const ASSET_LABELS: Record<string, string> = {
  mutual_fund: "Mutual Fund",
  etf: "ETF",
  stock: "Stock",
};

const ASSET_COLORS: Record<string, string> = {
  mutual_fund: "#8B5CF6",
  etf:         "#06B6D4",
  stock:       "#F59E0B",
};

const FREQ_LABELS: Record<string, string> = {
  monthly:   "Monthly",
  weekly:    "Weekly",
  quarterly: "Quarterly",
};

// Calculate the next SIP date from today
function getNextSipDate(sipDay: number, frequency: string): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (frequency === "monthly") {
    // Try this month's date; if past, use next month
    const thisMonth = new Date(year, month, sipDay);
    if (thisMonth > now) return thisMonth;
    return new Date(year, month + 1, sipDay);
  }

  if (frequency === "quarterly") {
    // Try this month, then +1, +2 until we find the next quarterly date
    for (let i = 0; i < 4; i++) {
      const d = new Date(year, month + i, sipDay);
      if (d > now) return d;
    }
  }

  if (frequency === "weekly") {
    // sipDay here = day of week (1=Mon... 7=Sun), map to JS 0=Sun...6=Sat
    const targetDow = sipDay % 7; // 7 → 0 (Sunday)
    const d = new Date(now);
    const currentDow = d.getDay();
    let daysUntil = (targetDow - currentDow + 7) % 7;
    if (daysUntil === 0) daysUntil = 7; // next week
    d.setDate(d.getDate() + daysUntil);
    return d;
  }

  return new Date(year, month + 1, sipDay);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function dateSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st"; case 2: return "nd"; case 3: return "rd";
    default: return "th";
  }
}

interface SipCardProps {
  sip: SipEntry;
  holdingName?: string;       // name of linked holding, if any
  lastRecord?: RecordResult;  // result of the most recent "Record Installment" call
  onEdit: (s: SipEntry) => void;
  onDelete: (s: SipEntry) => void;
  onToggleActive: (s: SipEntry) => void;
  onRecordInstallment: (s: SipEntry) => void;
  recording: boolean;
}

export default function SipCard({
  sip, holdingName, lastRecord, onEdit, onDelete, onToggleActive, onRecordInstallment, recording,
}: SipCardProps) {
  const nextDate = getNextSipDate(sip.sip_date, sip.frequency);
  const daysLeft = daysUntil(nextDate);
  const isUrgent = daysLeft <= 3;

  const assetColor = ASSET_COLORS[sip.asset_type] ?? "#8B5CF6";

  return (
    <div
      className={`card p-5 flex flex-col gap-4 transition-all ${
        !sip.is_active ? "opacity-60" : ""
      }`}
      style={{
        borderLeft: `3px solid ${sip.is_active ? assetColor : "transparent"}`,
      }}
    >
      {/* Header row: name + asset badge + status indicator */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text-primary truncate">{sip.name}</span>
            {(sip.mfapi_code || sip.ticker) && (
              <Zap size={11} className="text-gold flex-shrink-0" />
            )}
          </div>
          {/* Linked holding info or unlinked warning */}
          {holdingName ? (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-violet-light">
              <Link2 size={9} />
              <span className="truncate">{holdingName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-400/70">
              <AlertCircle size={9} />
              <span>No holding linked — units won&apos;t update</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: `${assetColor}1A`,
                color: assetColor,
              }}
            >
              {ASSET_LABELS[sip.asset_type]}
            </span>
            {sip.account && (
              <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded">
                {sip.account}
              </span>
            )}
            <span className="text-[10px] text-text-muted">
              {FREQ_LABELS[sip.frequency]}
            </span>
            {/* Active/Paused pill */}
            {sip.is_active ? (
              <span className="text-[10px] text-emerald-fin bg-emerald-fin/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-fin animate-pulse inline-block" />
                Active
              </span>
            ) : (
              <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded">
                Paused
              </span>
            )}
          </div>
        </div>

        {/* SIP Amount */}
        <div className="text-right flex-shrink-0">
          <p className="font-mono font-bold text-lg text-text-primary leading-tight">
            {formatINR(sip.sip_amount)}
          </p>
          <p className="text-text-muted text-[10px]">per {sip.frequency === "quarterly" ? "quarter" : sip.frequency === "weekly" ? "week" : "month"}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-overlay rounded-lg p-2.5 text-center">
          <p className="text-text-muted text-[10px] mb-0.5 flex items-center justify-center gap-0.5">
            <TrendingUp size={9} /> Invested
          </p>
          <p className="font-mono text-xs font-semibold text-text-primary">
            {formatINR(sip.total_invested)}
          </p>
        </div>
        <div className="bg-surface-overlay rounded-lg p-2.5 text-center">
          <p className="text-text-muted text-[10px] mb-0.5 flex items-center justify-center gap-0.5">
            <Repeat2 size={9} /> Installments
          </p>
          <p className="font-mono text-xs font-semibold text-text-primary">
            {sip.total_installments_done}
          </p>
        </div>
        <div className={`rounded-lg p-2.5 text-center ${isUrgent && sip.is_active ? "bg-amber-500/10" : "bg-surface-overlay"}`}>
          <p className={`text-[10px] mb-0.5 flex items-center justify-center gap-0.5 ${isUrgent && sip.is_active ? "text-amber-400" : "text-text-muted"}`}>
            <CalendarClock size={9} /> Next SIP
          </p>
          {sip.is_active ? (
            <>
              <p className={`font-mono text-[10px] font-semibold ${isUrgent ? "text-amber-400" : "text-text-primary"}`}>
                {formatDate(nextDate)}
              </p>
              <p className={`text-[9px] ${isUrgent ? "text-amber-400/70" : "text-text-muted"}`}>
                {daysLeft === 0 ? "Today!" : daysLeft === 1 ? "Tomorrow" : `in ${daysLeft}d`}
              </p>
            </>
          ) : (
            <p className="text-text-muted text-[10px]">—</p>
          )}
        </div>
      </div>

      {/* SIP day info */}
      <p className="text-text-muted text-[11px] -mt-1">
        <span className="text-text-secondary font-medium">{sip.sip_date}{dateSuffix(sip.sip_date)}</span>
        {" "}of each {sip.frequency === "quarterly" ? "quarter" : sip.frequency === "weekly" ? "week" : "month"}
        {sip.end_date && (
          <> · ends {new Date(sip.end_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</>
        )}
      </p>

      {/* Last record result detail */}
      {lastRecord && (
        <div className="text-[11px] rounded-lg px-2.5 py-2 bg-emerald-fin/10 border border-emerald-fin/20 text-emerald-fin animate-fade-in">
          {lastRecord.unitsAdded && lastRecord.priceUsed ? (
            <span>+{lastRecord.unitsAdded.toFixed(4)} units @ ₹{lastRecord.priceUsed.toFixed(2)}{lastRecord.holdingUpdated ? " · holding updated ✓" : ""}</span>
          ) : (
            <span>Installment recorded ✓</span>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
        {/* Record installment — primary action */}
        {sip.is_active && (
          <button
            onClick={() => onRecordInstallment(sip)}
            disabled={recording}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium
              bg-violet/15 border border-violet/30 text-violet-light hover:bg-violet/25 
              transition-all disabled:opacity-50"
          >
            <CheckCircle2 size={13} />
            {recording ? "Recording…" : "Record Installment"}
          </button>
        )}

        {/* Pause / Resume */}
        <button
          onClick={() => onToggleActive(sip)}
          className={`p-1.5 rounded-lg transition-colors ${
            sip.is_active
              ? "text-text-muted hover:text-amber-400 hover:bg-amber-400/10"
              : "text-text-muted hover:text-emerald-fin hover:bg-emerald-fin/10"
          }`}
          title={sip.is_active ? "Pause SIP" : "Resume SIP"}
        >
          {sip.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
        </button>

        <button
          onClick={() => onEdit(sip)}
          className="p-1.5 rounded-lg text-text-muted hover:text-violet-light hover:bg-violet/10 transition-colors"
          title="Edit SIP"
        >
          <Pencil size={16} />
        </button>

        <button
          onClick={() => onDelete(sip)}
          className="p-1.5 rounded-lg text-text-muted hover:text-rose-fin hover:bg-rose-fin/10 transition-colors"
          title="Delete SIP"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
