// ============================================================
// POST /api/pending-emails/[id]/approve
// Takes the (possibly edited) parsed data the user confirmed in
// the review queue, creates a real transaction from it, and
// marks the pending_email as approved.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, description, amount, type, category, account, card_last4 } = body;

  // Validate the user-confirmed data before creating a transaction
  if (!date || !description || !amount || !type || !category) {
    return NextResponse.json(
      { error: "Missing required fields — please fill in date, description, amount, type, and category" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Fetch the pending email to get its gmail_msg_id
  const { data: pendingEmail, error: fetchError } = await supabase
    .from("pending_emails")
    .select("gmail_msg_id")
    .eq("id", params.id)
    .single();

  if (fetchError || !pendingEmail) {
    return NextResponse.json({ error: "Pending email not found" }, { status: 404 });
  }

  // Create the real transaction, tagged with source='gmail'
  const { data: transaction, error: insertError } = await supabase
    .from("transactions")
    .insert([{
      date,
      description,
      amount: parseFloat(amount),
      type,
      category,
      account: account || null,
      card_last4: card_last4 || null,
      source: "gmail",
      gmail_msg_id: pendingEmail.gmail_msg_id,
    }])
    .select()
    .single();

  if (insertError) {
    console.error("Approve - insert transaction error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Mark the pending email as approved
  const { error: updateError } = await supabase
    .from("pending_emails")
    .update({ status: "approved" })
    .eq("id", params.id);

  if (updateError) {
    console.error("Approve - update pending_email error:", updateError);
    // Transaction was created successfully, so don't fail the whole request
  }

  revalidateTag("transactions");

  return NextResponse.json(transaction, { status: 201 });
}
