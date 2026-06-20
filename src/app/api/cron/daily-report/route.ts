import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";

// This endpoint should be triggered by an external cron service
// Schedule: Every day at 17:00 UTC (10:30 PM IST)

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "").trim();
  
  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  try {
    // 1. Calculate today's spent amount
    const { data: todayTxs, error: todayErr } = await supabase
      .from("transactions")
      .select("amount")
      .eq("type", "debit")
      .eq("date", today);

    if (todayErr) throw todayErr;

    const todaySpent = todayTxs?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

    // Send the daily spent notification
    await sendPushNotification({
      title: "Daily Spending Update 📉",
      body: `You spent ₹${todaySpent.toLocaleString("en-IN")} today.`,
      url: "/overview",
    });

    // 2. Check budget thresholds
    const { data: budgets, error: budgetErr } = await supabase
      .from("budget_limits")
      .select("*");

    if (budgetErr) throw budgetErr;

    if (budgets && budgets.length > 0) {
      // Get all spending for this month
      const { data: monthTxs, error: monthErr } = await supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "debit")
        .gte("date", firstDayOfMonth);

      if (monthErr) throw monthErr;

      // Group spending by category
      const categorySpending: Record<string, number> = {};
      monthTxs?.forEach(tx => {
        categorySpending[tx.category] = (categorySpending[tx.category] || 0) + Number(tx.amount);
      });

      // Check each budget limit
      for (const budget of budgets) {
        const spent = categorySpending[budget.category] || 0;
        const pctSpent = (spent / budget.monthly_limit) * 100;

        if (pctSpent >= budget.alert_at_pct) {
          await sendPushNotification({
            title: `🚨 Budget Alert: ${budget.category}`,
            body: `You've spent ₹${spent.toLocaleString("en-IN")} (${pctSpent.toFixed(0)}%) of your ₹${budget.monthly_limit.toLocaleString("en-IN")} monthly limit!`,
            url: "/budget",
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Daily reports sent" });
  } catch (err) {
    console.error("Daily report cron error:", err);
    return NextResponse.json({ error: "Failed to send daily report" }, { status: 500 });
  }
}
