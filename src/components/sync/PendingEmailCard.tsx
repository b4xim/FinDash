"use client";

// ============================================================
// PendingEmailCard — one row in the review queue.
// Shows the parser's best guess, lets the user edit any field
// before approving, or reject outright.
// ============================================================

import { useState } from "react";
import { PendingEmail, Category, TransactionType } from "@/types";
import { Check, X, Mail, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatINR } from "@/lib/utils";

const CATEGORIES: Category[] = [
  "Food & Dining", "Shopping", "Transport", "Utilities",
  "Entertainment", "Healthcare", "Investment", "Rent", "Income", "Transfer", "Other",
];

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  high:   { label: "High confidence",   className: "bg-emerald-fin-dim text-emerald-fin" },
  medium: { label: "Medium confidence", className: "bg-gold/15 text-gold" },
  low:    { label: "Low confidence — please check", className: "bg-rose-fin-dim text-rose-fin" },
};

interface PendingEmailCardProps {
  email: PendingEmail;
  onApprove: (id: string, data: Record<string, unknown>) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export default function PendingEmailCard({ email, onApprove, onReject }: PendingEmailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const parsed = email.parsed_json;

  const [form, setForm] = useState({
    date:        parsed?.date ?? new Date(email.received_at).toISOString().split("T")[0],
    description: parsed?.description ?? "",
    amount:      parsed?.amount ?? "",
    type:        (parsed?.type ?? "debit") as TransactionType,
    category:    parsed?.category ?? "Other",
    account:     parsed?.account ?? "",
    card_last4:  parsed?.card_last4 ?? "",
  });

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleApprove() {
    setLoading(true);
    await onApprove(email.id, form);
    setLoading(false);
  }

  async function handleReject() {
    setLoading(true);
    await onReject(email.id);
    setLoading(false);
  }

  const confidence = CONFIDENCE_STYLES[parsed?.confidence ?? "low"];
  const missingData = !form.description || !form.amount;

  return (
    <div className="card overflow-hidden">
      {/* Header — always visible */}
      <div className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet/15 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Mail size={16} className="text-violet-light" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-text-primary text-sm font-medium truncate">{email.subject}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${confidence.className}`}>
              {confidence.label}
            </span>
          </div>
          <p className="text-text-muted text-xs mt-0.5 truncate">{email.sender}</p>

          {/* Quick summary */}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-text-secondary">{form.description || "—"}</span>
            {form.amount && (
              <span className={`font-mono font-medium ${form.type === "credit" ? "text-emerald-fin" : "text-rose-fin"}`}>
                {form.type === "credit" ? "+" : "−"}{formatINR(Number(form.amount))}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3 animate-fade-in">
          {missingData && (
            <div className="flex items-center gap-2 bg-rose-fin-dim text-rose-fin text-xs px-3 py-2 rounded-lg">
              <AlertCircle size={13} className="flex-shrink-0" />
              Some fields couldn't be auto-detected — please fill them in before approving.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Date</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="input text-sm py-2" />
            </div>
            <div>
              <label className="label text-xs">Type</label>
              <select value={form.type} onChange={e => set("type", e.target.value)} className="select text-sm py-2">
                <option value="debit">Debit (expense)</option>
                <option value="credit">Credit (income)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Merchant name"
              className="input text-sm py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Amount (₹)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
                placeholder="0.00"
                className="input text-sm py-2"
              />
            </div>
            <div>
              <label className="label text-xs">Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className="select text-sm py-2">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Account</label>
            <input
              type="text"
              value={form.account}
              onChange={e => set("account", e.target.value)}
              placeholder="e.g. ICICI Credit Card"
              className="input text-sm py-2"
            />
          </div>

          {/* Raw email snippet for reference */}
          <details className="text-xs">
            <summary className="text-text-muted cursor-pointer hover:text-text-secondary">View raw email snippet</summary>
            <p className="text-text-muted mt-2 p-3 bg-navy-950 rounded-lg leading-relaxed">{email.raw_snippet}</p>
          </details>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleApprove}
              disabled={loading || missingData}
              className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 text-sm"
            >
              <Check size={14} /> Approve & Save
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="btn-danger flex items-center justify-center gap-1.5 py-2 text-sm px-4"
            >
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
