"use client";

// ============================================================
// Goals Page — financial savings goals + emergency fund tracker
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import Modal from "@/components/ui/Modal";
import GoalForm from "@/components/goals/GoalForm";
import { FinancialGoal } from "@/types";
import { formatINR } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, CheckCircle2, Flag,
  Shield, TrendingUp, Trophy,
} from "lucide-react";

// Icon map — maps stored icon name to emoji
const ICON_MAP: Record<string, string> = {
  target: "🎯", plane: "✈️", home: "🏠", car: "🚗",
  "graduation-cap": "🎓", heart: "❤️", shield: "🛡️", gift: "🎁",
};

interface StatsSnap {
  emergencyMonths: number;
  avgMonthlySpend: number;
  netCash: number;
}

function daysUntil(deadline: string) {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return d;
}

function GoalProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 36; const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width="88" height="88" className="rotate-[-90deg]">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

export default function GoalsPage() {
  const [goals, setGoals]         = useState<FinancialGoal[]>([]);
  const [stats, setStats]         = useState<StatsSnap | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<FinancialGoal | null>(null);
  const [topUpGoal, setTopUpGoal] = useState<FinancialGoal | null>(null);
  const [topUpAmt, setTopUpAmt]   = useState("");
  const [saving, setSaving]       = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [gRes, sRes] = await Promise.all([fetch("/api/goals"), fetch("/api/stats")]);
    const gData = await gRes.json();
    const sData = await sRes.json();
    setGoals(Array.isArray(gData) ? gData : []);
    setStats({ emergencyMonths: sData.emergencyMonths ?? 0, avgMonthlySpend: sData.avgMonthlySpend ?? 0, netCash: sData.netCash ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(data: Partial<FinancialGoal>) {
    setSaving(true);
    if (editing) {
      await fetch(`/api/goals/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/goals", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
    }
    setSaving(false); setShowModal(false); setEditing(null); fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    fetchData();
  }

  async function handleComplete(goal: FinancialGoal) {
    await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !goal.completed }),
    });
    fetchData();
  }

  async function handleTopUp() {
    if (!topUpGoal || !topUpAmt) return;
    setSaving(true);
    const newSaved = topUpGoal.saved_amount + parseFloat(topUpAmt);
    await fetch(`/api/goals/${topUpGoal.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved_amount: newSaved, completed: newSaved >= topUpGoal.target_amount }),
    });
    setSaving(false); setTopUpGoal(null); setTopUpAmt(""); fetchData();
  }

  const active    = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

  // Emergency fund status
  const emMonths   = stats?.emergencyMonths ?? 0;
  const emTarget   = 6; // 6-month target
  const emPct      = Math.min((emMonths / emTarget) * 100, 100);
  const emColor    = emMonths >= emTarget ? "#10B981" : emMonths >= 3 ? "#F59E0B" : "#EF4444";
  const emLabel    = emMonths >= emTarget ? "Fully funded ✓" : emMonths >= 3 ? "Partially funded" : "Needs attention";

  return (
    <>
      <Header title="Goals" subtitle="Track savings goals & emergency fund" />

      <main className="flex-1 p-6 space-y-8 animate-fade-in">

        {/* ── Emergency Fund ── */}
        <div>
          <h2 className="font-display font-semibold text-text-primary text-lg mb-3 flex items-center gap-2">
            <Shield size={18} className="text-amber-400" /> Emergency Fund
          </h2>
          <div className="card p-6">
            <div className="flex flex-wrap items-center gap-8">
              {/* Ring */}
              <div className="relative flex-shrink-0">
                <GoalProgressRing pct={emPct} color={emColor} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-mono font-bold text-text-primary text-lg leading-none">{emMonths.toFixed(1)}</p>
                  <p className="text-text-muted text-[10px]">months</p>
                </div>
              </div>
              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-display font-semibold text-text-primary">{emLabel}</p>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${emPct}%`, background: emColor }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-text-muted text-xs">Net Cash Savings</p>
                    <p className="font-mono font-semibold text-text-primary">{formatINR(stats?.netCash ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Avg Monthly Spend</p>
                    <p className="font-mono font-semibold text-text-primary">{formatINR(stats?.avgMonthlySpend ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Target (6 months)</p>
                    <p className="font-mono font-semibold text-text-primary">{formatINR((stats?.avgMonthlySpend ?? 0) * 6)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Goals ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-text-primary text-lg flex items-center gap-2">
              <Flag size={18} className="text-violet-light" /> Savings Goals
            </h2>
            <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Goal
            </button>
          </div>

          {loading ? (
            <div className="card p-12 text-center text-text-muted animate-pulse">Loading...</div>
          ) : active.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-12 h-12 bg-violet/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={22} className="text-violet-light" />
              </div>
              <p className="text-text-secondary font-medium">No goals yet</p>
              <p className="text-text-muted text-sm mt-1 mb-4">Add a savings goal to start tracking your progress.</p>
              <button onClick={() => setShowModal(true)} className="btn-primary">Add First Goal</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {active.map(goal => {
                const pct = goal.target_amount > 0 ? (goal.saved_amount / goal.target_amount) * 100 : 0;
                const remaining = goal.target_amount - goal.saved_amount;
                const days = goal.deadline ? daysUntil(goal.deadline) : null;
                return (
                  <div key={goal.id} className="card p-5 flex flex-col gap-4 group">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{ICON_MAP[goal.icon] ?? "🎯"}</span>
                        <p className="font-medium text-text-primary">{goal.name}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(goal); setShowModal(true); }} className="p-1.5 rounded-lg text-text-muted hover:text-violet-light hover:bg-violet/10 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleComplete(goal)} className="p-1.5 rounded-lg text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"><CheckCircle2 size={13} /></button>
                        <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded-lg text-text-muted hover:text-rose-fin hover:bg-rose-fin/10 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>

                    {/* Ring + amounts */}
                    <div className="flex items-center gap-4">
                      <div className="relative flex-shrink-0">
                        <GoalProgressRing pct={pct} color={goal.color} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="font-bold text-text-primary text-sm leading-none">{pct.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-text-muted text-xs">Saved</p>
                        <p className="font-mono font-semibold text-text-primary">{formatINR(goal.saved_amount)}</p>
                        <p className="text-text-muted text-xs mt-1.5">Remaining</p>
                        <p className="font-mono text-text-secondary text-sm">{formatINR(Math.max(remaining, 0))}</p>
                      </div>
                    </div>

                    {/* Target + deadline */}
                    <div className="flex items-center justify-between text-xs text-text-muted border-t border-white/5 pt-3">
                      <span>Target: <span className="text-text-secondary font-mono">{formatINR(goal.target_amount)}</span></span>
                      {days !== null && (
                        <span className={days < 30 ? "text-amber-400" : ""}>
                          {days > 0 ? `${days}d left` : "Overdue"}
                        </span>
                      )}
                    </div>

                    {/* Top-up button */}
                    <button
                      onClick={() => { setTopUpGoal(goal); setTopUpAmt(""); }}
                      className="w-full py-1.5 rounded-xl text-xs font-medium border border-white/10 text-text-muted hover:border-violet/30 hover:text-violet-light hover:bg-violet/5 transition-all"
                    >
                      + Top Up
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Completed goals ── */}
        {completed.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-text-primary text-lg mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" /> Achieved
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {completed.map(goal => (
                <div key={goal.id} className="card p-4 flex items-center gap-3 opacity-70 group">
                  <span className="text-2xl">{ICON_MAP[goal.icon] ?? "🎯"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary text-sm">{goal.name}</p>
                    <p className="text-emerald-400 text-xs">✓ {formatINR(goal.target_amount)} reached</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleComplete(goal)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors text-xs">Reopen</button>
                    <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded-lg text-text-muted hover:text-rose-fin hover:bg-rose-fin/10 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Goal Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? "Edit Goal" : "New Savings Goal"}
      >
        <GoalForm
          initial={editing ?? undefined}
          onSubmit={handleSave}
          onCancel={() => { setShowModal(false); setEditing(null); }}
          loading={saving}
        />
      </Modal>

      {/* Top-up Modal */}
      {topUpGoal && (
        <Modal open={true} onClose={() => setTopUpGoal(null)} title={`Top Up — ${topUpGoal.name}`}>
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Current: <span className="font-mono font-medium text-text-primary">{formatINR(topUpGoal.saved_amount)}</span>
              {" / "}{formatINR(topUpGoal.target_amount)}
            </p>
            <div>
              <label className="label">Amount to Add (₹)</label>
              <input
                type="number"
                value={topUpAmt}
                onChange={e => setTopUpAmt(e.target.value)}
                placeholder="e.g. 5000"
                min="1"
                step="100"
                className="input"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setTopUpGoal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleTopUp} disabled={saving || !topUpAmt} className="btn-primary">
                {saving ? "Saving..." : "Add ₹" + (topUpAmt || "0")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
