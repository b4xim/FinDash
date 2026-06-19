// ============================================================
// POST /api/settings/password
// Changes the app login password.
//
// IMPORTANT: APP_PASSWORD starts as an env var, but env vars
// can't be changed at runtime from inside the app. So once you
// change your password here, we store a hashed override in
// app_settings, and the login route checks that override FIRST,
// falling back to APP_PASSWORD if no override exists.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createHash } from "crypto";

// Simple SHA-256 hash — fine here since this is a single-user app
// with no external attack surface beyond the password itself
function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both current and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // ── Verify current password ──
  // Check override first, fall back to env var
  const { data: overrideRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "app_password_hash")
    .maybeSingle();

  const isCurrentValid = overrideRow
    ? overrideRow.value === hashPassword(currentPassword)
    : currentPassword === process.env.APP_PASSWORD;

  if (!isCurrentValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  // ── Store the new password hash ──
  const { error } = await supabase
    .from("app_settings")
    .upsert([{ key: "app_password_hash", value: hashPassword(newPassword) }]);

  if (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
