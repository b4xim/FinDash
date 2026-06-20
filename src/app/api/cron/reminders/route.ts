import { NextRequest, NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/push";

// This endpoint should be triggered by an external cron service (e.g., cron-job.org or Vercel Cron)
// Schedule: Every day at 16:30 UTC (10:00 PM IST)

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();
  
  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendPushNotification({
      title: "FinDash Reminder 📝",
      body: "Don't forget to add your transactions for today!",
      url: "/spending",
    });

    return NextResponse.json({ success: true, message: "Reminder push triggered", result });
  } catch (err) {
    console.error("Reminder cron error:", err);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
