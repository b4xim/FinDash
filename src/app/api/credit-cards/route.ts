// ============================================================
// GET /api/credit-cards
// Groups transactions by `account` (where account name contains
// "Card") and returns per-card totals for the current cycle
// (calendar month, simplified — most cards roughly track this)
// plus the transaction list per card.
// ============================================================

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

const getCachedCreditCardTxns = unstable_cache(
  async () => {
    const supabase = getSupabaseAdmin();
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .or("account.ilike.%card%,notes.ilike.%credit card%")
      .order("date", { ascending: false });

    if (error) throw error;
    return transactions;
  },
  ["credit_card_txns"],
  { tags: ["transactions"] }
);

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let transactions;
  try {
    transactions = await getCachedCreditCardTxns();
  } catch (error: any) {
    console.error("GET /api/credit-cards error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by account name
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const cardMap: Record<string, {
    account: string;
    last4: string | null;
    transactions: typeof transactions;
    thisCycleSpend: number;
    totalSpend: number;
  }> = {};

  transactions?.forEach(txn => {
    const key = txn.account || "Unknown Card";
    if (!cardMap[key]) {
      cardMap[key] = {
        account: key,
        last4: txn.card_last4 || null,
        transactions: [],
        thisCycleSpend: 0,
        totalSpend: 0,
      };
    }
    cardMap[key].transactions.push(txn);
    if (txn.type === "debit") {
      cardMap[key].totalSpend += Number(txn.amount);
      if (txn.date.startsWith(thisMonthStr)) {
        cardMap[key].thisCycleSpend += Number(txn.amount);
      }
    }
    // Keep the most recent non-null last4 we've seen for this card
    if (!cardMap[key].last4 && txn.card_last4) {
      cardMap[key].last4 = txn.card_last4;
    }
  });

  const cards = Object.values(cardMap).sort((a, b) => b.thisCycleSpend - a.thisCycleSpend);

  return NextResponse.json({ cards });
}
