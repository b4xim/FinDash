// ============================================================
// GET /api/pending-emails
// Returns all pending_emails with status='pending' for the review queue
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pending_emails")
    .select("*")
    .eq("status", "pending")
    .order("received_at", { ascending: false });

  if (error) {
    console.error("GET /api/pending-emails error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
