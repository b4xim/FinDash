// ============================================================
// PATCH /api/credit-cards/status
// Updates the payment status of a credit card bill.
// Body: { id: string, status: "Unpaid" | "Paid" | "Overdue" }
// Used by the tappable status badges on the Credit Cards page.
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { updateBillStatus } from "@/lib/creditCardQueries";
import { CreditCardStatus } from "@/types";

const VALID_STATUSES: CreditCardStatus[] = ["Unpaid", "Paid", "Overdue"];

export async function PATCH(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, status } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'id'" }, { status: 400 });
  }

  if (!status || !VALID_STATUSES.includes(status as CreditCardStatus)) {
    return NextResponse.json(
      { error: `Invalid 'status'. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await updateBillStatus(id, status as CreditCardStatus);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/credit-cards/status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status update failed" },
      { status: 500 }
    );
  }
}
