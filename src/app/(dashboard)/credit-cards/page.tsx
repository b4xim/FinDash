"use client";

// ============================================================
// Credit Cards Page (/credit-cards)
// Shows billing statements for all 7 credit cards fetched from
// Gmail. Displays a top banner, summary card row, and table.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import CardArtwork from "@/components/credit-cards/CardArtwork";
import {
  RefreshCw, Loader2, AlertTriangle, CheckCircle2,
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink,
  Wallet, Clock,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import {
  getCardConfig,
  getDueUrgency,
  getUrgencyClasses,
  formatDaysLeft,
  CREDIT_CARD_CONFIGS,
} from "@/lib/creditCardConfig";
import { CreditCardBill, CreditCardStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

// ── Status badge (tappable) ───────────────────────────────────
function StatusBadge({
  bill,
  onStatusChange,
}: {
  bill: CreditCardBill;
  onStatusChange: (id: string, status: CreditCardStatus) => void;
}) {
  const [loading, setLoading] = useState(false);

  const STATUS_CYCLE: Record<CreditCardStatus, CreditCardStatus> = {
    Unpaid:  "Paid",
    Paid:    "Overdue",
    Overdue: "Unpaid",
  };

  const STATUS_STYLES: Record<CreditCardStatus, string> = {
    Unpaid:  "bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/20",
    Paid:    "bg-emerald-fin-dim text-emerald-fin border-emerald-fin/30 hover:bg-emerald-fin/20",
    Overdue: "bg-rose-fin-dim text-rose-fin border-rose-fin/30 hover:bg-rose-fin/20",
  };

  async function handleClick() {
    const nextStatus = STATUS_CYCLE[bill.status];
    setLoading(true);
    // Optimistic update
    onStatusChange(bill.id, nextStatus);

    try {
      const res = await fetch("/api/credit-cards/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bill.id, status: nextStatus }),
      });
      if (!res.ok) {
        // Rollback optimistic update on failure
        onStatusChange(bill.id, bill.status);
      }
    } catch {
      onStatusChange(bill.id, bill.status);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`text-xs font-mono font-medium px-2.5 py-1 rounded-full border transition-all duration-200 active:scale-95 disabled:opacity-50 ${STATUS_STYLES[bill.status]}`}
      title="Tap to cycle status"
    >
      {loading ? <Loader2 size={10} className="animate-spin inline" /> : bill.status}
    </button>
  );
}

// ── Status dropdown (for table) ───────────────────────────────
function StatusDropdown({
  bill,
  onStatusChange,
}: {
  bill: CreditCardBill;
  onStatusChange: (id: string, status: CreditCardStatus) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as CreditCardStatus;
    setLoading(true);
    onStatusChange(bill.id, newStatus);
    try {
      const res = await fetch("/api/credit-cards/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bill.id, status: newStatus }),
      });
      if (!res.ok) {
        onStatusChange(bill.id, bill.status);
      }
    } catch {
      onStatusChange(bill.id, bill.status);
    } finally {
      setLoading(false);
    }
  }

  const STATUS_SELECT_STYLES: Record<CreditCardStatus, string> = {
    Unpaid:  "text-amber-400",
    Paid:    "text-emerald-fin",
    Overdue: "text-rose-fin",
  };

  return (
    <select
      value={bill.status}
      onChange={handleChange}
      disabled={loading}
      className={`bg-transparent border-none text-xs font-mono font-medium cursor-pointer focus:outline-none disabled:opacity-50 ${STATUS_SELECT_STYLES[bill.status]}`}
    >
      <option value="Unpaid"  className="text-text-primary bg-surface-overlay">Unpaid</option>
      <option value="Paid"    className="text-text-primary bg-surface-overlay">Paid</option>
      <option value="Overdue" className="text-text-primary bg-surface-overlay">Overdue</option>
    </select>
  );
}

// ── Summary Banner ────────────────────────────────────────────
function BillSummaryBanner({ bills }: { bills: CreditCardBill[] }) {
  const unpaidBills = bills.filter(b => b.status !== "Paid");
  const totalOutstanding = unpaidBills.reduce((s, b) => s + Number(b.total_amount_due), 0);
  const totalMinDue = unpaidBills.reduce((s, b) => s + Number(b.minimum_due), 0);
  const overdueCount = bills.filter(b => b.status === "Overdue").length;
  const paidCount = bills.filter(b => b.status === "Paid").length;

  return (
    <div className="card p-6 bg-gradient-to-br from-violet/10 to-transparent border-violet/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex-1">
          <p className="stat-label">Total Outstanding</p>
          <p className="font-display font-bold text-3xl text-text-primary mt-1">
            {formatINR(totalOutstanding)}
          </p>
          <p className="text-text-muted text-sm mt-1">
            across {unpaidBills.length} unpaid card{unpaidBills.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="bg-surface-overlay rounded-xl px-4 py-3 min-w-[120px]">
            <p className="stat-label">Minimum Due</p>
            <p className="font-mono font-semibold text-amber-400 text-lg mt-0.5">
              {formatINR(totalMinDue)}
            </p>
          </div>

          {overdueCount > 0 && (
            <div className="bg-rose-fin-dim border border-rose-fin/20 rounded-xl px-4 py-3">
              <p className="stat-label text-rose-fin/70">Overdue</p>
              <p className="font-mono font-bold text-rose-fin text-lg mt-0.5">
                {overdueCount} card{overdueCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          {paidCount > 0 && (
            <div className="bg-emerald-fin-dim border border-emerald-fin/30 rounded-xl px-4 py-3">
              <p className="stat-label text-emerald-fin/70">Paid</p>
              <p className="font-mono font-bold text-emerald-fin text-lg mt-0.5">
                {paidCount} card{paidCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single Summary Card ───────────────────────────────────────
function CreditCardSummaryCard({
  bill,
  onStatusChange,
}: {
  bill: CreditCardBill;
  onStatusChange: (id: string, status: CreditCardStatus) => void;
}) {
  const config = getCardConfig(bill.card_name);
  const urgency = getDueUrgency(bill.due_date);
  const urgencyClasses = getUrgencyClasses(urgency);
  const daysLeft = formatDaysLeft(bill.due_date);
  const bankColor = config?.bankColor ?? "#4A5270";

  return (
    <div
      className="card flex-shrink-0 w-64 p-5 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{ borderBottomColor: bankColor, borderBottomWidth: "3px" }}
    >
      {/* Card header: artwork + name */}
      <div className="flex items-center gap-3">
        <CardArtwork cardName={bill.card_name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-medium text-text-primary text-sm leading-snug truncate">
            {config?.shortName ?? bill.card_name}
          </p>
          <p className="text-text-muted text-xs mt-0.5">{config?.bankName ?? ""}</p>
        </div>
        <StatusBadge bill={bill} onStatusChange={onStatusChange} />
      </div>

      {/* Amount */}
      <div>
        <p className="stat-label">Total Due</p>
        <p className="font-mono font-bold text-2xl text-text-primary mt-0.5">
          {formatINR(Number(bill.total_amount_due))}
        </p>
        {Number(bill.minimum_due) > 0 && (
          <p className="text-text-muted text-xs mt-0.5">
            Min: {formatINR(Number(bill.minimum_due))}
          </p>
        )}
      </div>

      {/* Due date */}
      <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${urgencyClasses.bg} border ${urgencyClasses.border}`}>
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider">Due Date</p>
          <p className={`font-mono text-sm font-semibold ${urgencyClasses.text}`}>
            {bill.due_date
              ? new Date(bill.due_date + "T00:00:00").toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </p>
        </div>
        <span className={`text-xs font-medium ${urgencyClasses.text}`}>{daysLeft}</span>
      </div>
    </div>
  );
}

// ── Sort config ───────────────────────────────────────────────
type SortKey = "due_date" | "total_amount_due";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={12} className="text-text-muted opacity-50" />;
  return sortDir === "asc"
    ? <ArrowUp size={12} className="text-violet-light" />
    : <ArrowDown size={12} className="text-violet-light" />;
}

// ── Bills Table ───────────────────────────────────────────────
function BillsTable({
  bills,
  onStatusChange,
}: {
  bills: CreditCardBill[];
  onStatusChange: (id: string, status: CreditCardStatus) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...bills].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    if (sortKey === "due_date") {
      aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    } else {
      aVal = Number(a.total_amount_due);
      bVal = Number(b.total_amount_due);
    }

    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const totalUnpaid = bills
    .filter(b => b.status !== "Paid")
    .reduce((s, b) => s + Number(b.total_amount_due), 0);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="table-header">Card</th>
              <th className="table-header">
                <button
                  className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
                  onClick={() => toggleSort("total_amount_due")}
                >
                  Total Due <SortIcon col="total_amount_due" sortKey={sortKey} sortDir={sortDir} />
                </button>
              </th>
              <th className="table-header">Min Due</th>
              <th className="table-header">
                <button
                  className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
                  onClick={() => toggleSort("due_date")}
                >
                  Due Date <SortIcon col="due_date" sortKey={sortKey} sortDir={sortDir} />
                </button>
              </th>
              <th className="table-header">Days Left</th>
              <th className="table-header">Status</th>
              <th className="table-header">Last Fetched</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(bill => {
              const urgency = getDueUrgency(bill.due_date);
              const urgencyClasses = getUrgencyClasses(urgency);
              const config = getCardConfig(bill.card_name);
              const bankColor = config?.bankColor ?? "#4A5270";

              return (
                <tr
                  key={bill.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  {/* Card name */}
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <CardArtwork cardName={bill.card_name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-text-primary text-sm font-medium truncate max-w-[140px]">
                          {config?.shortName ?? bill.card_name}
                        </p>
                        <p className="text-text-muted text-xs" style={{ color: bankColor }}>
                          {config?.bankName ?? ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Total Due */}
                  <td className="table-cell">
                    <span className="font-mono font-semibold text-text-primary">
                      {formatINR(Number(bill.total_amount_due))}
                    </span>
                  </td>

                  {/* Min Due */}
                  <td className="table-cell">
                    <span className="font-mono text-text-secondary text-sm">
                      {Number(bill.minimum_due) > 0
                        ? formatINR(Number(bill.minimum_due))
                        : <span className="text-text-muted">—</span>}
                    </span>
                  </td>

                  {/* Due Date */}
                  <td className="table-cell">
                    <span className={`font-mono text-sm ${urgencyClasses.text}`}>
                      {bill.due_date
                        ? new Date(bill.due_date + "T00:00:00").toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </td>

                  {/* Days Left */}
                  <td className="table-cell">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyClasses.bg} ${urgencyClasses.text}`}>
                      {formatDaysLeft(bill.due_date)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="table-cell">
                    <StatusDropdown bill={bill} onStatusChange={onStatusChange} />
                  </td>

                  {/* Last Fetched */}
                  <td className="table-cell">
                    <span className="text-text-muted text-xs flex items-center gap-1">
                      <Clock size={10} className="flex-shrink-0" />
                      {formatDistanceToNow(new Date(bill.last_fetched_at), { addSuffix: true })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Total row */}
          <tfoot>
            <tr className="border-t border-white/10 bg-white/[0.02]">
              <td className="table-cell font-medium text-text-secondary" colSpan={1}>
                Total Outstanding
              </td>
              <td className="table-cell">
                <span className="font-mono font-bold text-text-primary">
                  {formatINR(totalUnpaid)}
                </span>
              </td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Skeleton loading ──────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card flex-shrink-0 w-64 p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-[72px] h-11 rounded-lg bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/5 rounded w-3/4" />
          <div className="h-2 bg-white/5 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2 bg-white/5 rounded w-1/3" />
        <div className="h-6 bg-white/5 rounded w-2/3" />
      </div>
      <div className="h-10 bg-white/5 rounded-lg" />
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card text-sm font-medium transition-all duration-300 ${
      type === "success"
        ? "bg-emerald-fin-dim border border-emerald-fin/30 text-emerald-fin"
        : "bg-rose-fin-dim border border-rose-fin/30 text-rose-fin"
    }`}>
      {type === "success"
        ? <CheckCircle2 size={14} />
        : <AlertTriangle size={14} />}
      {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function CreditCardsPage() {
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load bills on mount
  const loadBills = useCallback(async () => {
    try {
      const res = await fetch("/api/credit-cards?source=bills");
      if (!res.ok) throw new Error("Failed to load bills");
      const data = await res.json();
      setBills(data.bills ?? []);
    } catch (err) {
      console.error("Load bills error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // Status change handler (optimistic update)
  function handleStatusChange(id: string, status: CreditCardStatus) {
    setBills(prev =>
      prev.map(b => (b.id === id ? { ...b, status } : b))
    );
  }

  // Gmail fetch handler
  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/credit-cards/fetch", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setToast({ message: data.error ?? "Fetch failed", type: "error" });
        return;
      }

      const { successCount, totalCount } = data;
      setToast({
        message: `${successCount} of ${totalCount} cards updated`,
        type: successCount > 0 ? "success" : "error",
      });
      setLastUpdated(new Date());

      // Reload bills from DB
      await loadBills();
    } catch (err) {
      setToast({ message: "Fetch failed — check your Gmail connection", type: "error" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <Header
        title="Credit Cards"
        subtitle="Statement balances and due dates"
      />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* ── Top bar: refresh button ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-violet-light" />
            <h2 className="font-display font-semibold text-text-primary">
              {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} Bills
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="text-text-muted text-xs">
                Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </p>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Fetching…" : "Refresh Bills"}
            </button>
          </div>
        </div>

        {/* ── Loading state ── */}
        {loading ? (
          <>
            <div className="card p-6 animate-pulse">
              <div className="h-6 bg-white/5 rounded w-48 mb-2" />
              <div className="h-10 bg-white/5 rounded w-64" />
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </>
        ) : bills.length === 0 ? (
          /* ── Empty state ── */
          <div className="card p-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 bg-violet/10 border border-violet/20 rounded-2xl flex items-center justify-center">
              <Wallet size={28} className="text-violet-light" />
            </div>
            <div>
              <p className="font-display font-semibold text-text-primary text-lg">
                No bills fetched yet
              </p>
              <p className="text-text-muted text-sm mt-1 max-w-sm">
                Click "Refresh Bills" to pull your latest credit card statements from Gmail.
                Make sure Gmail is connected in{" "}
                <Link href="/settings" className="text-violet-light hover:underline">
                  Settings
                </Link>.
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Fetching…" : "Fetch Bills"}
            </button>
          </div>
        ) : (
          <>
            {/* ── Summary Banner ── */}
            <BillSummaryBanner bills={bills} />

            {/* ── Summary Cards Row (horizontally scrollable) ── */}
            <div>
              <h3 className="font-display font-medium text-text-secondary text-sm mb-3">
                All Cards — {bills[0]?.statement_month ?? "Current Month"}
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
                {/* Sort cards to match config order */}
                {CREDIT_CARD_CONFIGS
                  .map(cfg => bills.find(b => b.card_name === cfg.cardName))
                  .filter((b): b is CreditCardBill => !!b)
                  .map(bill => (
                    <CreditCardSummaryCard
                      key={bill.id}
                      bill={bill}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
              </div>
            </div>

            {/* ── Detailed Table ── */}
            <div>
              <h3 className="font-display font-medium text-text-secondary text-sm mb-3">
                Detailed Breakdown
              </h3>
              <BillsTable bills={bills} onStatusChange={handleStatusChange} />
            </div>
          </>
        )}

      </main>

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
