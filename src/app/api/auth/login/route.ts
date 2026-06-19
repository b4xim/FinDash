// ============================================================
// POST /api/auth/login — Validate password, set session cookie
//
// Checks the in-database password override first (set via
// Settings → Change Password), falling back to the APP_PASSWORD
// env var if the user has never changed their password.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  // Check for a password override stored via Settings
  const supabase = getSupabaseAdmin();
  const { data: overrideRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "app_password_hash")
    .maybeSingle();

  const isValid = overrideRow
    ? overrideRow.value === hashPassword(password)
    : password === process.env.APP_PASSWORD;

  if (!isValid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Set the session cookie
  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
