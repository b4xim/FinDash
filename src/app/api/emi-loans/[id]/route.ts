// ============================================================
// /api/emi-loans/[id]
// PATCH  — update a loan
// DELETE — delete a loan
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
  const { name, lender, loan_type, principal, interest_rate, tenure_months, start_date, emi_amount, account, notes, is_active } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined)           updates.name = name;
  if (lender !== undefined)         updates.lender = lender;
  if (loan_type !== undefined)      updates.loan_type = loan_type;
  if (principal !== undefined)      updates.principal = parseFloat(principal);
  if (interest_rate !== undefined)  updates.interest_rate = parseFloat(interest_rate);
  if (tenure_months !== undefined)  updates.tenure_months = parseInt(tenure_months);
  if (start_date !== undefined)     updates.start_date = start_date;
  if (emi_amount !== undefined)     updates.emi_amount = parseFloat(emi_amount);
  if (account !== undefined)        updates.account = account;
  if (notes !== undefined)          updates.notes = notes;
  if (is_active !== undefined)      updates.is_active = is_active;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("emi_loans")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/emi-loans/[id] error:", error);
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
    .from("emi_loans")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("DELETE /api/emi-loans/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
