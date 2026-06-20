"use client";

// ============================================================
// EmiLoanCard — Displays a single EMI loan with full details,
// progress bar, and edit / delete / toggle-active actions
// ============================================================

import { EmiLoan, LoanType } from "@/types";
import { formatINR, formatDate } from "@/lib/utils";
import { Pencil, Trash2, CheckCircle2, PauseCircle } from "lucide-react";
import EmiProgressChart from "./EmiProgressChart";
import { cn } from "@/lib/utils";

interface EmiLoanCardProps {
  loan: EmiLoan;
  onEdit: (loan: EmiLoan) => void;
  onDelete: (loan: EmiLoan) => void;
  onToggleActive: (loan: EmiLoan) => void;
}

const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  phone:       "📱 Phone",
  laptop:      "💻 Laptop",
  appliance:   "🏠 Appliance",
  gadget:      "🎧 Gadget",
  credit_card: "💳 Credit Card",
  bike:        "🛵 Bike",
  car:         "🚗 Car",
  furniture:   "🪑 Furniture",
  other:       "📋 Other",
};

const LOAN_TYPE_COLORS: Record<LoanType, string> = {
  phone:       "bg-violet/15 text-violet-light",
  laptop:      "bg-sky-500/15 text-sky-400",
  appliance:   "bg-amber-500/15 text-amber-400",
  gadget:      "bg-cyan-500/15 text-cyan-400",
  credit_card: "bg-rose-500/15 text-rose-400",
  bike:        "bg-orange-500/15 text-orange-400",
  car:         "bg-amber-500/15 text-amber-400",
  furniture:   "bg-emerald-500/15 text-emerald-400",
  other:       "bg-white/10 text-text-secondary",
};

/** Compute months elapsed since start_date (capped at tenure) */
function paidMonths(startDate: string, tenure: number): number {
  const start = new Date(startDate);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return Math.min(Math.max(months, 0), tenure);
}

/** Outstanding balance via amortization */
function outstandingBalance(
  principal: number,
  annualRate: number,
  tenure: number,
  paid: number
): number {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal - (principal / tenure) * paid;
  const emi = (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
  let balance = principal;
  for (let i = 0; i < paid; i++) {
    const interest = balance * r;
    const principalPart = emi - interest;
    balance -= principalPart;
  }
  return Math.max(balance, 0);
}

export default function EmiLoanCard({ loan, onEdit, onDelete, onToggleActive }: EmiLoanCardProps) {
  const paid = paidMonths(loan.start_date, loan.tenure_months);
  const remaining = loan.tenure_months - paid;
  const outstanding = outstandingBalance(loan.principal, loan.interest_rate, loan.tenure_months, paid);
  const totalInterest = loan.emi_amount * loan.tenure_months - loan.principal;
  const endDate = new Date(loan.start_date);
  endDate.setMonth(endDate.getMonth() + loan.tenure_months - 1);

  return (
    <div
      className={cn(
        "card p-5 transition-all duration-300 hover:border-violet/25 hover:-translate-y-0.5",
        !loan.is_active && "opacity-60"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Progress ring */}
          <div className="flex-shrink-0">
            <EmiProgressChart paidMonths={paid} totalMonths={loan.tenure_months} size={72} strokeWidth={7} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display font-semibold text-text-primary truncate">{loan.name}</p>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", LOAN_TYPE_COLORS[loan.loan_type])}>
                {LOAN_TYPE_LABELS[loan.loan_type]}
              </span>
              {loan.is_no_cost_emi && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-fin/15 text-emerald-fin flex-shrink-0">
                  ✦ No-Cost EMI
                </span>
              )}
              {!loan.is_active && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-text-muted">Closed</span>
              )}
            </div>
            {loan.lender && (
              <p className="text-text-muted text-sm mt-0.5">{loan.lender}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onToggleActive(loan)}
            title={loan.is_active ? "Mark as Closed" : "Mark as Active"}
            className="p-1.5 rounded-lg text-text-muted hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
          >
            {loan.is_active ? <CheckCircle2 size={15} /> : <PauseCircle size={15} />}
          </button>
          <button
            onClick={() => onEdit(loan)}
            className="p-1.5 rounded-lg text-text-muted hover:text-violet-light hover:bg-violet/10 transition-all"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(loan)}
            className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-all"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface-overlay rounded-xl p-3">
          <p className="stat-label text-[10px] mb-1">Monthly EMI</p>
          <p className="font-mono font-semibold text-text-primary text-sm">{formatINR(loan.emi_amount)}</p>
        </div>
        <div className="bg-surface-overlay rounded-xl p-3">
          <p className="stat-label text-[10px] mb-1">Outstanding</p>
          <p className="font-mono font-semibold text-rose-400 text-sm">{formatINR(outstanding)}</p>
        </div>
        <div className="bg-surface-overlay rounded-xl p-3">
          <p className="stat-label text-[10px] mb-1">Interest Rate</p>
          <p className="font-mono font-semibold text-sm"
             style={{ color: loan.is_no_cost_emi ? "#10D98C" : undefined }}
          >
            {loan.is_no_cost_emi ? "0% (No-Cost)" : `${loan.interest_rate}% p.a.`}
          </p>
        </div>
        <div className="bg-surface-overlay rounded-xl p-3">
          <p className="stat-label text-[10px] mb-1">Total Interest</p>
          <p className="font-mono font-semibold text-amber-400 text-sm">{formatINR(Math.max(0, totalInterest))}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs text-text-muted">
          <span>{paid} EMIs paid</span>
          <span>{remaining > 0 ? `${remaining} remaining` : "Loan completed"}</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min((paid / loan.tenure_months) * 100, 100)}%`,
              background: paid / loan.tenure_months >= 0.75
                ? "#10D98C"
                : paid / loan.tenure_months >= 0.4
                ? "#F5A623"
                : "#7C5CFC",
            }}
          />
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-white/5">
        <span>Principal: <span className="text-text-secondary font-mono">{formatINR(loan.principal)}</span></span>
        <span>
          {formatDate(loan.start_date)} → {endDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
