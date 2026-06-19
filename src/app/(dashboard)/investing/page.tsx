"use client";

// ============================================================
// Investing Page — holdings table, allocation pie, performance,
// add/edit/delete, and "Refresh Prices" for auto-synced mutual funds
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import HoldingsTable from "@/components/investing/HoldingsTable";
import HoldingForm from "@/components/investing/HoldingForm";
import AllocationPieChart from "@/components/investing/AllocationPieChart";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Holding } from "@/types";
import { Plus, RefreshCw, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatINR } from "@/lib/utils";

export default function InvestingPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);

  // Fetch all holdings
  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/holdings");
    const data = await res.json();
    setHoldings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  // Add holding
  async function handleAdd(data: Partial<Holding>) {
    setFormLoading(true);
    const res = await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowAddModal(false);
      await fetchHoldings();
    }
    setFormLoading(false);
  }

  // Edit holding
  async function handleEdit(data: Partial<Holding>) {
    if (!editingHolding) return;
    setFormLoading(true);
    const res = await fetch(`/api/holdings/${editingHolding.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditingHolding(null);
      await fetchHoldings();
    }
    setFormLoading(false);
  }

  // Delete holding
  async function handleDelete() {
    if (!deletingHolding) return;
    await fetch(`/api/holdings/${deletingHolding.id}`, { method: "DELETE" });
    setDeletingHolding(null);
    await fetchHoldings();
  }

  // Refresh prices — calls MFapi.in via our backend for all linked mutual funds
  async function handleRefreshPrices() {
    setRefreshing(true);
    setRefreshMsg(null);
    const res = await fetch("/api/holdings/refresh-prices", { method: "POST" });
    const data = await res.json();

    if (data.updated === 0 && data.failed === 0) {
      setRefreshMsg("No mutual funds linked for auto-sync yet");
    } else {
      setRefreshMsg(`Updated ${data.updated} fund${data.updated !== 1 ? "s" : ""}${data.failed > 0 ? `, ${data.failed} failed` : ""}`);
    }

    await fetchHoldings();
    setRefreshing(false);
    setTimeout(() => setRefreshMsg(null), 5000);
  }

  // Derived totals
  const totalCurrentValue  = holdings.reduce((s, h) => s + h.units * h.current_price, 0);
  const totalInvestedValue = holdings.reduce((s, h) => s + h.units * h.buy_price, 0);
  const totalGainLoss      = totalCurrentValue - totalInvestedValue;
  const totalGainLossPct   = totalInvestedValue > 0 ? (totalGainLoss / totalInvestedValue) * 100 : 0;
  const isProfit = totalGainLoss >= 0;

  // Allocation by asset type
  const allocationMap: Record<string, number> = {};
  holdings.forEach(h => {
    allocationMap[h.asset_type] = (allocationMap[h.asset_type] ?? 0) + h.units * h.current_price;
  });
  const allocationData = Object.entries(allocationMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const hasMutualFunds = holdings.some(h => h.mfapi_code);

  return (
    <>
      <Header title="Investing" subtitle="Holdings & allocation" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Total Value</p>
                <p className="stat-value mt-1">{formatINR(totalCurrentValue, true)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-violet">
                <Wallet size={20} className="text-white" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Invested</p>
                <p className="stat-value mt-1">{formatINR(totalInvestedValue, true)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-overlay">
                <Wallet size={20} className="text-text-muted" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Total Gain/Loss</p>
                <p className={`stat-value mt-1 ${isProfit ? "text-emerald-fin" : "text-rose-fin"}`}>
                  {isProfit ? "+" : ""}{formatINR(totalGainLoss, true)}
                </p>
                <p className={`text-xs font-mono mt-1 ${isProfit ? "text-emerald-fin" : "text-rose-fin"}`}>
                  {isProfit ? "+" : ""}{totalGainLossPct.toFixed(1)}%
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isProfit ? "bg-emerald-fin/20" : "bg-rose-fin/20"}`}>
                {isProfit ? <TrendingUp size={20} className="text-emerald-fin" /> : <TrendingDown size={20} className="text-rose-fin" />}
              </div>
            </div>
          </div>
        </div>

        {/* Allocation + actions row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6">
            <p className="font-display font-medium text-text-primary mb-1">Allocation</p>
            <p className="text-text-muted text-sm mb-2">By asset type</p>
            <AllocationPieChart data={allocationData} />
          </div>

          {/* Actions panel */}
          <div className="lg:col-span-2 card p-6 flex flex-col">
            <p className="font-display font-medium text-text-primary mb-1">Holdings</p>
            <p className="text-text-muted text-sm mb-4">
              {holdings.length} holding{holdings.length !== 1 ? "s" : ""} tracked
              {hasMutualFunds && " · mutual fund NAVs auto-sync"}
            </p>

            <div className="flex flex-wrap gap-3 mt-auto">
              <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Add Holding
              </button>
              <button
                onClick={handleRefreshPrices}
                disabled={refreshing}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh Prices"}
              </button>
            </div>

            {refreshMsg && (
              <p className="text-text-secondary text-xs mt-3 animate-fade-in">{refreshMsg}</p>
            )}

            <p className="text-text-muted text-xs mt-4 leading-relaxed">
              <strong className="text-text-secondary">How prices work:</strong> Mutual funds linked via search
              auto-fetch their NAV from MFapi.in when you click Refresh Prices. Stocks, ETFs, FDs and PPF
              need their current price updated manually — edit the holding to update it.
            </p>
          </div>
        </div>

        {/* Holdings table */}
        {loading ? (
          <div className="card p-12 text-center text-text-muted">Loading holdings...</div>
        ) : (
          <HoldingsTable
            holdings={holdings}
            onEdit={setEditingHolding}
            onDelete={setDeletingHolding}
          />
        )}
      </main>

      {/* Add modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Holding">
        <HoldingForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={formLoading} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingHolding} onClose={() => setEditingHolding(null)} title="Edit Holding">
        {editingHolding && (
          <HoldingForm
            initial={editingHolding}
            onSubmit={handleEdit}
            onCancel={() => setEditingHolding(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingHolding}
        title="Delete holding?"
        message={`This will permanently delete "${deletingHolding?.name}". This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeletingHolding(null)}
      />
    </>
  );
}
