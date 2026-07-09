// ============================================================
// GET /api/credit-cards
//
// Default (no params): Groups transactions by `account` containing
// "Card" and returns per-card totals for the current cycle.
//
// ?source=bills: Returns per-card billing data from the new
// credit_card_bills table (fetched from Gmail statements).
// Used by the Credit Cards page and Overview Quick View.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getLatestBillsPerCard } from "@/lib/creditCardQueries";

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

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const source = req.nextUrl.searchParams.get("source");

  // ── New bills-based data source ───────────────────────────
  if (source === "bills") {
    try {
      const bills = await getLatestBillsPerCard();
      return NextResponse.json({ bills });
    } catch (err) {
      console.error("GET /api/credit-cards?source=bills error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to fetch bills" },
        { status: 500 }
      );
    }
  }

  // ── Existing transaction-based logic (default) ────────────
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
