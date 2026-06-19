// ============================================================
// POST /api/pending-emails/[id]/reject
// Marks a pending email as rejected — no transaction is created.
// Keeps the row (rather than deleting) so we don't re-process
// the same email on a future sync.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("pending_emails")
    .update({ status: "rejected" })
    .eq("id", params.id);

  if (error) {
    console.error("POST /api/pending-emails/[id]/reject error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
