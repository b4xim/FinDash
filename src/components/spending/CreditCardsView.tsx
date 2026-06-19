"use client";

// ============================================================
// CreditCardsView — transactions grouped by card, with current
// cycle spend totals. Pulls from /api/credit-cards.
// ============================================================

import { useState, useEffect } from "react";
import { Transaction } from "@/types";
import { formatINR, formatDate, CATEGORY_COLORS } from "@/lib/utils";
import { CreditCard as CardIcon, ChevronDown, ChevronUp } from "lucide-react";

interface CardGroup {
  account: string;
  last4: string | null;
  transactions: Transaction[];
  thisCycleSpend: number;
  totalSpend: number;
}

// Pick a colour accent per card brand — purely cosmetic
function cardAccent(account: string): string {
  const a = account.toLowerCase();
  if (a.includes("icici")) return "from-orange-500/20 to-orange-600/5 border-orange-500/20";
  if (a.includes("sbi"))   return "from-blue-500/20 to-blue-600/5 border-blue-500/20";
  if (a.includes("axis"))  return "from-rose-500/20 to-rose-600/5 border-rose-500/20";
  return "from-violet/20 to-violet/5 border-violet/20";
}

export default function CreditCardsView() {
  const [cards, setCards] = useState<CardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/credit-cards")
      .then(res => res.json())
      .then(data => {
        setCards(data.cards || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="card p-12 text-center text-text-muted">Loading cards...</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="card p-12 text-center">
        <CardIcon size={32} className="text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary">No credit card transactions yet</p>
        <p className="text-text-muted text-sm mt-1">
          Add a transaction with an account name containing "Card", or sync from Gmail
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map(card => {
        const isExpanded = expandedCard === card.account;
        return (
          <div key={card.account} className={`card overflow-hidden bg-gradient-to-br ${cardAccent(card.account)} border`}>
            {/* Card summary header */}
            <button
              onClick={() => setExpandedCard(isExpanded ? null : card.account)}
              className="w-full p-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 rounded-lg bg-navy-950/40 flex items-center justify-center flex-shrink-0">
                  <CardIcon size={16} className="text-text-primary" />
                </div>
                <div>
                  <p className="font-display font-medium text-text-primary">
                    {card.account}
                    {card.last4 && <span className="text-text-muted font-mono text-sm ml-2">•••• {card.last4}</span>}
                  </p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {card.transactions.length} transaction{card.transactions.length !== 1 ? "s" : ""} tracked
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="stat-label">This cycle</p>
                  <p className="font-mono font-semibold text-text-primary">{formatINR(card.thisCycleSpend)}</p>
                </div>
                {isExpanded ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
              </div>
            </button>

            {/* Expanded transaction list */}
            {isExpanded && (
              <div className="border-t border-white/10 bg-navy-950/30">
                {card.transactions.slice(0, 20).map(txn => (
                  <div key={txn.id} className="flex items-center justify-between px-5 py-3 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: CATEGORY_COLORS[txn.category] }}
                      />
                      <div className="min-w-0">
                        <p className="text-text-primary text-sm truncate">{txn.description}</p>
                        <p className="text-text-muted text-xs">{formatDate(txn.date)} · {txn.category}</p>
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-medium flex-shrink-0 ${txn.type === "credit" ? "text-emerald-fin" : "text-rose-fin"}`}>
                      {txn.type === "credit" ? "+" : "−"}{formatINR(txn.amount)}
                    </span>
                  </div>
                ))}
                {card.transactions.length > 20 && (
                  <p className="text-text-muted text-xs text-center py-3">
                    + {card.transactions.length - 20} more — view full list in All Transactions
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
