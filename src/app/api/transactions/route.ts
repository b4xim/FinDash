// ============================================================
// /api/transactions
// GET  — fetch transactions (with optional filters)
// POST — create a new transaction
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/transactions?month=2024-06&category=Food&type=debit
export async function GET(req: NextRequest) {
  // Auth check
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month    = searchParams.get("month");    // "2024-06"
  const category = searchParams.get("category"); // "Food & Dining"
  const type     = searchParams.get("type");     // "debit" | "credit"
  const limit    = searchParams.get("limit");    // number

  const supabase = getSupabaseAdmin();

  // Start building query
  let query = supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  // Filter by month if provided (e.g. "2024-06")
  if (month) {
    const [year, mon] = month.split("-");
    const start = `${year}-${mon}-01`;
    // Last day of month
    const end = new Date(parseInt(year), parseInt(mon), 0)
      .toISOString()
      .split("T")[0];
    query = query.gte("date", start).lte("date", end);
  }

  if (category) query = query.eq("category", category);
  if (type)     query = query.eq("type", type);
  if (limit)    query = query.limit(parseInt(limit));

  const { data, error } = await query;

  if (error) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/transactions — create a new transaction
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Basic validation
  const { date, description, amount, type, category, account, notes, necessary } = body;
  if (!date || !description || !amount || !type || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("transactions")
    .insert([{ date, description, amount: parseFloat(amount), type, category, account, notes, necessary: necessary || null, source: "manual" }])
    .select()
    .single();

  if (error) {
    console.error("POST /api/transactions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
