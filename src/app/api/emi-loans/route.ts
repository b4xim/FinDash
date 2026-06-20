// ============================================================
// /api/emi-loans
// GET  — fetch all EMI loans
// POST — create a new EMI loan
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/emi-loans?active=true
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const active = searchParams.get("active"); // "true" | "false" | null (all)

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("emi_loans")
    .select("*")
    .order("start_date", { ascending: false });

  if (active === "true")  query = query.eq("is_active", true);
  if (active === "false") query = query.eq("is_active", false);

  const { data, error } = await query;
  if (error) {
    console.error("GET /api/emi-loans error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/emi-loans — create a new loan
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, lender, loan_type, principal, interest_rate, tenure_months, start_date, emi_amount, account, notes, is_no_cost_emi } = body;

  if (!name || !loan_type || !principal || tenure_months == null || !start_date || !emi_amount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("emi_loans")
    .insert([{
      name,
      lender: lender || null,
      loan_type,
      principal: parseFloat(principal),
      interest_rate: parseFloat(interest_rate) || 0,
      tenure_months: parseInt(tenure_months),
      start_date,
      emi_amount: parseFloat(emi_amount),
      account: account || null,
      notes: notes || null,
      is_active: true,
      is_no_cost_emi: is_no_cost_emi ?? false,
    }])
    .select()
    .single();

  if (error) {
    console.error("POST /api/emi-loans error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
