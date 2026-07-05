// ============================================================
// /api/lendings
// GET  — fetch all lending entries
// POST — create a new lending entry
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/lendings?direction=lent|borrowed&status=pending|settled
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction");
  const status = searchParams.get("status");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("lendings")
    .select("*")
    .order("date", { ascending: false });

  if (direction) query = query.eq("direction", direction);
  if (status)    query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("GET /api/lendings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/lendings — create a new lending entry
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { person, direction, amount, date, due_date, notes } = body;

  if (!person || !direction || !amount || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("lendings")
    .insert([{
      person,
      direction,
      amount: parseFloat(amount),
      settled_amount: 0,
      date,
      due_date: due_date || null,
      status: "pending",
      notes: notes || null,
    }])
    .select()
    .single();

  if (error) {
    console.error("POST /api/lendings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
