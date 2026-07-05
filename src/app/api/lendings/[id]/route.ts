// ============================================================
// /api/lendings/[id]
// PATCH  — update a lending entry (including settling)
// DELETE — delete a lending entry
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { person, direction, amount, settled_amount, date, due_date, status, notes } = body;

  const updates: Record<string, unknown> = {};
  if (person !== undefined)          updates.person = person;
  if (direction !== undefined)       updates.direction = direction;
  if (amount !== undefined)          updates.amount = parseFloat(amount);
  if (settled_amount !== undefined)  updates.settled_amount = parseFloat(settled_amount);
  if (date !== undefined)            updates.date = date;
  if (due_date !== undefined)        updates.due_date = due_date || null;
  if (status !== undefined)          updates.status = status;
  if (notes !== undefined)           updates.notes = notes;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("lendings")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/lendings/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("lendings")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("DELETE /api/lendings/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
