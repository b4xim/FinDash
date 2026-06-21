// ============================================================
// /api/holdings/[id]
// PATCH  — update a holding
// DELETE — delete a holding
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

// PATCH /api/holdings/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, ticker, asset_type, units, buy_price,
    current_price, account, notes, mfapi_code,
  } = body;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("holdings")
    .update({
      name,
      ticker: ticker || null,
      asset_type,
      units: parseFloat(units),
      buy_price: parseFloat(buy_price),
      current_price: parseFloat(current_price),
      account: account || null,
      notes: notes || null,
      mfapi_code: mfapi_code || null,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/holdings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("holdings");

  return NextResponse.json(data);
}

// DELETE /api/holdings/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("holdings")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("DELETE /api/holdings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("holdings");

  return NextResponse.json({ ok: true });
}
