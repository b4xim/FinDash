// ============================================================
// GET /api/gmail/status
// Returns whether Gmail is connected and which email, plus last sync time
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { isGmailConnected } from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connected, email } = await isGmailConnected();

  const supabase = getSupabaseAdmin();
  const { data: lastSyncRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "last_gmail_sync")
    .maybeSingle();

  return NextResponse.json({
    connected,
    email,
    lastSync: lastSyncRow ? new Date(parseInt(lastSyncRow.value)).toISOString() : null,
  });
}
