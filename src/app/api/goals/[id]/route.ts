// ============================================================
// /api/goals/[id]
// PATCH  — update a goal (including saved_amount top-up and marking complete)
// DELETE — delete a goal
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, target_amount, saved_amount, deadline, color, icon, notes, completed } = body;

  const update: Record<string, unknown> = {};
  if (name           !== undefined) update.name          = name;
  if (target_amount  !== undefined) update.target_amount = parseFloat(target_amount);
  if (saved_amount   !== undefined) update.saved_amount  = parseFloat(saved_amount);
  if (deadline       !== undefined) update.deadline      = deadline || null;
  if (color          !== undefined) update.color         = color;
  if (icon           !== undefined) update.icon          = icon;
  if (notes          !== undefined) update.notes         = notes || null;
  if (completed      !== undefined) update.completed     = completed;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("financial_goals")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("financial_goals").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
