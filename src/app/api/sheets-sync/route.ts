// ============================================================
// /api/sheets-sync
// POST — fetch all expenses from Google Sheets web app,
//        map them to the transactions schema, and upsert.
//        Re-running never creates duplicates — uses
//        gmail_msg_id = "sheets_{row_num}" as a dedup key.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Category } from "@/types";

// ── Category mapping: Sheets → FinDash ───────────────────────
const CATEGORY_MAP: Record<string, Category> = {
  "Food":          "Food & Dining",
  "Transport":     "Transport",
  "Rent":          "Other",
  "Shopping":      "Shopping",
  "Entertainment": "Entertainment",
  "Health":        "Healthcare",
  "EMI":           "Other",
  "Utilities":     "Utilities",
  "Subscriptions": "Entertainment",
  "Misc":          "Other",
};

// Row shape returned by the Apps Script ?action=export endpoint
interface SheetExpenseRow {
  row_num:        number;
  date:           string;   // "2026-06-01"
  description:    string;
  category:       string;   // "Food", "Transport" …
  amount:         number;
  payment_method: string;   // "Credit Card", "UPI" …
  account:        string;   // card name or bank account
  necessary:      string;   // "Necessary" | "Unnecessary"
  month:          string;   // "Jun 2026"
  notes:          string;
}

export async function POST(_req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webAppUrl = process.env.SHEETS_WEBAPP_URL;
  if (!webAppUrl || webAppUrl.includes("YOUR_DEPLOYMENT_ID")) {
    return NextResponse.json(
      { error: "SHEETS_WEBAPP_URL is not configured. Add it to your .env.local file." },
      { status: 400 }
    );
  }

  // ── 1. Fetch from Google Sheets web app ────────────────────
  let rows: SheetExpenseRow[] = [];
  try {
    const sheetsRes = await fetch(`${webAppUrl}?action=export`, {
      // Google Apps Script requires a redirect follow
      redirect: "follow",
      headers: { "Accept": "application/json" },
    });

    if (!sheetsRes.ok) {
      return NextResponse.json(
        { error: `Sheets responded with HTTP ${sheetsRes.status}` },
        { status: 502 }
      );
    }

    const json = await sheetsRes.json();
    if (json.status === "error") {
      return NextResponse.json({ error: `Sheets error: ${json.message}` }, { status: 502 });
    }
    rows = json.expenses ?? [];
  } catch (err) {
    console.error("sheets-sync fetch error:", err);
    return NextResponse.json({ error: "Failed to reach Google Sheets web app" }, { status: 502 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, skipped: 0, message: "No expense rows found in the sheet." });
  }

  // ── 2. Map & upsert each row ──────────────────────────────
  const supabase = getSupabaseAdmin();
  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const row of rows) {
    // Skip rows without required fields
    if (!row.date || !row.amount || row.amount <= 0) {
      skipped++;
      continue;
    }

    const dedupKey   = `sheets_${row.row_num}`;
    const category   = CATEGORY_MAP[row.category] ?? "Other";
    const description = row.description || row.category || "Expense";

    // Notes: only actual user notes + payment method (not the necessary flag)
    const noteParts = [
      row.notes,
      row.payment_method ? `via ${row.payment_method}` : "",
    ].filter(Boolean);
    const notes = noteParts.join(" · ") || undefined;

    // Necessary field stored as its own column
    const necessary =
      row.necessary === "Necessary" || row.necessary === "Unnecessary"
        ? (row.necessary as "Necessary" | "Unnecessary")
        : undefined;

    const record = {
      date:         row.date,
      description:  description,
      amount:       row.amount,
      type:         "debit" as const,
      category:     category,
      account:      row.account || undefined,
      notes:        notes,
      necessary:    necessary,
      source:       "sheets" as const,
      gmail_msg_id: dedupKey,
    };

    // Check if row already exists
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("gmail_msg_id", dedupKey)
      .maybeSingle();

    if (existing) {
      // Update — keeps data fresh if the user edits the sheet row
      const { error } = await supabase
        .from("transactions")
        .update(record)
        .eq("id", existing.id);

      if (error) {
        errors.push(`Row ${row.row_num}: ${error.message}`);
      } else {
        updated++;
      }
    } else {
      // Insert new row
      const { error } = await supabase
        .from("transactions")
        .insert([record]);

      if (error) {
        errors.push(`Row ${row.row_num}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }

  // ── 3. Store last sync timestamp ──────────────────────────
  await supabase.from("app_settings").upsert({
    key:   "last_sheets_sync",
    value: new Date().toISOString(),
  });

  const message = `✅ ${inserted} new, ${updated} updated, ${skipped} skipped` +
    (errors.length ? ` — ${errors.length} error(s)` : "");

  return NextResponse.json({ inserted, updated, skipped, errors, message });
}

// GET — return last sync time and sheets config status
export async function GET(_req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webAppUrl = process.env.SHEETS_WEBAPP_URL;
  const configured = !!(webAppUrl && !webAppUrl.includes("YOUR_DEPLOYMENT_ID"));

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "last_sheets_sync")
    .maybeSingle();

  return NextResponse.json({
    configured,
    lastSync: data?.value ?? null,
  });
}
