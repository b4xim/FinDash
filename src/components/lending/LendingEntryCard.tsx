"use client";

// ============================================================
// LendingEntryCard — displays a single lending entry with
// person, amount, direction, status, and action buttons
// ============================================================

import { LendingEntry } from "@/types";
import { formatINR, formatDate, cn } from "@/lib/utils";
import {
  ArrowUpRight, ArrowDownLeft, Edit3, Trash2,
  CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";

interface LendingEntryCardProps {
  entry: LendingEntry;
  onEdit: (entry: LendingEntry) => void;
  onDelete: (entry: LendingEntry) => void;
  onSettle: (entry: LendingEntry) => void;
}

export default function LendingEntryCard({ entry, onEdit, onDelete, onSettle }: LendingEntryCardProps) {
  const isLent = entry.direction === "lent";
  const remaining = entry.amount - entry.settled_amount;
  const progressPct = entry.amount > 0 ? (entry.settled_amount / entry.amount) * 100 : 0;

  // Check if overdue
  const isOverdue = entry.due_date && entry.status !== "settled" && new Date(entry.due_date) < new Date();

  return (
    <div className={cn(
      "card p-5 transition-all duration-200 hover:border-white/10",
      entry.status === "settled" && "opacity-60"
    )}>
      {/* Top row: direction badge + person + actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {/* Direction icon */}
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            isLent ? "bg-rose-400/10" : "bg-emerald-500/10"
          )}>
            {isLent
              ? <ArrowUpRight size={18} className="text-rose-400" />
              : <ArrowDownLeft size={18} className="text-emerald-400" />
            }
          </div>
          <div>
            <p className="font-display font-medium text-text-primary">{entry.person}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                isLent
                  ? "bg-rose-400/10 text-rose-400"
                  : "bg-emerald-500/10 text-emerald-400"
              )}>
                {isLent ? "You lent" : "You borrowed"}
              </span>
              <span className="text-text-muted text-xs">{formatDate(entry.date)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {entry.status !== "settled" && (
            <button
              onClick={() => onSettle(entry)}
              className="p-1.5 rounded-lg text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Record settlement"
            >
              <CheckCircle2 size={16} />
            </button>
          )}
          <button
            onClick={() => onEdit(entry)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            title="Edit"
          >
            <Edit3 size={16} />
          </button>
          <button
            onClick={() => onDelete(entry)}
            className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Amount section */}
      <div className="flex items-baseline justify-between mb-2">
        <p className={cn(
          "font-mono text-lg font-semibold",
          isLent ? "text-rose-400" : "text-emerald-400"
        )}>
          {formatINR(entry.amount)}
        </p>
        {entry.status !== "settled" && remaining > 0 && (
          <p className="text-text-muted text-sm">
            <span className="text-text-secondary">{formatINR(remaining)}</span> remaining
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            entry.status === "settled"
              ? "bg-emerald-400"
              : isLent ? "bg-rose-400" : "bg-emerald-400"
          )}
          style={{ width: `${Math.min(progressPct, 100)}%` }}
        />
      </div>

      {/* Bottom row: status + due date */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {entry.status === "settled" ? (
            <>
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span className="text-emerald-400 font-medium">Settled</span>
            </>
          ) : entry.status === "partially_settled" ? (
            <>
              <Clock size={12} className="text-amber-400" />
              <span className="text-amber-400 font-medium">
                Partially settled ({Math.round(progressPct)}%)
              </span>
            </>
          ) : (
            <>
              <Clock size={12} className="text-text-muted" />
              <span className="text-text-muted font-medium">Pending</span>
            </>
          )}
        </div>

        {entry.due_date && (
          <div className={cn(
            "flex items-center gap-1",
            isOverdue ? "text-rose-400" : "text-text-muted"
          )}>
            {isOverdue && <AlertTriangle size={12} />}
            <span>Due {formatDate(entry.due_date)}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {entry.notes && (
        <p className="text-text-muted text-xs mt-3 pt-3 border-t border-white/5 italic">
          {entry.notes}
        </p>
      )}
    </div>
  );
}
