// ============================================================
// /api/budget-limits
// GET  — fetch all budget limits
// POST — create a new budget limit
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("budget_limits")
    .select("*")
    .order("category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { category, monthly_limit, alert_at_pct = 80 } = body;

  if (!category || !monthly_limit) {
    return NextResponse.json({ error: "category and monthly_limit are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("budget_limits")
    .upsert({ category, monthly_limit: parseFloat(monthly_limit), alert_at_pct: parseInt(alert_at_pct) }, { onConflict: "category" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
