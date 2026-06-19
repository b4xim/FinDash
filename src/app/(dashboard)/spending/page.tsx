"use client";

// ============================================================
// Spending Page — transaction table, pie chart, trend chart,
// and add/edit/delete via modals
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import TransactionTable from "@/components/spending/TransactionTable";
import TransactionForm from "@/components/spending/TransactionForm";
import CategoryPieChart from "@/components/spending/CategoryPieChart";
import TrendBarChart from "@/components/spending/TrendBarChart";
import CreditCardsView from "@/components/spending/CreditCardsView";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Transaction } from "@/types";
import { Plus, List, CreditCard } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";

export default function SpendingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"transactions" | "cards">("transactions");

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [deletingTxn, setDeletingTxn] = useState<Transaction | null>(null);

  // Fetch all transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/transactions");
    const data = await res.json();
    setTransactions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Add transaction
  async function handleAdd(data: Partial<Transaction>) {
    setFormLoading(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowAddModal(false);
      await fetchTransactions();
    }
    setFormLoading(false);
  }

  // Edit transaction
  async function handleEdit(data: Partial<Transaction>) {
    if (!editingTxn) return;
    setFormLoading(true);
    const res = await fetch(`/api/transactions/${editingTxn.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditingTxn(null);
      await fetchTransactions();
    }
    setFormLoading(false);
  }

  // Delete transaction
  async function handleDelete() {
    if (!deletingTxn) return;
    await fetch(`/api/transactions/${deletingTxn.id}`, { method: "DELETE" });
    setDeletingTxn(null);
    await fetchTransactions();
  }

  // Derived data for charts (computed from current transactions list)
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthTxns = transactions.filter(t => t.date.startsWith(thisMonthStr));

  const categoryMap: Record<string, number> = {};
  thisMonthTxns.filter(t => t.type === "debit").forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] ?? 0) + Number(t.amount);
  });
  const pieData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Last 6 months trend, computed client-side from full transaction list
  const trendData = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "short" });
    const monthTxns = transactions.filter(t => t.date.startsWith(key));
    const spend  = monthTxns.filter(t => t.type === "debit").reduce((s, t) => s + Number(t.amount), 0);
    const income = monthTxns.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
    trendData.push({ month: label, spend, income });
  }

  const totalSpendThisMonth = thisMonthTxns.filter(t => t.type === "debit").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <>
      <Header title="Spending" subtitle="Transactions & categories" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* Top row: charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <p className="font-display font-medium text-text-primary mb-1">Monthly Trend</p>
            <p className="text-text-muted text-sm mb-2">Spending vs Income · last 6 months</p>
            <TrendBarChart data={trendData} />
          </div>

          <div className="card p-6">
            <div className="flex items-baseline justify-between mb-1">
              <p className="font-display font-medium text-text-primary">Categories</p>
              <p className="font-mono text-sm text-text-secondary">{formatINR(totalSpendThisMonth)}</p>
            </div>
            <p className="text-text-muted text-sm mb-2">This month's spend</p>
            <CategoryPieChart data={pieData} />
          </div>
        </div>

        {/* Transactions header + tab toggle + add button */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-surface-overlay p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("transactions")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "transactions"
                  ? "bg-violet/20 text-violet-light"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <List size={14} /> All Transactions
            </button>
            <button
              onClick={() => setActiveTab("cards")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "cards"
                  ? "bg-violet/20 text-violet-light"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <CreditCard size={14} /> Credit Cards
            </button>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Transaction
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "transactions" ? (
          loading ? (
            <div className="card p-12 text-center text-text-muted">Loading transactions...</div>
          ) : (
            <TransactionTable
              transactions={transactions}
              onEdit={setEditingTxn}
              onDelete={setDeletingTxn}
            />
          )
        ) : (
          <CreditCardsView />
        )}
      </main>

      {/* Add modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Transaction">
        <TransactionForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={formLoading} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingTxn} onClose={() => setEditingTxn(null)} title="Edit Transaction">
        {editingTxn && (
          <TransactionForm
            initial={editingTxn}
            onSubmit={handleEdit}
            onCancel={() => setEditingTxn(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingTxn}
        title="Delete transaction?"
        message={`This will permanently delete "${deletingTxn?.description}". This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeletingTxn(null)}
      />
    </>
  );
}
