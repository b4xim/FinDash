// ============================================================
// Credit Card Supabase Queries
// Shared query functions used by both:
//   - POST /api/credit-cards/fetch (write path)
//   - GET  /api/credit-cards?source=bills (read path)
//   - CreditCardQuickView component (via API)
//   - PATCH /api/credit-cards/status (update path)
//
// All functions use getSupabaseAdmin() (service role key),
// never the public client. Never call these from client components.
// ============================================================

import { getSupabaseAdmin } from "@/lib/supabase";
import { CreditCardBill, CreditCardConfig, CreditCardStatus } from "@/types";

// ── READ queries ──────────────────────────────────────────────

/**
 * Returns the most recent bill row for every distinct card_name.
 * Used by both the full Credit Cards page and the Overview Quick View.
 * Ordered by card_name for consistent display order.
 */
export async function getLatestBillsPerCard(): Promise<CreditCardBill[]> {
  const supabase = getSupabaseAdmin();

  // Supabase doesn't have a native DISTINCT ON, so we fetch all rows for
  // the current statement month (most common case) and fall back to
  // fetching the latest row per card via a subquery workaround.
  // We use a raw SQL approach via RPC or a filter on the latest month.
  // Simpler approach: fetch all rows ordered by last_fetched_at desc,
  // then deduplicate client-side (safe for 7 cards).
  const { data, error } = await supabase
    .from("credit_card_bills")
    .select("*")
    .order("last_fetched_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  // Deduplicate: keep the most recently fetched row per card_name
  const seen = new Set<string>();
  const latest: CreditCardBill[] = [];
  for (const row of data) {
    if (!seen.has(row.card_name)) {
      seen.add(row.card_name);
      latest.push(row as CreditCardBill);
    }
  }

  return latest;
}

/**
 * Returns all bills for a specific statement month.
 * e.g. getBillsByMonth("Jul 2026")
 */
export async function getBillsByMonth(statementMonth: string): Promise<CreditCardBill[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("credit_card_bills")
    .select("*")
    .eq("statement_month", statementMonth)
    .order("card_name");

  if (error) throw error;
  return (data ?? []) as CreditCardBill[];
}

// ── WRITE queries ─────────────────────────────────────────────

export interface UpsertBillInput {
  card_name: string;
  sender_email?: string;
  total_amount_due: number;
  minimum_due: number;
  due_date: string | null;
  statement_month: string;
  status?: CreditCardStatus;
  last_fetched_at?: string;
}

/**
 * Upsert a bill row — inserts if (card_name, statement_month) doesn't exist,
 * updates if it does. The unique index on those two columns enables this.
 */
export async function upsertBill(bill: UpsertBillInput): Promise<CreditCardBill> {
  const supabase = getSupabaseAdmin();

  // Check existing to preserve 'Paid' status
  const { data: existing } = await supabase
    .from("credit_card_bills")
    .select("status")
    .eq("card_name", bill.card_name)
    .eq("statement_month", bill.statement_month)
    .maybeSingle();

  const payload = {
    ...bill,
    last_fetched_at: bill.last_fetched_at ?? new Date().toISOString(),
    status: existing?.status === "Paid" ? "Paid" : (bill.status ?? "Unpaid"),
  };

  const { data, error } = await supabase
    .from("credit_card_bills")
    .upsert(payload, {
      onConflict: "card_name,statement_month",
      // Don't overwrite status if user has manually changed it to Paid
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CreditCardBill;
}

/**
 * Update the status of a specific bill by id.
 * Used by the tappable status badge on the Credit Cards page.
 */
export async function updateBillStatus(id: string, status: CreditCardStatus): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("credit_card_bills")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

// ── CONFIG queries ────────────────────────────────────────────

/**
 * Reads all rows from credit_card_config.
 * Used by the fetch route to get sender_email and pdf_password.
 * NEVER expose this to client components — it returns pdf_password.
 */
export async function getAllCardConfigs(): Promise<CreditCardConfig[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("credit_card_config")
    .select("card_name, pdf_password, sender_email, created_at");

  if (error) throw error;
  return (data ?? []) as CreditCardConfig[];
}

/**
 * Get config for a single card by name.
 */
export async function getCardConfigFromDb(cardName: string): Promise<CreditCardConfig | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("credit_card_config")
    .select("card_name, pdf_password, sender_email, created_at")
    .eq("card_name", cardName)
    .maybeSingle();

  if (error) throw error;
  return data as CreditCardConfig | null;
}

/**
 * Mark a bill as Overdue if it is past due and still Unpaid.
 * Called during the fetch route to auto-update stale bills.
 */
export async function autoMarkOverdue(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  const { error } = await supabase
    .from("credit_card_bills")
    .update({ status: "Overdue" })
    .eq("status", "Unpaid")
    .lt("due_date", today);

  if (error) {
    // Non-fatal — log but don't throw
    console.error("autoMarkOverdue error:", error);
  }
}
