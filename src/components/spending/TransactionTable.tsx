"use client";

// ============================================================
// TransactionTable — filterable, sortable list of transactions
// ============================================================

import { useState, useMemo } from "react";
import { Transaction, Category } from "@/types";
import { formatINR, formatDate, CATEGORY_COLORS } from "@/lib/utils";
import { Pencil, Trash2, ArrowUpDown, Mail } from "lucide-react";

const CATEGORIES: (Category | "All")[] = [
  "All", "Food & Dining", "Shopping", "Transport", "Utilities",
  "Entertainment", "Healthcare", "Investment", "Income", "Transfer", "Other",
];

type SortField = "date" | "amount";
type SortDir = "asc" | "desc";

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit: (txn: Transaction) => void;
  onDelete: (txn: Transaction) => void;
}

export default function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const [categoryFilter, setCategoryFilter] = useState<Category | "All">("All");
  const [typeFilter, setTypeFilter] = useState<"All" | "debit" | "credit">("All");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Toggle sort direction when clicking the same column header
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  // Apply filters + search + sort — recomputed only when inputs change
  const filtered = useMemo(() => {
    let result = [...transactions];

    if (categoryFilter !== "All") {
      result = result.filter(t => t.category === categoryFilter);
    }
    if (typeFilter !== "All") {
      result = result.filter(t => t.type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.account?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      if (sortField === "amount") cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [transactions, categoryFilter, typeFilter, search, sortField, sortDir]);

  return (
    <div className="card">
      {/* Filter bar */}
      <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search description or account..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input flex-1 min-w-48"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as Category | "All")}
          className="select w-auto"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as "All" | "debit" | "credit")}
          className="select w-auto"
        >
          <option value="All">All types</option>
          <option value="debit">Debit only</option>
          <option value="credit">Credit only</option>
        </select>
        <span className="text-text-muted text-xs ml-auto">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header cursor-pointer select-none" onClick={() => toggleSort("date")}>
                <div className="flex items-center gap-1">Date <ArrowUpDown size={11} /></div>
              </th>
              <th className="table-header">Description</th>
              <th className="table-header">Category</th>
              <th className="table-header">Account</th>
              <th className="table-header cursor-pointer select-none text-right" onClick={() => toggleSort("amount")}>
                <div className="flex items-center gap-1 justify-end">Amount <ArrowUpDown size={11} /></div>
              </th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-text-muted py-12">
                  No transactions found. Try adjusting filters or add your first one.
                </td>
              </tr>
            ) : (
              filtered.map(txn => (
                <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="table-cell whitespace-nowrap text-text-secondary">
                    {formatDate(txn.date)}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{txn.description}</span>
                      {txn.source === "gmail" && (
                        <Mail size={12} className="text-violet-light flex-shrink-0">
                          <title>Synced from Gmail</title>
                        </Mail>
                      )}
                      {txn.necessary === "Necessary" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                          ✓ Necessary
                        </span>
                      )}
                      {txn.necessary === "Unnecessary" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 flex-shrink-0">
                          ✗ Unnecessary
                        </span>
                      )}
                    </div>
                    {txn.notes && <p className="text-text-muted text-xs mt-0.5">{txn.notes}</p>}
                  </td>

                  <td className="table-cell">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                      style={{
                        background: `${CATEGORY_COLORS[txn.category]}1A`,
                        color: CATEGORY_COLORS[txn.category],
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[txn.category] }} />
                      {txn.category}
                    </span>
                  </td>
                  <td className="table-cell text-text-muted">{txn.account || "—"}</td>
                  <td className={`table-cell text-right font-mono font-medium ${txn.type === "credit" ? "text-emerald-fin" : "text-rose-fin"}`}>
                    {txn.type === "credit" ? "+" : "−"}{formatINR(txn.amount)}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(txn)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-violet-light hover:bg-violet/10 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(txn)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-rose-fin hover:bg-rose-fin/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
