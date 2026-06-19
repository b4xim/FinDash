"use client";

// ============================================================
// GoalForm — add or edit a financial goal
// ============================================================

import { useState } from "react";
import { FinancialGoal } from "@/types";

const GOAL_ICONS = [
  { value: "target",        label: "🎯 General" },
  { value: "plane",         label: "✈️ Travel" },
  { value: "home",          label: "🏠 Home" },
  { value: "car",           label: "🚗 Vehicle" },
  { value: "graduation-cap",label: "🎓 Education" },
  { value: "heart",         label: "❤️ Health" },
  { value: "shield",        label: "🛡️ Emergency" },
  { value: "gift",          label: "🎁 Other" },
];

const GOAL_COLORS = [
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#6366F1", // indigo
  "#14B8A6", // teal
];

interface GoalFormProps {
  initial?: Partial<FinancialGoal>;
  onSubmit: (data: Partial<FinancialGoal>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function GoalForm({ initial, onSubmit, onCancel, loading }: GoalFormProps) {
  const [form, setForm] = useState({
    name:          initial?.name          ?? "",
    target_amount: initial?.target_amount ?? "",
    saved_amount:  initial?.saved_amount  ?? 0,
    deadline:      initial?.deadline      ?? "",
    color:         initial?.color         ?? "#8B5CF6",
    icon:          initial?.icon          ?? "target",
    notes:         initial?.notes         ?? "",
  });

  function set(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form as Partial<FinancialGoal>);
  }

  const isEdit = !!initial?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="label">Goal Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set("name", e.target.value)}
          placeholder='e.g. "Goa Vacation", "Emergency Fund"'
          className="input"
          required
        />
      </div>

      {/* Target + Saved row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Target Amount (₹)</label>
          <input
            type="number"
            value={form.target_amount}
            onChange={e => set("target_amount", e.target.value)}
            placeholder="100000"
            min="1"
            step="1000"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Already Saved (₹)</label>
          <input
            type="number"
            value={form.saved_amount}
            onChange={e => set("saved_amount", e.target.value)}
            placeholder="0"
            min="0"
            step="100"
            className="input"
          />
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label className="label">Deadline <span className="text-text-muted">(optional)</span></label>
        <input
          type="date"
          value={form.deadline}
          onChange={e => set("deadline", e.target.value)}
          className="input"
        />
      </div>

      {/* Icon picker */}
      <div>
        <label className="label">Icon</label>
        <div className="grid grid-cols-4 gap-2">
          {GOAL_ICONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("icon", value)}
              className={[
                "py-2 rounded-xl text-xs border transition-all",
                form.icon === value
                  ? "border-violet/40 bg-violet/15 text-text-primary"
                  : "border-white/5 bg-surface-overlay text-text-muted hover:border-white/15",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div>
        <label className="label">Color</label>
        <div className="flex gap-2 flex-wrap">
          {GOAL_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                form.color === c ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="label">Notes <span className="text-text-muted">(optional)</span></label>
        <textarea
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          placeholder="Any details..."
          className="input resize-none"
          rows={2}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Goal"}
        </button>
      </div>
    </form>
  );
}
