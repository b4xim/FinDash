// ============================================================
// /api/sheets-sync
// POST — manual sync triggered from the dashboard UI
// GET  — two modes:
//        • Authorization: Bearer <CRON_SECRET>  → runs a full nightly sync
//          (called by cron-job.org every night automatically)
//        • No / wrong secret + valid session    → returns last sync status
//
// Re-running never creates duplicates — uses
// gmail_msg_id = "sheets_{row_num}" as a dedup key.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Category } from "@/types";

// Extend Vercel function timeout — the sync fetches from Google Sheets
// (external network) then does N sequential Supabase upserts, which can
// easily exceed the default 10 s limit.
export const maxDuration = 60;

// ── Category mapping: Sheets → FinDash ───────────────────────
const CATEGORY_MAP: Record<string, Category> = {
  // Food
  "Food":            "Food & Dining",
  "Food & Dining":   "Food & Dining",
  "Groceries":       "Food & Dining",
  // Transport
  "Transport":       "Transport",
  "Travel":          "Transport",
  // Housing
  "Rent":            "Rent",
  // Shopping
  "Shopping":        "Shopping",
  // Entertainment
  "Entertainment":   "Entertainment",
  "Subscriptions":   "Entertainment",
  // Health
  "Health":          "Healthcare",
  "Healthcare":      "Healthcare",
  "Medical":         "Healthcare",
  // Utilities
  "Utilities":       "Utilities",
  // Investment ← was missing — caused "Other" fallback
  "Investment":      "Investment",
  "Investments":     "Investment",
  // Education (no dedicated category — maps to Other)
  "Education":       "Other",
  // Income
  "Salary":          "Income",
  "Income":          "Income",
  // Catch-alls
  "EMI":             "Other",
  "Misc":            "Other",
  "Other":           "Other",
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

// ── Shared sync logic ─────────────────────────────────────────
// Optimised: does ONE bulk SELECT for all existing dedup keys,
// ONE batch INSERT for new rows, and parallel UPDATEs — instead
// of N sequential round-trips that caused timeouts on large sheets.
async function runSheetSync(): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  message: string;
}> {
  const webAppUrl = process.env.SHEETS_WEBAPP_URL;
  if (!webAppUrl || webAppUrl.includes("YOUR_DEPLOYMENT_ID")) {
    throw new Error("SHEETS_WEBAPP_URL is not configured.");
  }

  // 1. Fetch all rows from Google Sheets
  const sheetsRes = await fetch(`${webAppUrl}?action=export`, {
    redirect: "follow",
    headers: { Accept: "application/json" },
  });
  if (!sheetsRes.ok) throw new Error(`Sheets responded with HTTP ${sheetsRes.status}`);

  const json = await sheetsRes.json();
  if (json.status === "error") throw new Error(`Sheets error: ${json.message}`);

  const rows: SheetExpenseRow[] = json.expenses ?? [];
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, errors: [], message: "No expense rows found in the sheet." };
  }

  const supabase = getSupabaseAdmin();

  // 2. Build all dedup keys and mapped records in memory — no DB calls yet
  const validRows = rows.filter(r => r.date && r.amount && r.amount > 0);
  const skippedInvalid = rows.length - validRows.length;

  const allDedupKeys = validRows.map(r => `sheets_${r.row_num}`);

  type MappedRecord = {
    row_num: number;
    dedupKey: string;
    category: Category;
    date: string;
    description: string;
    amount: number;
    account: string | undefined;
    notes: string | undefined;
    necessary: "Necessary" | "Unnecessary" | undefined;
  };

  const mapped: MappedRecord[] = validRows.map(row => {
    const noteParts = [row.notes, row.payment_method ? `via ${row.payment_method}` : ""].filter(Boolean);
    return {
      row_num:     row.row_num,
      dedupKey:    `sheets_${row.row_num}`,
      category:    CATEGORY_MAP[row.category] ?? "Other",
      date:        row.date,
      description: row.description || row.category || "Expense",
      amount:      row.amount,
      account:     row.account || undefined,
      notes:       noteParts.join(" · ") || undefined,
      necessary:
        row.necessary === "Necessary" || row.necessary === "Unnecessary"
          ? (row.necessary as "Necessary" | "Unnecessary")
          : undefined,
    };
  });

  // 3. ONE bulk SELECT — fetch all existing rows by dedup key in a single query
  const { data: existingRows, error: selectError } = await supabase
    .from("transactions")
    .select("id, gmail_msg_id, date, description, amount, category, account, notes, necessary, source")
    .in("gmail_msg_id", allDedupKeys);

  if (selectError) throw new Error(`DB lookup failed: ${selectError.message}`);

  // Build a fast lookup map: dedupKey → existing row
  const existingMap = new Map(
    (existingRows ?? []).map(r => [r.gmail_msg_id as string, r])
  );

  // 4. Classify each mapped row into: insert, update, or skip
  const toInsert: object[] = [];
  const toUpdate: { id: string; record: object; row_num: number }[] = [];
  let skipped = skippedInvalid;
  const errors: string[] = [];

  for (const m of mapped) {
    const record = {
      date:         m.date,
      description:  m.description,
      amount:       m.amount,
      type:         "debit" as const,
      category:     m.category,
      account:      m.account,
      notes:        m.notes,
      necessary:    m.necessary,
      source:       "sheets" as const,
      gmail_msg_id: m.dedupKey,
    };

    const existing = existingMap.get(m.dedupKey);

    if (!existing) {
      toInsert.push(record);
    } else {
      // Category logic: correct "Other" mapping gaps, preserve user overrides
      const existingCategory = existing.category as Category;
      const categoryToUse =
        existingCategory === "Other" && m.category !== "Other"
          ? m.category
          : existingCategory;

      const categoryChanged = categoryToUse !== existingCategory;
      const hasChanged =
        categoryChanged ||
        existing.date        !== m.date        ||
        existing.description !== m.description ||
        existing.amount      !== m.amount      ||
        (existing.account   ?? undefined) !== m.account   ||
        (existing.notes     ?? undefined) !== m.notes     ||
        (existing.necessary ?? undefined) !== m.necessary ||
        existing.source      !== "sheets";

      if (!hasChanged) {
        skipped++;
      } else {
        toUpdate.push({
          id:      existing.id as string,
          row_num: m.row_num,
          record:  { ...record, category: categoryToUse },
        });
      }
    }
  }

  // 5. ONE batch INSERT for all new rows
  let inserted = 0;
  if (toInsert.length > 0) {
    const { error } = await supabase.from("transactions").insert(toInsert);
    if (error) {
      errors.push(`Batch insert failed: ${error.message}`);
    } else {
      inserted = toInsert.length;
    }
  }

  // 6. Parallel UPDATEs (rows that actually changed)
  let updated = 0;
  if (toUpdate.length > 0) {
    const updateResults = await Promise.all(
      toUpdate.map(u =>
        supabase.from("transactions").update(u.record).eq("id", u.id)
          .then(({ error }) => ({ row_num: u.row_num, error }))
      )
    );
    for (const r of updateResults) {
      if (r.error) errors.push(`Row ${r.row_num}: ${r.error.message}`);
      else updated++;
    }
  }

  // 7. Stamp last sync time
  await supabase.from("app_settings").upsert({ key: "last_sheets_sync", value: new Date().toISOString() });

  const message =
    `✅ ${inserted} new, ${updated} updated, ${skipped} skipped` +
    (errors.length ? ` — ${errors.length} error(s)` : "");

  // 8. Push notification + cache revalidation
  if (inserted > 0 || updated > 0 || errors.length > 0) {
    if (inserted > 0 || updated > 0) revalidateTag("transactions");
    const { sendPushNotification } = await import("@/lib/push");
    await sendPushNotification({
      title: "Sheets Sync Complete",
      body: message,
      url: "/settings",
    });
  }

  return { inserted, updated, skipped, errors, message };
}

// ── POST — manual sync from the dashboard UI ─────────────────
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

  try {
    const result = await runSheetSync();
    return NextResponse.json(result);
  } catch (err) {
    console.error("sheets-sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}

// ── GET — two modes ───────────────────────────────────────────
// Mode 1: Authorization: Bearer <CRON_SECRET>  → full sync (nightly cron)
// Mode 2: Valid session, no secret             → status check only
export async function GET(req: NextRequest) {
  const cronSecret     = process.env.CRON_SECRET;
  const authHeader     = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();
  const isCronCall     = cronSecret && providedSecret === cronSecret;

  // ── Cron-triggered nightly sync ──────────────────────────
  if (isCronCall) {
    try {
      const result = await runSheetSync();
      return NextResponse.json({ ...result, triggeredBy: "cron", syncedAt: new Date().toISOString() });
    } catch (err) {
      console.error("sheets-sync cron error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Sync failed" },
        { status: 502 }
      );
    }
  }

  // ── Status check for dashboard UI ────────────────────────
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webAppUrl  = process.env.SHEETS_WEBAPP_URL;
  const configured = !!(webAppUrl && !webAppUrl.includes("YOUR_DEPLOYMENT_ID"));
  const supabase   = getSupabaseAdmin();
  const { data }   = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "last_sheets_sync")
    .maybeSingle();

  return NextResponse.json({ configured, lastSync: data?.value ?? null });
}
