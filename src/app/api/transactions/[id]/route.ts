// ============================================================
// /api/transactions/[id]
// PATCH  — update a transaction
// DELETE — delete a transaction
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

// PATCH /api/transactions/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const supabase = getSupabaseAdmin();

  // Only allow updating these fields — never let source or gmail_msg_id be changed
  const { date, description, amount, type, category, account, notes, necessary } = body;

  const { data, error } = await supabase
    .from("transactions")
    .update({ date, description, amount: parseFloat(amount), type, category, account, notes, necessary: necessary || null })
    .eq("id", params.id)
    .select()
    .single();


  if (error) {
    console.error("PATCH /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("transactions");

  return NextResponse.json(data);
}

// DELETE /api/transactions/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("DELETE /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("transactions");

  return NextResponse.json({ ok: true });
}
