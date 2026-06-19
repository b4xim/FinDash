"use client";

// ============================================================
// EmiLoanForm — Add / Edit a loan
// Auto-calculates EMI from principal, rate & tenure
// ============================================================

import { useState, useEffect } from "react";
import { EmiLoan, LoanType } from "@/types";
import { formatINR } from "@/lib/utils";

interface EmiLoanFormProps {
  initial?: EmiLoan;
  onSubmit: (data: Partial<EmiLoan>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: "home",      label: "🏠 Home Loan" },
  { value: "car",       label: "🚗 Car Loan" },
  { value: "personal",  label: "💳 Personal Loan" },
  { value: "education", label: "🎓 Education Loan" },
  { value: "other",     label: "📋 Other" },
];

/** Standard EMI formula: P × r(1+r)^n / ((1+r)^n − 1) */
function calcEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (!principal || !annualRate || !tenureMonths) return 0;
  const r = annualRate / 12 / 100;
  const n = tenureMonths;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function EmiLoanForm({ initial, onSubmit, onCancel, loading }: EmiLoanFormProps) {
  const [name, setName]               = useState(initial?.name ?? "");
  const [lender, setLender]           = useState(initial?.lender ?? "");
  const [loanType, setLoanType]       = useState<LoanType>(initial?.loan_type ?? "personal");
  const [principal, setPrincipal]     = useState(initial?.principal?.toString() ?? "");
  const [rate, setRate]               = useState(initial?.interest_rate?.toString() ?? "");
  const [tenure, setTenure]           = useState(initial?.tenure_months?.toString() ?? "");
  const [startDate, setStartDate]     = useState(initial?.start_date ?? new Date().toISOString().split("T")[0]);
  const [emiAmt, setEmiAmt]           = useState(initial?.emi_amount?.toString() ?? "");
  const [account, setAccount]         = useState(initial?.account ?? "");
  const [notes, setNotes]             = useState(initial?.notes ?? "");
  const [autoEmi, setAutoEmi]         = useState(!initial); // auto-compute by default for new loans

  // Auto-compute EMI whenever inputs change
  useEffect(() => {
    if (!autoEmi) return;
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const n = parseInt(tenure);
    if (p > 0 && r > 0 && n > 0) {
      setEmiAmt(calcEMI(p, r, n).toFixed(2));
    }
  }, [principal, rate, tenure, autoEmi]);

  const computedEmi = parseFloat(emiAmt) || 0;
  const totalPayable = computedEmi * parseInt(tenure || "0");
  const totalInterest = totalPayable - parseFloat(principal || "0");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      lender: lender || undefined,
      loan_type: loanType,
      principal: parseFloat(principal),
      interest_rate: parseFloat(rate),
      tenure_months: parseInt(tenure),
      start_date: startDate,
      emi_amount: parseFloat(emiAmt),
      account: account || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Name & Lender */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Loan Name *</label>
          <input className="input" placeholder="Home Loan - SBI" value={name}
            onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Lender</label>
          <input className="input" placeholder="SBI, HDFC…" value={lender}
            onChange={e => setLender(e.target.value)} />
        </div>
      </div>

      {/* Type & Start Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Loan Type *</label>
          <select className="select" value={loanType} onChange={e => setLoanType(e.target.value as LoanType)} required>
            {LOAN_TYPES.map(lt => (
              <option key={lt.value} value={lt.value}>{lt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">First EMI Date *</label>
          <input className="input" type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)} required />
        </div>
      </div>

      {/* Principal, Rate, Tenure */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Principal (₹) *</label>
          <input className="input" type="number" min="1" placeholder="2500000"
            value={principal} onChange={e => setPrincipal(e.target.value)} required />
        </div>
        <div>
          <label className="label">Interest Rate (% p.a.) *</label>
          <input className="input" type="number" step="0.01" min="0.01" placeholder="8.5"
            value={rate} onChange={e => setRate(e.target.value)} required />
        </div>
        <div>
          <label className="label">Tenure (months) *</label>
          <input className="input" type="number" min="1" max="600" placeholder="240"
            value={tenure} onChange={e => setTenure(e.target.value)} required />
        </div>
      </div>

      {/* EMI Amount */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label mb-0">Monthly EMI (₹) *</label>
          <button
            type="button"
            onClick={() => setAutoEmi(v => !v)}
            className="text-xs text-violet-light hover:underline"
          >
            {autoEmi ? "Enter manually" : "Auto-calculate"}
          </button>
        </div>
        <input
          className="input"
          type="number"
          min="1"
          placeholder="Auto-calculated"
          value={emiAmt}
          onChange={e => setEmiAmt(e.target.value)}
          readOnly={autoEmi}
          required
        />
        {/* Summary pill */}
        {computedEmi > 0 && parseInt(tenure) > 0 && parseFloat(principal) > 0 && (
          <div className="mt-2 flex gap-3 text-xs text-text-muted">
            <span>Total payable: <span className="text-text-secondary font-mono">{formatINR(totalPayable)}</span></span>
            <span>·</span>
            <span>Total interest: <span className="text-rose-400 font-mono">{formatINR(Math.max(0, totalInterest))}</span></span>
          </div>
        )}
      </div>

      {/* Account & Notes */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Debiting Account</label>
          <input className="input" placeholder="SBI Savings, HDFC…" value={account}
            onChange={e => setAccount(e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" placeholder="Optional notes" value={notes}
            onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving…" : initial ? "Save Changes" : "Add Loan"}
        </button>
      </div>
    </form>
  );
}
