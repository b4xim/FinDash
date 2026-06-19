// ============================================================
// POST /api/sync
// Pulls new transaction/investment emails from Gmail since the
// last sync, parses each one, and stores results in pending_emails
// for the user to review and approve. Nothing is auto-saved to
// the transactions table — see /api/pending-emails/[id]/approve
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getValidAccessToken, listRelevantMessages, getMessageDetail,
  extractBodyText, getHeader,
} from "@/lib/gmail";
import { parseEmail } from "@/lib/emailParser";

export async function POST() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Gmail not connected. Go to Settings to connect your Gmail account." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // ── Get last sync timestamp ──
  const { data: lastSyncRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "last_gmail_sync")
    .single();
  const lastSyncTimestamp = lastSyncRow ? parseInt(lastSyncRow.value) : undefined;

  try {
    // ── Fetch message list from Gmail ──
    const messages = await listRelevantMessages(accessToken, lastSyncTimestamp);

    if (messages.length === 0) {
      // Still update last sync time so we don't re-scan the same empty window
      await supabase.from("app_settings").upsert([
        { key: "last_gmail_sync", value: String(Date.now()) },
      ]);
      return NextResponse.json({ newEmails: 0, message: "No new emails found since last sync" });
    }

    // ── Fetch full details + parse each message ──
    let newCount = 0;
    let skippedCount = 0;

    for (const msg of messages) {
      // Skip if we've already processed this message (avoid duplicates on re-sync)
      const { data: existing } = await supabase
        .from("pending_emails")
        .select("id")
        .eq("gmail_msg_id", msg.id)
        .maybeSingle();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Also skip if this email was already approved into a transaction previously
      // (covers the case where it was approved then somehow re-appears in pending_emails query)
      const { data: existingTxn } = await supabase
        .from("transactions")
        .select("id")
        .eq("gmail_msg_id", msg.id)
        .maybeSingle();

      if (existingTxn) {
        skippedCount++;
        continue;
      }

      const detail = await getMessageDetail(accessToken, msg.id);
      const sender = getHeader(detail.payload, "From");
      const subject = getHeader(detail.payload, "Subject");
      const bodyText = extractBodyText(detail.payload);
      const receivedDate = new Date(parseInt(detail.internalDate)).toISOString().split("T")[0];

      const parsed = parseEmail(sender, subject, bodyText, receivedDate);

      await supabase.from("pending_emails").insert([{
        gmail_msg_id: msg.id,
        sender,
        subject,
        received_at: new Date(parseInt(detail.internalDate)).toISOString(),
        raw_snippet: detail.snippet,
        parsed_json: parsed,
        status: "pending",
      }]);

      newCount++;
    }

    // ── Update last sync timestamp ──
    await supabase.from("app_settings").upsert([
      { key: "last_gmail_sync", value: String(Date.now()) },
    ]);

    return NextResponse.json({
      newEmails: newCount,
      skipped: skippedCount,
      message: `Found ${newCount} new email${newCount !== 1 ? "s" : ""} to review`,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
