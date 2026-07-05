"use client";

// ============================================================
// Lending Page — /lending
// Track money lent to and borrowed from people
// Summary stats + entry cards + add/edit/settle/delete modals
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import LendingEntryCard from "@/components/lending/LendingEntryCard";
import LendingForm from "@/components/lending/LendingForm";
import SettleForm from "@/components/lending/SettleForm";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { LendingEntry } from "@/types";
import { formatINR, cn } from "@/lib/utils";
import {
  Plus, ArrowUpRight, ArrowDownLeft,
  Scale, AlertTriangle, Users,
} from "lucide-react";

export default function LendingPage() {
  const [entries, setEntries]       = useState<LendingEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab]   = useState<"all" | "lent" | "borrowed">("all");

  // Modal state
  const [showAddModal, setShowAddModal]     = useState(false);
  const [editingEntry, setEditingEntry]     = useState<LendingEntry | null>(null);
  const [settlingEntry, setSettlingEntry]   = useState<LendingEntry | null>(null);
  const [deletingEntry, setDeletingEntry]   = useState<LendingEntry | null>(null);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/lendings");
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Add
  async function handleAdd(data: Partial<LendingEntry>) {
    setFormLoading(true);
    const res = await fetch("/api/lendings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowAddModal(false); await fetchEntries(); }
    setFormLoading(false);
  }

  // Edit
  async function handleEdit(data: Partial<LendingEntry>) {
    if (!editingEntry) return;
    setFormLoading(true);
    const res = await fetch(`/api/lendings/${editingEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditingEntry(null); await fetchEntries(); }
    setFormLoading(false);
  }

  // Settle
  async function handleSettle(newSettledAmount: number, isFullySettled: boolean) {
    if (!settlingEntry) return;
    setFormLoading(true);
    const res = await fetch(`/api/lendings/${settlingEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settled_amount: newSettledAmount,
        status: isFullySettled ? "settled" : "partially_settled",
      }),
    });
    if (res.ok) { setSettlingEntry(null); await fetchEntries(); }
    setFormLoading(false);
  }

  // Delete
  async function handleDelete() {
    if (!deletingEntry) return;
    await fetch(`/api/lendings/${deletingEntry.id}`, { method: "DELETE" });
    setDeletingEntry(null);
    await fetchEntries();
  }

  // ── Derived stats ─────────────────────────────────────────
  const pendingEntries = entries.filter(e => e.status !== "settled");

  const totalLent     = pendingEntries.filter(e => e.direction === "lent").reduce((s, e) => s + (Number(e.amount) - Number(e.settled_amount)), 0);
  const totalBorrowed = pendingEntries.filter(e => e.direction === "borrowed").reduce((s, e) => s + (Number(e.amount) - Number(e.settled_amount)), 0);
  const netBalance    = totalLent - totalBorrowed; // Positive = others owe you more
  const overdueCount  = pendingEntries.filter(e => e.due_date && new Date(e.due_date) < new Date()).length;
  const uniquePeople  = new Set(pendingEntries.map(e => e.person)).size;

  // Filter by tab
  const displayEntries = activeTab === "all"
    ? entries
    : entries.filter(e => e.direction === activeTab);

  // ── UI ───────────────────────────────────────────────────
  return (
    <>
      <Header title="Lending" subtitle="Track money lent & borrowed" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

          {/* You're Owed (Lent out, pending) */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-400/10 flex items-center justify-center flex-shrink-0">
              <ArrowUpRight size={18} className="text-rose-400" />
            </div>
            <div>
              <p className="stat-label">You&apos;re Owed</p>
              <p className="stat-value text-rose-400">{formatINR(totalLent)}</p>
              <p className="text-text-muted text-xs mt-0.5">money you lent out</p>
            </div>
          </div>

          {/* You Owe (Borrowed, pending) */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <ArrowDownLeft size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="stat-label">You Owe</p>
              <p className="stat-value text-emerald-400">{formatINR(totalBorrowed)}</p>
              <p className="text-text-muted text-xs mt-0.5">money you borrowed</p>
            </div>
          </div>

          {/* Net Balance */}
          <div className="card p-5 flex items-start gap-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              netBalance >= 0 ? "bg-emerald-500/10" : "bg-rose-400/10"
            )}>
              <Scale size={18} className={netBalance >= 0 ? "text-emerald-400" : "text-rose-400"} />
            </div>
            <div>
              <p className="stat-label">Net Balance</p>
              <p className={cn("stat-value", netBalance >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {netBalance >= 0 ? "+" : "-"}{formatINR(Math.abs(netBalance))}
              </p>
              <p className="text-text-muted text-xs mt-0.5">
                {netBalance >= 0 ? "others owe you more" : "you owe more"}
              </p>
            </div>
          </div>

          {/* Overdue */}
          <div className="card p-5 flex items-start gap-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              overdueCount > 0 ? "bg-amber-400/10" : "bg-white/5"
            )}>
              <AlertTriangle size={18} className={overdueCount > 0 ? "text-amber-400" : "text-text-muted"} />
            </div>
            <div>
              <p className="stat-label">Overdue</p>
              <p className="stat-value">{overdueCount}</p>
              <p className="text-text-muted text-xs mt-0.5">past due date</p>
            </div>
          </div>

          {/* People */}
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet/15 flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-violet-light" />
            </div>
            <div>
              <p className="stat-label">People</p>
              <p className="stat-value">{uniquePeople}</p>
              <p className="text-text-muted text-xs mt-0.5">with pending entries</p>
            </div>
          </div>
        </div>

        {/* ── Tab bar + Add button ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-surface-overlay p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "all"
                  ? "bg-violet/20 text-violet-light"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              All ({entries.length})
            </button>
            <button
              onClick={() => setActiveTab("lent")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "lent"
                  ? "bg-rose-400/15 text-rose-400"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <ArrowUpRight size={14} /> Lent ({entries.filter(e => e.direction === "lent").length})
            </button>
            <button
              onClick={() => setActiveTab("borrowed")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "borrowed"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <ArrowDownLeft size={14} /> Borrowed ({entries.filter(e => e.direction === "borrowed").length})
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Entry
          </button>
        </div>

        {/* ── Entry cards ── */}
        {loading ? (
          <div className="card p-12 text-center text-text-muted animate-pulse">Loading entries…</div>
        ) : displayEntries.length === 0 ? (
          <div className="card p-12 text-center">
            <Scale size={36} className="text-text-muted mx-auto mb-3" />
            <p className="font-display font-medium text-text-primary mb-1">No lending entries yet</p>
            <p className="text-text-muted text-sm mb-4">
              Start tracking money you lend to or borrow from people.
            </p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Add Entry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {displayEntries.map(entry => (
              <LendingEntryCard
                key={entry.id}
                entry={entry}
                onEdit={setEditingEntry}
                onDelete={setDeletingEntry}
                onSettle={setSettlingEntry}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Lending Entry">
        <LendingForm onSubmit={handleAdd} onCancel={() => setShowAddModal(false)} loading={formLoading} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingEntry} onClose={() => setEditingEntry(null)} title="Edit Entry">
        {editingEntry && (
          <LendingForm
            initial={editingEntry}
            onSubmit={handleEdit}
            onCancel={() => setEditingEntry(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Settle modal */}
      <Modal open={!!settlingEntry} onClose={() => setSettlingEntry(null)} title="Record Settlement">
        {settlingEntry && (
          <SettleForm
            entry={settlingEntry}
            onSubmit={handleSettle}
            onCancel={() => setSettlingEntry(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingEntry}
        title="Delete entry?"
        message={`This will permanently delete the ${deletingEntry?.direction === "lent" ? "loan to" : "borrowing from"} "${deletingEntry?.person}". This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeletingEntry(null)}
      />
    </>
  );
}
