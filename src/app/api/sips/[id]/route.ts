// ============================================================
// /api/sips/[id]
// PATCH  — update a SIP (edit, toggle active, record installment)
// DELETE — permanently delete a SIP mandate
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

// PATCH /api/sips/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Special action: "record_installment"
  // Increments total_installments_done and adds sip_amount to total_invested
  if (body.action === "record_installment") {
    const supabase = getSupabaseAdmin();

    // First fetch the current SIP to compute new totals
    const { data: current, error: fetchError } = await supabase
      .from("sips")
      .select("sip_amount, total_installments_done, total_invested")
      .eq("id", params.id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: "SIP not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("sips")
      .update({
        total_installments_done: current.total_installments_done + 1,
        total_invested: parseFloat(current.total_invested) + parseFloat(current.sip_amount),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("PATCH /api/sips record_installment error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateTag("sips");
    return NextResponse.json(data);
  }

  // General update — whitelist only fields that can be edited
  const allowedFields = [
    "name", "asset_type", "sip_amount", "frequency", "sip_date",
    "start_date", "end_date", "total_installments_done", "total_invested",
    "holding_id", "account", "mfapi_code", "ticker", "is_active",
    "step_up_pct", "notes",
  ];

  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field] === "" ? null : body[field];
    }
  }

  // Coerce numeric fields
  if ("sip_amount" in updates) updates.sip_amount = parseFloat(updates.sip_amount);
  if ("sip_date" in updates) updates.sip_date = parseInt(updates.sip_date);
  if ("total_installments_done" in updates) updates.total_installments_done = parseInt(updates.total_installments_done);
  if ("total_invested" in updates) updates.total_invested = parseFloat(updates.total_invested);
  if ("step_up_pct" in updates) updates.step_up_pct = parseFloat(updates.step_up_pct) || 0;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sips")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/sips error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("sips");
  return NextResponse.json(data);
}

// DELETE /api/sips/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("sips").delete().eq("id", params.id);

  if (error) {
    console.error("DELETE /api/sips error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("sips");
  return NextResponse.json({ ok: true });
}
