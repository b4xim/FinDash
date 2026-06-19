// ============================================================
// /api/goals
// GET  — fetch all financial goals
// POST — create a new goal
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("financial_goals")
    .select("*")
    .order("completed")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, target_amount, saved_amount = 0, deadline, color = "#8B5CF6", icon = "target", notes } = body;

  if (!name || !target_amount) {
    return NextResponse.json({ error: "name and target_amount are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("financial_goals")
    .insert([{
      name,
      target_amount: parseFloat(target_amount),
      saved_amount:  parseFloat(saved_amount),
      deadline:      deadline || null,
      color,
      icon,
      notes:         notes || null,
      completed:     false,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
