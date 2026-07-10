"use client";

// ============================================================
// CreditCardQuickView — compact horizontal card row for the
// Overview page. Self-contained: fetches its own data and
// manages its own refresh state.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import CardArtwork from "@/components/credit-cards/CardArtwork";
import { Wallet, ExternalLink } from "lucide-react";
import { formatINR } from "@/lib/utils";
import {
  getCardConfig,
  getDueUrgency,
  getUrgencyClasses,
  CREDIT_CARD_CONFIGS,
} from "@/lib/creditCardConfig";
import { CreditCardBill } from "@/types";

// ── Mini card for each credit card ───────────────────────────
function MiniCard({ bill }: { bill: CreditCardBill }) {
  const config = getCardConfig(bill.card_name);
  const urgency = getDueUrgency(bill.due_date, bill.status);
  const urgencyClasses = getUrgencyClasses(urgency);
  const bankColor = config?.bankColor ?? "#4A5270";

  const statusDotColor =
    bill.status === "Paid"
      ? "#10D98C"
      : "#FF5C7A";

  return (
    <Link
      href="/credit-cards"
      className="flex-shrink-0 w-44 card p-4 flex flex-col gap-3 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden group"
      style={{ borderBottomColor: bankColor, borderBottomWidth: "3px" }}
    >
      {/* Card artwork + status dot */}
      <div className="flex items-center justify-between">
        <CardArtwork cardName={bill.card_name} size="sm" />
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusDotColor }}
          title={bill.status}
        />
      </div>

      {/* Short card name */}
      <div>
        <p className="text-text-muted text-[10px] uppercase tracking-wider">
          {config?.bankName ?? ""}
        </p>
        <p className="font-display font-medium text-text-primary text-xs leading-snug truncate mt-0.5">
          {config?.shortName ?? bill.card_name}
        </p>
      </div>

      {/* Amount */}
      <p className="font-mono font-bold text-base text-text-primary leading-none">
        {formatINR(Number(bill.total_amount_due))}
      </p>

      {/* Due date */}
      <div className={`text-[10px] font-mono px-2 py-0.5 rounded-full self-start ${urgencyClasses.text} ${urgencyClasses.bg}`}>
        {bill.status === "Paid" ? "Paid" : bill.due_date
          ? new Date(bill.due_date + "T00:00:00").toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })
          : "No due date"}
      </div>
    </Link>
  );
}

// ── Summary mini card (total outstanding) ────────────────────
function TotalMiniCard({ bills }: { bills: CreditCardBill[] }) {
  const unpaid = bills.filter(b => b.status !== "Paid");
  const total = unpaid.reduce((s, b) => s + Number(b.total_amount_due), 0);

  return (
    <Link
      href="/credit-cards"
      className="flex-shrink-0 w-44 card p-4 flex flex-col gap-3 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer bg-violet/5 border-violet/20"
    >
      <div className="w-8 h-8 bg-gradient-violet rounded-xl flex items-center justify-center">
        <Wallet size={14} className="text-white" />
      </div>
      <div>
        <p className="text-text-muted text-[10px] uppercase tracking-wider">Total Outstanding</p>
        <p className="font-mono font-bold text-xl text-text-primary mt-0.5 leading-none">
          {formatINR(total)}
        </p>
        <p className="text-text-muted text-[10px] mt-1">
          {unpaid.length} unpaid card{unpaid.length !== 1 ? "s" : ""}
        </p>
      </div>
      <span className="text-violet-light text-xs flex items-center gap-1 mt-auto">
        View all <ExternalLink size={10} />
      </span>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────
export default function CreditCardQuickView() {
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    try {
      const res = await fetch("/api/credit-cards?source=bills");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBills(data.bills ?? []);
      setError(null);
    } catch (err) {
      setError("Could not load credit card bills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-display font-semibold text-text-primary flex items-center gap-2">
          <Wallet size={16} className="text-violet-light" />
          Credit Cards — Quick View
        </h2>
        <Link
          href="/credit-cards"
          className="text-xs text-violet-light hover:underline flex items-center gap-1"
        >
          View all <ExternalLink size={10} />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-44 h-40 card animate-pulse bg-white/[0.02]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="card p-4 flex items-center gap-3 text-text-muted text-sm">
          <span>{error}</span>
          <button onClick={loadBills} className="text-violet-light hover:underline text-xs ml-auto">
            Retry
          </button>
        </div>
      ) : bills.length === 0 ? (
        /* Empty state */
        <div className="card p-6 flex flex-col items-center gap-3 text-center">
          <Wallet size={24} className="text-text-muted" />
          <div>
            <p className="text-text-secondary text-sm font-medium">No bills yet</p>
            <p className="text-text-muted text-xs mt-0.5">
              Add credit card transactions on the Credit Cards page
            </p>
          </div>
          <Link href="/credit-cards" className="btn-secondary text-xs">
            Go to Credit Cards
          </Link>
        </div>
      ) : (
        /* Card row */
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
          {/* Cards in config order */}
          {CREDIT_CARD_CONFIGS
            .map(cfg => bills.find(b => b.card_name === cfg.cardName))
            .filter((b): b is CreditCardBill => !!b)
            .map(bill => (
              <MiniCard key={bill.id} bill={bill} />
            ))}
          {/* Total summary card at the end */}
          <TotalMiniCard bills={bills} />
        </div>
      )}
    </div>
  );
}
