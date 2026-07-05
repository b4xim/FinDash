"use client";

// ============================================================
// LendingForm — add / edit a lending entry
// Used inside Modal on the Lending page
// ============================================================

import { useState } from "react";
import { LendingEntry, LendingDirection } from "@/types";

interface LendingFormProps {
  initial?: LendingEntry;
  onSubmit: (data: Partial<LendingEntry>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function LendingForm({ initial, onSubmit, onCancel, loading }: LendingFormProps) {
  const [person, setPerson]       = useState(initial?.person ?? "");
  const [direction, setDirection] = useState<LendingDirection>(initial?.direction ?? "lent");
  const [amount, setAmount]       = useState(initial?.amount?.toString() ?? "");
  const [date, setDate]           = useState(initial?.date ?? new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate]     = useState(initial?.due_date ?? "");
  const [notes, setNotes]         = useState(initial?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      person: person.trim(),
      direction,
      amount: parseFloat(amount),
      date,
      due_date: dueDate || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const isValid = person.trim() && amount && parseFloat(amount) > 0 && date;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Direction toggle */}
      <div>
        <label className="label">Type</label>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setDirection("lent")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              direction === "lent"
                ? "bg-rose-400/15 border-rose-400/30 text-rose-400"
                : "border-white/10 text-text-secondary hover:bg-white/5"
            }`}
          >
            I Lent (gave money)
          </button>
          <button
            type="button"
            onClick={() => setDirection("borrowed")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              direction === "borrowed"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "border-white/10 text-text-secondary hover:bg-white/5"
            }`}
          >
            I Borrowed (received money)
          </button>
        </div>
      </div>

      {/* Person */}
      <div>
        <label htmlFor="lending-person" className="label">Person</label>
        <input
          id="lending-person"
          type="text"
          className="input mt-1"
          placeholder="e.g. Rahul, Mom, Zara…"
          value={person}
          onChange={e => setPerson(e.target.value)}
          required
        />
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="lending-amount" className="label">Amount (₹)</label>
        <input
          id="lending-amount"
          type="number"
          min="1"
          step="0.01"
          className="input mt-1"
          placeholder="5000"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
      </div>

      {/* Date row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="lending-date" className="label">Date</label>
          <input
            id="lending-date"
            type="date"
            className="input mt-1"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="lending-due-date" className="label">Due Date (optional)</label>
          <input
            id="lending-due-date"
            type="date"
            className="input mt-1"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="lending-notes" className="label">Notes (optional)</label>
        <textarea
          id="lending-notes"
          className="input mt-1 min-h-[80px] resize-y"
          placeholder="For rent, borrowed for travel…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!isValid || loading}>
          {loading ? "Saving…" : initial ? "Update" : "Add Entry"}
        </button>
      </div>
    </form>
  );
}
