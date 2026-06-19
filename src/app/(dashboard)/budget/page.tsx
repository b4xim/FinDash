"use client";

// ============================================================
// Budget Page — set monthly limits per category, view progress,
// and get alerted when you're nearing or over your cap
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import Modal from "@/components/ui/Modal";
import BudgetForm from "@/components/budget/BudgetForm";
import { BudgetLimit, Category } from "@/types";
import { formatINR } from "@/lib/utils";
import { CATEGORY_COLORS } from "@/lib/utils";
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Target } from "lucide-react";

// Current month spend per category from the stats API
interface CategorySpend { name: string; value: number }

function progressColor(pct: number, alertAt: number) {
  if (pct >= 100)      return "bg-rose-500";
  if (pct >= alertAt)  return "bg-amber-400";
  return "bg-emerald-400";
}

function statusBadge(pct: number, alertAt: number) {
  if (pct >= 100)     return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-medium">Over limit</span>;
  if (pct >= alertAt) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-medium">⚠ Near limit</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">On track</span>;
}

export default function BudgetPage() {
  const [limits, setLimits]           = useState<BudgetLimit[]>([]);
  const [spends, setSpends]           = useState<CategorySpend[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<BudgetLimit | null>(null);
  const [saving, setSaving]           = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [limRes, statRes] = await Promise.all([
      fetch("/api/budget-limits"),
      fetch("/api/stats"),
    ]);
    const limData  = await limRes.json();
    const statData = await statRes.json();
    setLimits(Array.isArray(limData) ? limData : []);
    setSpends(Array.isArray(statData.categoryBreakdown) ? statData.categoryBreakdown : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Save (add or edit)
  async function handleSave(data: Partial<BudgetLimit>) {
    setSaving(true);
    if (editing) {
      await fetch(`/api/budget-limits/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/budget-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setSaving(false);
    setShowModal(false);
    setEditing(null);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this budget limit?")) return;
    await fetch(`/api/budget-limits/${id}`, { method: "DELETE" });
    fetchData();
  }

  function openAdd()              { setEditing(null); setShowModal(true); }
  function openEdit(b: BudgetLimit) { setEditing(b);   setShowModal(true); }

  // Enrich limits with current spend data
  const enriched = limits.map(bl => {
    const spent = spends.find(s => s.name === bl.category)?.value ?? 0;
    const pct   = bl.monthly_limit > 0 ? (spent / bl.monthly_limit) * 100 : 0;
    return { ...bl, spent, pct };
  });

  const alerts   = enriched.filter(b => b.pct >= b.alert_at_pct);
  const existing = limits.map(l => l.category as string);

  return (
    <>
      <Header title="Budget" subtitle="Monthly limits per category" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ── Alert banner ── */}
        {alerts.length > 0 && (
          <div className="card p-4 border border-amber-400/20 bg-amber-400/5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-text-primary text-sm font-medium">Budget alerts this month</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {alerts.map(a => (
                    <span key={a.id} className="text-xs px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      {a.category}: {a.pct.toFixed(0)}% used
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Header row ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-text-primary">Category Limits</h2>
            <p className="text-text-muted text-sm mt-0.5">Resets on the 1st of each month</p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Set Budget
          </button>
        </div>

        {/* ── Budget cards ── */}
        {loading ? (
          <div className="card p-12 text-center text-text-muted animate-pulse">Loading...</div>
        ) : limits.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-12 h-12 bg-violet/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Target size={22} className="text-violet-light" />
            </div>
            <p className="text-text-secondary font-medium">No budget limits set</p>
            <p className="text-text-muted text-sm mt-1 mb-4">Set a monthly cap for a category to start tracking.</p>
            <button onClick={openAdd} className="btn-primary">Set First Budget</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enriched.map(bl => {
              const color = CATEGORY_COLORS[bl.category as Category] ?? "#8B5CF6";
              const clampedPct = Math.min(bl.pct, 100);
              return (
                <div key={bl.id} className="card p-5 flex flex-col gap-4 group">
                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <p className="font-medium text-text-primary text-sm">{bl.category}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(bl)} className="p-1.5 rounded-lg text-text-muted hover:text-violet-light hover:bg-violet/10 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(bl.id)} className="p-1.5 rounded-lg text-text-muted hover:text-rose-fin hover:bg-rose-fin/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-text-muted text-xs">Spent</p>
                      <p className="font-mono font-semibold text-text-primary text-xl">{formatINR(bl.spent)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-text-muted text-xs">Limit</p>
                      <p className="font-mono text-text-secondary">{formatINR(bl.monthly_limit)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${progressColor(bl.pct, bl.alert_at_pct)}`}
                        style={{ width: `${clampedPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      {statusBadge(bl.pct, bl.alert_at_pct)}
                      <span className="text-xs text-text-muted font-mono">{bl.pct.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Remaining = unset categories — show add prompt */}
            {existing.length < 7 && (
              <button
                onClick={openAdd}
                className="card p-5 border-dashed border-white/10 text-text-muted hover:text-text-secondary hover:border-violet/30 transition-all flex flex-col items-center justify-center gap-2 min-h-[160px]"
              >
                <Plus size={20} />
                <span className="text-sm">Add category budget</span>
              </button>
            )}
          </div>
        )}

        {/* Summary stats */}
        {enriched.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-text-muted text-xs">On Track</p>
                <p className="font-semibold text-text-primary">{enriched.filter(b => b.pct < b.alert_at_pct).length} categories</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div>
                <p className="text-text-muted text-xs">Near Limit</p>
                <p className="font-semibold text-text-primary">{enriched.filter(b => b.pct >= b.alert_at_pct && b.pct < 100).length} categories</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-rose-400" />
              </div>
              <div>
                <p className="text-text-muted text-xs">Over Limit</p>
                <p className="font-semibold text-text-primary">{enriched.filter(b => b.pct >= 100).length} categories</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? "Edit Budget Limit" : "Set Budget Limit"}
      >
        <BudgetForm
          initial={editing ?? undefined}
          onSubmit={handleSave}
          onCancel={() => { setShowModal(false); setEditing(null); }}
          loading={saving}
          existingCategories={existing}
        />
      </Modal>
    </>
  );
}
