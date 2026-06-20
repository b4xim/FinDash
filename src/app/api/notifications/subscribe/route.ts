import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await req.json();

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("Error saving subscription:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.endpoint) {
    return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);

  return NextResponse.json({ success: true });
}
