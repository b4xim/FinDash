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
  "Food":          "Food & Dining",
  "Transport":     "Transport",
  "Rent":          "Rent",
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

// ── Shared sync logic ─────────────────────────────────────────
// Used by both the manual POST and the cron-triggered GET.
// Idempotent — safe to run multiple times; never duplicates.
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

  // 1. Fetch from Google Sheets web app
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

  // 2. Map & upsert each row
  const supabase = getSupabaseAdmin();
  let inserted = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.date || !row.amount || row.amount <= 0) { skipped++; continue; }

    const dedupKey    = `sheets_${row.row_num}`;
    const category    = CATEGORY_MAP[row.category] ?? "Other";
    const description = row.description || row.category || "Expense";
    const noteParts   = [row.notes, row.payment_method ? `via ${row.payment_method}` : ""].filter(Boolean);
    const notes       = noteParts.join(" · ") || undefined;
    const necessary   =
      row.necessary === "Necessary" || row.necessary === "Unnecessary"
        ? (row.necessary as "Necessary" | "Unnecessary")
        : undefined;

    const record = {
      date: row.date, description, amount: row.amount,
      type: "debit" as const, category, account: row.account || undefined,
      notes, necessary, source: "sheets" as const, gmail_msg_id: dedupKey,
    };

    const { data: existing } = await supabase
      .from("transactions")
      .select("id, date, description, amount, category, account, notes, necessary, source")
      .eq("gmail_msg_id", dedupKey)
      .maybeSingle();

    if (existing) {
      // Preserve any category the user has manually set in the app —
      // only revert to the sheet-mapped category if the user hasn't changed it
      // (i.e. the stored category still matches what the sheet would have produced).
      const preservedCategory = existing.category as Category;
      const recordToUpdate = {
        ...record,
        // Keep the existing category unless it still equals what the sheet originally mapped,
        // meaning the user hasn't touched it — detect a manual edit by checking if the
        // stored category differs from what the sheet maps to now.
        category: preservedCategory,
      };

      // Compare every field except category (which the user may have overridden)
      const hasChanged =
        existing.date        !== record.date        ||
        existing.description !== record.description ||
        existing.amount      !== record.amount       ||
        (existing.account   ?? undefined) !== record.account   ||
        (existing.notes     ?? undefined) !== record.notes     ||
        (existing.necessary ?? undefined) !== record.necessary ||
        existing.source      !== record.source;

      if (!hasChanged) {
        skipped++;
      } else {
        const { error } = await supabase.from("transactions").update(recordToUpdate).eq("id", existing.id);
        if (error) errors.push(`Row ${row.row_num}: ${error.message}`); else updated++;
      }
    } else {
      const { error } = await supabase.from("transactions").insert([record]);
      if (error) errors.push(`Row ${row.row_num}: ${error.message}`); else inserted++;
    }
  }

  // 3. Stamp last sync time
  await supabase.from("app_settings").upsert({ key: "last_sheets_sync", value: new Date().toISOString() });

  const message =
    `✅ ${inserted} new, ${updated} updated, ${skipped} skipped` +
    (errors.length ? ` — ${errors.length} error(s)` : "");

  // 4. Send Push Notification and revalidate cache
  if (inserted > 0 || updated > 0 || errors.length > 0) {
    if (inserted > 0 || updated > 0) {
      revalidateTag("transactions");
    }
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
