"use client";

// ============================================================
// SettleForm — record a partial or full settlement
// Used inside a Modal on the Lending page
// ============================================================

import { useState } from "react";
import { LendingEntry } from "@/types";
import { formatINR } from "@/lib/utils";

interface SettleFormProps {
  entry: LendingEntry;
  onSubmit: (settledAmount: number, markFullySettled: boolean) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function SettleForm({ entry, onSubmit, onCancel, loading }: SettleFormProps) {
  const remaining = entry.amount - entry.settled_amount;
  const [settleAmount, setSettleAmount] = useState(remaining.toString());
  const [fullySettle, setFullySettle] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    const newTotal = entry.settled_amount + amt;
    const isFullySettled = fullySettle || newTotal >= entry.amount;
    await onSubmit(newTotal, isFullySettled);
  }

  const isValid = settleAmount && parseFloat(settleAmount) > 0 && parseFloat(settleAmount) <= remaining;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card p-4 bg-white/[0.02]">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Original Amount</span>
          <span className="font-mono text-text-primary">{formatINR(entry.amount)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-text-muted">Already Settled</span>
          <span className="font-mono text-emerald-400">{formatINR(entry.settled_amount)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-white/5">
          <span className="text-text-secondary font-medium">Remaining</span>
          <span className="font-mono text-text-primary font-medium">{formatINR(remaining)}</span>
        </div>
      </div>

      <div>
        <label htmlFor="settle-amount" className="label">Settlement Amount (₹)</label>
        <input
          id="settle-amount"
          type="number"
          min="1"
          max={remaining}
          step="0.01"
          className="input mt-1"
          placeholder={remaining.toString()}
          value={settleAmount}
          onChange={e => setSettleAmount(e.target.value)}
          required
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={fullySettle}
          onChange={e => {
            setFullySettle(e.target.checked);
            if (e.target.checked) setSettleAmount(remaining.toString());
          }}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet accent-violet"
        />
        <span className="text-text-secondary text-sm">Mark as fully settled</span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!isValid || loading}>
          {loading ? "Saving…" : "Record Settlement"}
        </button>
      </div>
    </form>
  );
}
