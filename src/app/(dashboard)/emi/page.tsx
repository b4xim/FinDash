"use client";

// ============================================================
// EMI Tracker Page — /emi
// Summary stats + loan cards + add/edit/delete via modals
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import EmiLoanCard from "@/components/emi/EmiLoanCard";
import EmiLoanForm from "@/components/emi/EmiLoanForm";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { EmiLoan } from "@/types";
import { formatINR, cn } from "@/lib/utils";
import { Plus, Landmark, CheckCircle2, XCircle, TrendingDown } from "lucide-react";

// ── Amortization helpers (mirrored from EmiLoanCard) ──────────────────────

function paidMonths(startDate: string, tenure: number): number {
  const start = new Date(startDate);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return Math.min(Math.max(months, 0), tenure);
}

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
    balance -= emi - interest;
  }
  return Math.max(balance, 0);
}

// ─────────────────────────────────────────────────────────────

export default function EmiPage() {
  const [loans, setLoans]           = useState<EmiLoan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab]   = useState<"active" | "all">("active");

  // Modal state
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editingLoan, setEditingLoan]     = useState<EmiLoan | null>(null);
  const [deletingLoan, setDeletingLoan]   = useState<EmiLoan | null>(null);

  // Fetch loans
  const fetchLoans = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/emi-loans");
    const data = await res.json();
    setLoans(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  // Add
  async function handleAdd(data: Partial<EmiLoan>) {
    setFormLoading(true);
    const res = await fetch("/api/emi-loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowAddModal(false); await fetchLoans(); }
    setFormLoading(false);
  }

  // Edit
  async function handleEdit(data: Partial<EmiLoan>) {
    if (!editingLoan) return;
    setFormLoading(true);
    const res = await fetch(`/api/emi-loans/${editingLoan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditingLoan(null); await fetchLoans(); }
    setFormLoading(false);
  }

  // Toggle active / closed
  async function handleToggleActive(loan: EmiLoan) {
    await fetch(`/api/emi-loans/${loan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !loan.is_active }),
    });
    await fetchLoans();
  }

  // Delete
  async function handleDelete() {
    if (!deletingLoan) return;
    await fetch(`/api/emi-loans/${deletingLoan.id}`, { method: "DELETE" });
    setDeletingLoan(null);
    await fetchLoans();
  }

  // ── Derived stats ─────────────────────────────────────────
  const activeLoans  = loans.filter(l => l.is_active);
  const closedLoans  = loans.filter(l => !l.is_active);
  const displayLoans = activeTab === "active" ? activeLoans : loans;

  const totalMonthlyEmi = activeLoans.reduce((s, l) => s + Number(l.emi_amount), 0);
  const totalOutstanding = activeLoans.reduce((s, l) => {
    const paid = paidMonths(l.start_date, l.tenure_months);
    return s + outstandingBalance(l.principal, l.interest_rate, l.tenure_months, paid);
  }, 0);
  const totalPrincipal = activeLoans.reduce((s, l) => s + Number(l.principal), 0);

  // ── UI ───────────────────────────────────────────────────
  return (
    <>
      <Header title="EMI Tracker" subtitle="Loans & installment schedule" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Monthly EMI */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet/15 flex items-center justify-center flex-shrink-0">
              <Landmark size={18} className="text-violet-light" />
            </div>
            <div>
              <p className="stat-label">Monthly EMI</p>
              <p className="stat-value">{formatINR(totalMonthlyEmi)}</p>
              <p className="text-text-muted text-xs mt-0.5">{activeLoans.length} active loan{activeLoans.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Total Outstanding */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-400/10 flex items-center justify-center flex-shrink-0">
              <TrendingDown size={18} className="text-rose-400" />
            </div>
            <div>
              <p className="stat-label">Outstanding</p>
              <p className="stat-value text-rose-400">{formatINR(totalOutstanding)}</p>
              <p className="text-text-muted text-xs mt-0.5">across all active loans</p>
            </div>
          </div>

          {/* Active loans */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="stat-label">Active Loans</p>
              <p className="stat-value">{activeLoans.length}</p>
              <p className="text-text-muted text-xs mt-0.5">
                Principal: {formatINR(totalPrincipal, true)}
              </p>
            </div>
          </div>

          {/* Closed loans */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <XCircle size={18} className="text-text-muted" />
            </div>
            <div>
              <p className="stat-label">Closed Loans</p>
              <p className="stat-value">{closedLoans.length}</p>
              <p className="text-text-muted text-xs mt-0.5">fully repaid / inactive</p>
            </div>
          </div>

        </div>

        {/* ── Tab bar + Add button ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-surface-overlay p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "active"
                  ? "bg-violet/20 text-violet-light"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <CheckCircle2 size={14} /> Active ({activeLoans.length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "all"
                  ? "bg-violet/20 text-violet-light"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              All Loans ({loans.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Loan
          </button>
        </div>

        {/* ── Loan cards list ── */}
        {loading ? (
          <div className="card p-12 text-center text-text-muted animate-pulse">Loading loans…</div>
        ) : displayLoans.length === 0 ? (
          <div className="card p-12 text-center">
            <Landmark size={36} className="text-text-muted mx-auto mb-3" />
            <p className="font-display font-medium text-text-primary mb-1">No loans yet</p>
            <p className="text-text-muted text-sm mb-4">Add your first loan to start tracking EMIs.</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Add Loan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {displayLoans.map(loan => (
              <EmiLoanCard
                key={loan.id}
                loan={loan}
                onEdit={setEditingLoan}
                onDelete={setDeletingLoan}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}

      </main>

      {/* Add modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Loan" maxWidth="max-w-2xl">
        <EmiLoanForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={formLoading} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingLoan} onClose={() => setEditingLoan(null)} title="Edit Loan" maxWidth="max-w-2xl">
        {editingLoan && (
          <EmiLoanForm
            initial={editingLoan}
            onSubmit={handleEdit}
            onCancel={() => setEditingLoan(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletingLoan}
        title="Delete loan?"
        message={`This will permanently delete "${deletingLoan?.name}". This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeletingLoan(null)}
      />
    </>
  );
}
