// ============================================================
// /api/budget-limits/[id]
// PATCH  — update a budget limit
// DELETE — delete a budget limit
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { monthly_limit, alert_at_pct } = body;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("budget_limits")
    .update({
      monthly_limit: monthly_limit ? parseFloat(monthly_limit) : undefined,
      alert_at_pct:  alert_at_pct  ? parseInt(alert_at_pct)   : undefined,
    })
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
  const { error } = await supabase.from("budget_limits").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
