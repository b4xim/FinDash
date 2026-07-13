"use client";

// ============================================================
// Investing Page — holdings table, allocation pie, performance,
// add/edit/delete, "Refresh Prices" for auto-synced mutual
// funds (via MFapi.in) and stocks/ETFs (via Yahoo Finance),
// and a SIP Tracker section for recurring investment mandates.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import HoldingsTable from "@/components/investing/HoldingsTable";
import HoldingForm from "@/components/investing/HoldingForm";
import AllocationPieChart from "@/components/investing/AllocationPieChart";
import AIPortfolioAnalysis from "@/components/investing/AIPortfolioAnalysis";
import SipCard from "@/components/investing/SipCard";
import SipForm from "@/components/investing/SipForm";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Holding, SipEntry } from "@/types";
import {
  Plus, RefreshCw, TrendingUp, TrendingDown, Wallet,
  Repeat2, CalendarClock, IndianRupee,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

export default function InvestingPage() {
  // ── Holdings state ─────────────────────────────────────────
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);

  // ── SIP state ──────────────────────────────────────────────
  const [sips, setSips] = useState<SipEntry[]>([]);
  const [sipsLoading, setSipsLoading] = useState(true);
  const [sipFormLoading, setSipFormLoading] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const [showAddSipModal, setShowAddSipModal] = useState(false);
  const [editingSip, setEditingSip] = useState<SipEntry | null>(null);
  const [deletingSip, setDeletingSip] = useState<SipEntry | null>(null);

  // ── Fetch holdings ─────────────────────────────────────────
  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/holdings");
    const data = await res.json();
    setHoldings(data);
    setLoading(false);
  }, []);

  // ── Fetch SIPs ─────────────────────────────────────────────
  const fetchSips = useCallback(async () => {
    setSipsLoading(true);
    const res = await fetch("/api/sips");
    const data = await res.json();
    setSips(Array.isArray(data) ? data : []);
    setSipsLoading(false);
  }, []);

  useEffect(() => {
    fetchHoldings();
    fetchSips();
  }, [fetchHoldings, fetchSips]);

  // ── Holdings CRUD ──────────────────────────────────────────
  async function handleAdd(data: Partial<Holding>) {
    setFormLoading(true);
    const res = await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowAddModal(false); await fetchHoldings(); }
    setFormLoading(false);
  }

  async function handleEdit(data: Partial<Holding>) {
    if (!editingHolding) return;
    setFormLoading(true);
    const res = await fetch(`/api/holdings/${editingHolding.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditingHolding(null); await fetchHoldings(); }
    setFormLoading(false);
  }

  async function handleDelete() {
    if (!deletingHolding) return;
    await fetch(`/api/holdings/${deletingHolding.id}`, { method: "DELETE" });
    setDeletingHolding(null);
    await fetchHoldings();
  }

  async function handleRefreshPrices() {
    setRefreshing(true);
    setRefreshMsg(null);
    const res = await fetch("/api/holdings/refresh-prices", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setRefreshMsg(data.error || "Refresh failed");
    } else if (data.updated === 0 && data.failed === 0 && data.skipped === 0) {
      setRefreshMsg("No holdings linked for auto-sync yet — add a fund via search or a stock/ETF symbol");
    } else {
      const parts = [`Updated ${data.updated}`];
      if (data.failed > 0) parts.push(`${data.failed} failed`);
      setRefreshMsg(parts.join(", "));
    }

    await fetchHoldings();
    setRefreshing(false);
    setTimeout(() => setRefreshMsg(null), 6000);
  }

  // ── SIP CRUD ───────────────────────────────────────────────
  async function handleAddSip(data: Partial<SipEntry>) {
    setSipFormLoading(true);
    const res = await fetch("/api/sips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowAddSipModal(false); await fetchSips(); }
    setSipFormLoading(false);
  }

  async function handleEditSip(data: Partial<SipEntry>) {
    if (!editingSip) return;
    setSipFormLoading(true);
    const res = await fetch(`/api/sips/${editingSip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditingSip(null); await fetchSips(); }
    setSipFormLoading(false);
  }

  async function handleDeleteSip() {
    if (!deletingSip) return;
    await fetch(`/api/sips/${deletingSip.id}`, { method: "DELETE" });
    setDeletingSip(null);
    await fetchSips();
  }

  async function handleToggleSipActive(sip: SipEntry) {
    await fetch(`/api/sips/${sip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !sip.is_active }),
    });
    await fetchSips();
  }

  async function handleRecordInstallment(sip: SipEntry) {
    setRecordingId(sip.id);
    await fetch(`/api/sips/${sip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record_installment" }),
    });
    await fetchSips();
    setRecordingId(null);
  }

  // ── Derived totals: Holdings ───────────────────────────────
  const totalCurrentValue  = holdings.reduce((s, h) => s + h.units * h.current_price, 0);
  const totalInvestedValue = holdings.reduce((s, h) => s + h.units * h.buy_price, 0);
  const totalGainLoss      = totalCurrentValue - totalInvestedValue;
  const totalGainLossPct   = totalInvestedValue > 0 ? (totalGainLoss / totalInvestedValue) * 100 : 0;
  const isProfit = totalGainLoss >= 0;

  const allocationMap: Record<string, number> = {};
  holdings.forEach(h => {
    allocationMap[h.asset_type] = (allocationMap[h.asset_type] ?? 0) + h.units * h.current_price;
  });
  const allocationData = Object.entries(allocationMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const hasAutoSyncHoldings = holdings.some(
    h => h.mfapi_code || ((h.asset_type === "stock" || h.asset_type === "etf") && h.ticker)
  );

  // ── Derived totals: SIPs ───────────────────────────────────
  const activeSips          = sips.filter(s => s.is_active);
  const monthlyOutflow      = activeSips.reduce((sum, s) => {
    if (s.frequency === "monthly")   return sum + s.sip_amount;
    if (s.frequency === "weekly")    return sum + s.sip_amount * 4.33;
    if (s.frequency === "quarterly") return sum + s.sip_amount / 3;
    return sum;
  }, 0);
  const totalSipInvested    = sips.reduce((sum, s) => sum + s.total_invested, 0);

  return (
    <>
      <Header title="Investing" subtitle="Holdings, SIPs & allocation" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Total Value</p>
                <p className="stat-value mt-1">{formatINR(totalCurrentValue, true)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-violet">
                <Wallet size={20} className="text-[#FFFFFF]" />
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
                {isProfit
                  ? <TrendingUp size={20} className="text-emerald-fin" />
                  : <TrendingDown size={20} className="text-rose-fin" />}
              </div>
            </div>
          </div>
        </div>

        {/* ── Allocation + Holdings actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6">
            <p className="font-display font-medium text-text-primary mb-1">Allocation</p>
            <p className="text-text-muted text-sm mb-2">By asset type</p>
            <AllocationPieChart data={allocationData} />
          </div>

          <div className="lg:col-span-2 card p-6 flex flex-col">
            <p className="font-display font-medium text-text-primary mb-1">Holdings</p>
            <p className="text-text-muted text-sm mb-4">
              {holdings.length} holding{holdings.length !== 1 ? "s" : ""} tracked
              {hasAutoSyncHoldings && " · prices auto-sync"}
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
              auto-fetch their NAV from MFapi.in. Stocks and ETFs with an NSE symbol (e.g. RELIANCE.NS) auto-fetch
              their quote from Yahoo Finance. Both update together when you click Refresh Prices. FDs, PPF, and
              holdings without a linked symbol need their current price updated manually — edit the holding to update it.
            </p>
          </div>
        </div>

        {/* ── SIP Tracker section ─────────────────────────────── */}
        <div className="space-y-4">

          {/* SIP section header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-text-primary flex items-center gap-2">
                <Repeat2 size={18} className="text-violet-light" />
                SIP Tracker
              </h2>
              <p className="text-text-muted text-sm mt-0.5">
                Systematic Investment Plans — mutual funds, ETFs & stocks
              </p>
            </div>
            <button
              onClick={() => setShowAddSipModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Add SIP
            </button>
          </div>

          {/* SIP Summary stat cards */}
          {sips.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="stat-label text-xs">Monthly SIP Outflow</p>
                    <p className="text-xl font-display font-bold text-text-primary mt-1">
                      {formatINR(monthlyOutflow)}
                    </p>
                    <p className="text-text-muted text-xs mt-0.5">approx. per month</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet/20">
                    <IndianRupee size={17} className="text-violet-light" />
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="stat-label text-xs">Active SIPs</p>
                    <p className="text-xl font-display font-bold text-text-primary mt-1">
                      {activeSips.length}
                      <span className="text-text-muted text-sm font-normal ml-1.5">
                        of {sips.length}
                      </span>
                    </p>
                    <p className="text-text-muted text-xs mt-0.5">currently running</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-fin/15">
                    <Repeat2 size={17} className="text-emerald-fin" />
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="stat-label text-xs">Total Invested via SIPs</p>
                    <p className="text-xl font-display font-bold text-text-primary mt-1">
                      {formatINR(totalSipInvested, true)}
                    </p>
                    <p className="text-text-muted text-xs mt-0.5">across all mandates</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-500/15">
                    <CalendarClock size={17} className="text-cyan-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SIP grid or empty state */}
          {sipsLoading ? (
            <div className="card p-10 text-center text-text-muted">Loading SIPs...</div>
          ) : sips.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet/15 flex items-center justify-center mx-auto mb-4">
                <Repeat2 size={28} className="text-violet-light" />
              </div>
              <p className="text-text-secondary font-medium">No SIPs tracked yet</p>
              <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto">
                Add your first SIP mandate — mutual funds, ETFs, or stocks. Track your next installment date and total invested.
              </p>
              <button
                onClick={() => setShowAddSipModal(true)}
                className="btn-primary mt-5 inline-flex items-center gap-2"
              >
                <Plus size={16} /> Add your first SIP
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sips.map(sip => (
                <SipCard
                  key={sip.id}
                  sip={sip}
                  onEdit={setEditingSip}
                  onDelete={setDeletingSip}
                  onToggleActive={handleToggleSipActive}
                  onRecordInstallment={handleRecordInstallment}
                  recording={recordingId === sip.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── AI Portfolio Analyser ── */}
        <AIPortfolioAnalysis />

        {/* ── Holdings table ── */}
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

      {/* ── Holdings modals ── */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Holding">
        <HoldingForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={formLoading} />
      </Modal>

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

      <ConfirmDialog
        open={!!deletingHolding}
        title="Delete holding?"
        message={`This will permanently delete "${deletingHolding?.name}". This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeletingHolding(null)}
      />

      {/* ── SIP modals ── */}
      <Modal open={showAddSipModal} onClose={() => setShowAddSipModal(false)} title="Add SIP">
        <SipForm onSubmit={handleAddSip} onCancel={() => setShowAddSipModal(false)} loading={sipFormLoading} />
      </Modal>

      <Modal open={!!editingSip} onClose={() => setEditingSip(null)} title="Edit SIP">
        {editingSip && (
          <SipForm
            initial={editingSip}
            onSubmit={handleEditSip}
            onCancel={() => setEditingSip(null)}
            loading={sipFormLoading}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletingSip}
        title="Delete SIP?"
        message={`This will permanently remove the "${deletingSip?.name}" SIP mandate. Historical data will be lost.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteSip}
        onCancel={() => setDeletingSip(null)}
      />
    </>
  );
}
