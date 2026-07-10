"use client";

// ============================================================
// TransactionForm — shared form for Add and Edit modals
// ============================================================

import { useState } from "react";
import { Transaction, Category } from "@/types";

// All available categories — must match DB CHECK constraint
const CATEGORIES: Category[] = [
  "Food & Dining", "Shopping", "Transport", "Utilities",
  "Entertainment", "Healthcare", "Investment", "Rent", "Income", "Transfer", "Other",
];

interface TransactionFormProps {
  initial?: Partial<Transaction>; // Pre-fill for edit mode
  onSubmit: (data: Partial<Transaction>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function TransactionForm({ initial, onSubmit, onCancel, loading }: TransactionFormProps) {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    date:        initial?.date        ?? today,
    description: initial?.description ?? "",
    amount:      initial?.amount      ?? "",
    type:        initial?.type        ?? "debit",
    category:    initial?.category    ?? "Other",
    account:     initial?.account     ?? "",
    notes:       initial?.notes       ?? "",
    necessary:   initial?.necessary   ?? "", // "Necessary" | "Unnecessary" | ""
  });

  // Generic field updater — keeps the form DRY
  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Partial<Transaction> = {
      ...form as unknown as Partial<Transaction>,
      // Send undefined (not empty string) if untagged so the DB stores NULL
      necessary: (form.necessary as "Necessary" | "Unnecessary") || undefined,
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date + Type row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set("date", e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)} className="select" required>
            <option value="debit">Debit (expense)</option>
            <option value="credit">Credit (income)</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="label">Description / Merchant</label>
        <input
          type="text"
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="e.g. Swiggy, Amazon, Salary"
          className="input"
          required
        />
      </div>

      {/* Amount + Category row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (₹)</label>
          <input
            type="number"
            value={form.amount}
            onChange={e => set("amount", e.target.value)}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Category</label>
          <select value={form.category} onChange={e => set("category", e.target.value)} className="select" required>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Account (optional) */}
      <div>
        <label className="label">Account <span className="text-text-muted">(optional)</span></label>
        <input
          type="text"
          value={form.account}
          onChange={e => set("account", e.target.value)}
          placeholder="e.g. ICICI Credit Card, SBI Savings"
          className="input"
        />
      </div>

      {/* Necessary? — only shown for debit transactions */}
      {form.type === "debit" && (
        <div>
          <label className="label">
            Necessary? <span className="text-text-muted">(optional)</span>
          </label>
          <div className="flex gap-2">
            {(["", "Necessary", "Unnecessary"] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => set("necessary", opt)}
                className={[
                  "flex-1 py-2 rounded-xl text-sm font-medium border transition-all duration-150",
                  form.necessary === opt && opt === "Necessary"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : form.necessary === opt && opt === "Unnecessary"
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : form.necessary === opt && opt === ""
                    ? "bg-white/10 text-text-primary border-white/20"
                    : "bg-surface-overlay text-text-muted border-white/5 hover:border-white/15",
                ].join(" ")}
              >
                {opt === "" ? "No tag" : opt === "Necessary" ? "✓ Necessary" : "✗ Unnecessary"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes (optional) */}
      <div>
        <label className="label">Notes <span className="text-text-muted">(optional)</span></label>
        <textarea
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          placeholder="Any extra details..."
          className="input resize-none"
          rows={2}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : initial?.id ? "Save Changes" : "Add Transaction"}
        </button>
      </div>
    </form>
  );
}
