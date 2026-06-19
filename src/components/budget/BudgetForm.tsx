"use client";

// ============================================================
// BudgetForm — add or edit a category budget limit
// ============================================================

import { useState } from "react";
import { BudgetLimit, Category } from "@/types";

const SPENDABLE_CATEGORIES: Category[] = [
  "Food & Dining", "Shopping", "Transport", "Utilities",
  "Entertainment", "Healthcare", "Other",
];

interface BudgetFormProps {
  initial?: Partial<BudgetLimit>;
  onSubmit: (data: Partial<BudgetLimit>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  existingCategories?: string[]; // to disable already-set ones when adding
}

export default function BudgetForm({ initial, onSubmit, onCancel, loading, existingCategories = [] }: BudgetFormProps) {
  const [form, setForm] = useState({
    category:      initial?.category     ?? "",
    monthly_limit: initial?.monthly_limit ?? "",
    alert_at_pct:  initial?.alert_at_pct  ?? 80,
  });

  function set(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form as Partial<BudgetLimit>);
  }

  const isEdit = !!initial?.id;
  const available = isEdit
    ? SPENDABLE_CATEGORIES
    : SPENDABLE_CATEGORIES.filter(c => !existingCategories.includes(c));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category */}
      <div>
        <label className="label">Category</label>
        {isEdit ? (
          <div className="input bg-white/5 text-text-secondary">{form.category}</div>
        ) : (
          <select
            value={form.category}
            onChange={e => set("category", e.target.value)}
            className="select"
            required
          >
            <option value="">Select a category...</option>
            {available.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Monthly limit */}
      <div>
        <label className="label">Monthly Limit (₹)</label>
        <input
          type="number"
          value={form.monthly_limit}
          onChange={e => set("monthly_limit", e.target.value)}
          placeholder="e.g. 5000"
          min="1"
          step="100"
          className="input"
          required
        />
      </div>

      {/* Alert threshold */}
      <div>
        <label className="label">
          Alert when spending reaches{" "}
          <span className="text-violet-light font-semibold">{form.alert_at_pct}%</span>
        </label>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={form.alert_at_pct}
          onChange={e => set("alert_at_pct", parseInt(e.target.value))}
          className="w-full accent-violet h-1.5 mt-2"
        />
        <div className="flex justify-between text-xs text-text-muted mt-1">
          <span>10%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Set Budget"}
        </button>
      </div>
    </form>
  );
}
