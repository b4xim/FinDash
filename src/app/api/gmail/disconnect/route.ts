// ============================================================
// POST /api/gmail/disconnect
// Revokes our local copy of the Gmail tokens. Does NOT revoke
// access on Google's side automatically — we also call Google's
// revoke endpoint so the grant disappears from the user's
// Google Account permissions page too.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { disconnectGmail } from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Try to revoke the token on Google's side too (best-effort)
  const supabase = getSupabaseAdmin();
  const { data: tokenRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gmail_access_token")
    .maybeSingle();

  if (tokenRow?.value) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenRow.value}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (err) {
      console.error("Google token revoke failed (continuing anyway):", err);
      // Not fatal — we still clear our local copy below
    }
  }

  await disconnectGmail();

  return NextResponse.json({ ok: true });
}
