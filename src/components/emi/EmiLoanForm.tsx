"use client";

// ============================================================
// EmiLoanForm — Add / Edit a loan / EMI
// - Tech-product focused loan types (phone, laptop, gadget…)
// - No-Cost EMI toggle: sets rate to 0%, splits principal evenly
// - Auto-calculates EMI from principal, rate & tenure
// ============================================================

import { useState, useEffect } from "react";
import { EmiLoan, LoanType } from "@/types";
import { formatINR } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface EmiLoanFormProps {
  initial?: EmiLoan;
  onSubmit: (data: Partial<EmiLoan>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: "phone",       label: "📱 Phone" },
  { value: "laptop",      label: "💻 Laptop / Tablet" },
  { value: "appliance",   label: "🏠 Home Appliance" },
  { value: "gadget",      label: "🎧 Gadget / Electronics" },
  { value: "credit_card", label: "💳 Credit Card EMI" },
  { value: "bike",        label: "🛵 Bike / Scooter" },
  { value: "car",         label: "🚗 Car" },
  { value: "furniture",   label: "🪑 Furniture" },
  { value: "other",       label: "📋 Other" },
];

const LENDER_OPTIONS = [
  "Bajaj Finance",
  "Amazon Pay Later",
  "Flipkart Pay Later",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "SBI Card",
  "Kotak Bank",
  "ZestMoney",
  "CASHe",
  "PaySense",
  "Other",
];

/** Standard EMI formula: P × r(1+r)^n / ((1+r)^n − 1) */
function calcEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate || annualRate === 0) return principal / tenureMonths; // no-cost / 0% interest
  const r = annualRate / 12 / 100;
  const n = tenureMonths;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function EmiLoanForm({ initial, onSubmit, onCancel, loading }: EmiLoanFormProps) {
  const [name, setName]             = useState(initial?.name ?? "");
  const [lender, setLender]         = useState(initial?.lender ?? "");
  const [loanType, setLoanType]     = useState<LoanType>(initial?.loan_type ?? "phone");
  const [principal, setPrincipal]   = useState(initial?.principal?.toString() ?? "");
  const [rate, setRate]             = useState(initial?.interest_rate?.toString() ?? "");
  const [tenure, setTenure]         = useState(initial?.tenure_months?.toString() ?? "");
  const [startDate, setStartDate]   = useState(initial?.start_date ?? new Date().toISOString().split("T")[0]);
  const [emiAmt, setEmiAmt]         = useState(initial?.emi_amount?.toString() ?? "");
  const [account, setAccount]       = useState(initial?.account ?? "");
  const [notes, setNotes]           = useState(initial?.notes ?? "");
  const [autoEmi, setAutoEmi]       = useState(!initial);
  const [isNoCost, setIsNoCost]     = useState(initial?.is_no_cost_emi ?? false);

  // When no-cost EMI is toggled on, force rate to 0
  useEffect(() => {
    if (isNoCost) setRate("0");
  }, [isNoCost]);

  // Auto-compute EMI whenever inputs change
  useEffect(() => {
    if (!autoEmi) return;
    const p = parseFloat(principal);
    const r = isNoCost ? 0 : parseFloat(rate);
    const n = parseInt(tenure);
    if (p > 0 && n > 0 && (isNoCost || r >= 0)) {
      setEmiAmt(calcEMI(p, r, n).toFixed(2));
    }
  }, [principal, rate, tenure, autoEmi, isNoCost]);

  const computedEmi    = parseFloat(emiAmt) || 0;
  const tenureNum      = parseInt(tenure || "0");
  const principalNum   = parseFloat(principal || "0");
  const totalPayable   = computedEmi * tenureNum;
  const totalInterest  = totalPayable - principalNum;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      lender: lender || undefined,
      loan_type: loanType,
      principal: parseFloat(principal),
      interest_rate: isNoCost ? 0 : parseFloat(rate),
      tenure_months: parseInt(tenure),
      start_date: startDate,
      emi_amount: parseFloat(emiAmt),
      account: account || undefined,
      notes: notes || undefined,
      is_no_cost_emi: isNoCost,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── No-Cost EMI banner toggle ── */}
      <div
        onClick={() => setIsNoCost(v => !v)}
        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none ${
          isNoCost
            ? "border-emerald-fin/40 bg-emerald-fin/8"
            : "border-white/10 bg-surface-overlay hover:border-white/20"
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          isNoCost ? "bg-emerald-fin/20" : "bg-white/5"
        }`}>
          <Sparkles size={15} className={isNoCost ? "text-emerald-fin" : "text-text-muted"} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isNoCost ? "text-emerald-fin" : "text-text-secondary"}`}>
            No-Cost EMI
          </p>
          <p className="text-text-muted text-xs">0% interest — principal split evenly across tenure</p>
        </div>
        {/* Toggle pill */}
        <div className={`w-10 h-5 rounded-full flex items-center transition-all duration-200 flex-shrink-0 ${
          isNoCost ? "bg-emerald-fin justify-end" : "bg-white/10 justify-start"
        }`}>
          <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm" />
        </div>
      </div>

      {/* Name & Lender */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Item / Loan Name *</label>
          <input className="input" placeholder="iPhone 15 Pro, MacBook Air…" value={name}
            onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Lender / Provider</label>
          <select
            className="select"
            value={LENDER_OPTIONS.includes(lender) ? lender : "Other"}
            onChange={e => {
              if (e.target.value === "Other") setLender("");
              else setLender(e.target.value);
            }}
          >
            {LENDER_OPTIONS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {/* Show free-text if "Other" is selected */}
          {(!LENDER_OPTIONS.includes(lender) || lender === "") && (
            <input
              className="input mt-1.5 text-sm"
              placeholder="Type lender name…"
              value={lender}
              onChange={e => setLender(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Type & Start Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category *</label>
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
      <div className={`grid gap-3 ${isNoCost ? "grid-cols-2" : "grid-cols-3"}`}>
        <div>
          <label className="label">Product Price (₹) *</label>
          <input className="input" type="number" min="1" placeholder="49999"
            value={principal} onChange={e => setPrincipal(e.target.value)} required />
        </div>
        {!isNoCost && (
          <div>
            <label className="label">Interest Rate (% p.a.) *</label>
            <input className="input" type="number" step="0.01" min="0" placeholder="14"
              value={rate} onChange={e => setRate(e.target.value)} required />
          </div>
        )}
        <div>
          <label className="label">Tenure (months) *</label>
          <input className="input" type="number" min="1" max="60" placeholder="12"
            value={tenure} onChange={e => setTenure(e.target.value)} required />
        </div>
      </div>

      {/* EMI Amount */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label mb-0">
            Monthly EMI (₹) *
            {isNoCost && (
              <span className="text-emerald-fin text-xs font-normal ml-1.5">— 0% interest</span>
            )}
          </label>
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
        {/* Summary */}
        {computedEmi > 0 && tenureNum > 0 && principalNum > 0 && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
            <span>Total payable: <span className="text-text-secondary font-mono">{formatINR(totalPayable)}</span></span>
            <span>·</span>
            {isNoCost ? (
              <span className="text-emerald-fin font-medium">✓ No interest charged</span>
            ) : (
              <span>Total interest: <span className="text-rose-400 font-mono">{formatINR(Math.max(0, totalInterest))}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Account & Notes */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Card / Account Used</label>
          <input className="input" placeholder="HDFC Millennia, Axis Flipkart…" value={account}
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
          {loading ? "Saving…" : initial ? "Save Changes" : "Add EMI"}
        </button>
      </div>
    </form>
  );
}
