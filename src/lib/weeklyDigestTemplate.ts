// ============================================================
// weeklyDigestTemplate.ts
// Generates a fully self-contained dark-themed HTML email for
// the weekly FinDash summary. Uses inline CSS only (required
// for broad email client support — Gmail, Apple Mail, Outlook).
// ============================================================

import type { WeeklyDigestData } from "@/lib/weeklyDigestData";

// ── Colour tokens (matching app theme: charcoal dark + crimson red) ──
const C = {
  navy:       "#0A0A0A",   // navy-950
  navyCard:   "#111111",   // navy-900
  navyBorder: "#2A2A2A",   // navy-600
  crimson:    "#E8253A",   // violet DEFAULT (crimson red primary)
  crimsonLight:"#FF3D52",  // violet-light
  crimsonDark: "#C41E31",  // violet-dark
  emerald:    "#10D98C",   // emerald-fin (positive/income)
  gold:       "#FF6B6B",   // gold DEFAULT (warm red-orange)
  rose:       "#FF5C7A",   // rose-fin (negative/spend)
  textPrimary:"#F5F5F5",   // text-primary
  textSecond: "#A0A0A0",   // text-secondary
  textMuted:  "#555555",   // text-muted
  white:      "#FFFFFF",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function pctColor(pct: number): string {
  if (pct >= 100) return C.rose;
  if (pct >= 70)  return C.gold;
  return C.emerald;
}

// ── Mini inline bar for category breakdown ────────────────────
function categoryBar(name: string, amount: number, maxAmount: number): string {
  const barPct = maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0;
  return `
    <tr>
      <td style="padding: 5px 0; font-size: 12px; color: ${C.textSecond}; width: 130px;">${name}</td>
      <td style="padding: 5px 0;">
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr>
            <td style="background: ${C.navyBorder}; border-radius: 3px; height: 6px; width: 100%;">
              <div style="background: linear-gradient(90deg, ${C.crimson}, ${C.crimsonLight}); border-radius: 3px; height: 6px; width: ${barPct}%;"></div>
            </td>
          </tr>
        </table>
      </td>
      <td style="padding: 5px 0 5px 10px; font-size: 12px; color: ${C.textPrimary}; text-align: right; white-space: nowrap;">${formatINR(amount)}</td>
    </tr>`;
}

// ── Stat box (used in KPI row) ────────────────────────────────
function statBox(label: string, value: string, sub: string, color: string = C.textPrimary): string {
  return `
    <td style="width: 33%; padding: 16px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 10px; text-align: center; vertical-align: top;">
      <div style="font-size: 10px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">${label}</div>
      <div style="font-size: 22px; font-weight: 700; color: ${color}; margin-bottom: 4px;">${value}</div>
      <div style="font-size: 11px; color: ${C.textSecond};">${sub}</div>
    </td>`;
}

// ── Main template ─────────────────────────────────────────────
export function renderWeeklyDigestEmail(data: WeeklyDigestData, aiInsight?: string): string {
  const {
    weekLabel, monthLabel,
    weekSpend, weekIncome, weekSavings,
    weekTopCategories, monthSpend, monthIncome,
    savingsRate, investmentsTotal, investmentsGainLoss,
    netWorth, budgetAlerts, topTransactions,
  } = data;

  const savingsColor = weekSavings >= 0 ? C.emerald : C.rose;
  const gainColor    = investmentsGainLoss >= 0 ? C.emerald : C.rose;
  const gainPrefix   = investmentsGainLoss >= 0 ? "+" : "";
  const maxCatAmt    = weekTopCategories[0]?.amount ?? 1;

  // Budget alert rows
  const alertRows = budgetAlerts.length > 0
    ? budgetAlerts.map(a => `
        <tr>
          <td style="padding: 8px 0; font-size: 12px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">${a.category}</td>
          <td style="padding: 8px 0; text-align: center; font-size: 12px; color: ${pctColor(a.pct)}; border-bottom: 1px solid ${C.navyBorder};">${a.pct.toFixed(0)}% of limit</td>
          <td style="padding: 8px 0; text-align: right; font-size: 12px; color: ${C.textPrimary}; border-bottom: 1px solid ${C.navyBorder};">${formatINR(a.spent)} / ${formatINR(a.limit)}</td>
        </tr>`).join("")
    : `<tr><td colspan="3" style="padding: 16px; text-align: center; color: ${C.textMuted}; font-size: 13px;">✅ All budgets on track this week</td></tr>`;

  // Top transactions rows
  const txnRows = topTransactions.length > 0
    ? topTransactions.map(t => `
        <tr>
          <td style="padding: 8px 0; font-size: 12px; color: ${C.textPrimary}; border-bottom: 1px solid ${C.navyBorder}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.description}</td>
          <td style="padding: 8px 0; text-align: center; font-size: 11px; color: ${C.textMuted}; border-bottom: 1px solid ${C.navyBorder};">${t.category}</td>
          <td style="padding: 8px 0; text-align: right; font-size: 12px; color: ${C.rose}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 600;">−${formatINR(t.amount)}</td>
        </tr>`).join("")
    : `<tr><td colspan="3" style="padding: 16px; text-align: center; color: ${C.textMuted}; font-size: 13px;">No transactions this week</td></tr>`;

  const aiSection = aiInsight ? `
    <!-- AI Insight -->
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, rgba(232,37,58,0.12), rgba(16,217,140,0.06)); border: 1px solid rgba(232,37,58,0.22); border-radius: 12px;">
          <div style="font-size: 11px; color: ${C.crimsonLight}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">✨ AI Weekly Insight</div>
          <div style="font-size: 14px; color: ${C.textPrimary}; line-height: 1.7;">${aiInsight}</div>
        </td>
      </tr>
    </table>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FinDash Weekly Summary — ${weekLabel}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display: none; font-size: 1px; max-height: 0; overflow: hidden; color: #0A0A0A;">
    Your FinDash weekly summary for ${weekLabel} — Spent ${formatINR(weekSpend)}, Saved ${formatINR(weekSavings)} ✨
  </div>

  <!-- Outer wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #0A0A0A;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Email container -->
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 580px;">

          <!-- ── HEADER ─────────────────────────────────────── -->
          <tr>
            <td style="padding: 0 0 24px 0; text-align: center;">
              <!-- Logo wordmark -->
              <div style="display: inline-block; margin-bottom: 16px;">
                <span style="font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #E8253A, #FF6B6B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px;">FinDash</span>
              </div>
              <div style="font-size: 13px; color: ${C.textMuted}; margin-top: 4px; letter-spacing: 0.5px;">
                Weekly Summary &nbsp;·&nbsp; ${weekLabel}
              </div>
            </td>
          </tr>

          <!-- Divider line with gradient -->
          <tr>
            <td style="padding: 0 0 28px 0;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, ${C.crimson}, transparent);"></div>
            </td>
          </tr>

          <!-- ── THIS WEEK AT A GLANCE ───────────────────────── -->
          <tr>
            <td style="padding: 0 0 8px 0;">
              <div style="font-size: 11px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px;">📊 This Week at a Glance</div>
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: separate; border-spacing: 8px;">
                <tr>
                  ${statBox("Total Spent", formatINR(weekSpend), `${weekLabel.split("–")[0].trim()} to now`, C.rose)}
                  <td style="width: 8px;"></td>
                  ${statBox("Total Income", formatINR(weekIncome), "Received this week", C.emerald)}
                  <td style="width: 8px;"></td>
                  ${statBox("Net Savings", formatINR(Math.abs(weekSavings)), weekSavings >= 0 ? "Saved this week 🎉" : "Deficit this week", savingsColor)}
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height: 24px;"></td></tr>

          <!-- ── SPENDING BY CATEGORY ────────────────────────── -->
          ${weekTopCategories.length > 0 ? `
          <tr>
            <td style="padding: 20px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 12px; margin-bottom: 20px;">
              <div style="font-size: 11px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">🗂 Top Spending Categories</div>
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                ${weekTopCategories.map(c => categoryBar(c.name, c.amount, maxCatAmt)).join("")}
              </table>
            </td>
          </tr>
          <tr><td style="height: 16px;"></td></tr>` : ""}

          <!-- ── TOP TRANSACTIONS ────────────────────────────── -->
          <tr>
            <td style="padding: 20px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 12px;">
              <div style="font-size: 11px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">💳 Biggest Expenses This Week</div>
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <th style="text-align: left; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Description</th>
                  <th style="text-align: center; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Category</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Amount</th>
                </tr>
                ${txnRows}
              </table>
            </td>
          </tr>

          <tr><td style="height: 16px;"></td></tr>

          <!-- ── MONTH-TO-DATE & PORTFOLIO ──────────────────── -->
          <tr>
            <td style="padding: 20px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 12px;">
              <div style="font-size: 11px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">📅 Month-to-Date · ${monthLabel}</div>
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">Total Spend</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 13px; color: ${C.rose}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 600;">${formatINR(monthSpend)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">Total Income</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 13px; color: ${C.emerald}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 600;">${formatINR(monthIncome)}</td>
                </tr>
                ${savingsRate !== null ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">Savings Rate</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 13px; color: ${savingsRate >= 20 ? C.emerald : savingsRate >= 10 ? C.gold : C.rose}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 600;">${savingsRate.toFixed(1)}%</td>
                </tr>` : ""}
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">Portfolio Value</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 13px; color: ${C.textPrimary}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 600;">${formatINR(investmentsTotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">Portfolio Gain/Loss</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 13px; color: ${gainColor}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 600;">${gainPrefix}${formatINR(investmentsGainLoss)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: ${C.textPrimary}; font-weight: 600;">Net Worth</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: ${C.crimsonLight}; font-weight: 700;">${formatINR(netWorth)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height: 16px;"></td></tr>

          <!-- ── BUDGET ALERTS ───────────────────────────────── -->
          <tr>
            <td style="padding: 20px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 12px;">
              <div style="font-size: 11px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">🚨 Budget Watch</div>
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <th style="text-align: left; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Category</th>
                  <th style="text-align: center; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Usage</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Spent / Limit</th>
                </tr>
                ${alertRows}
              </table>
            </td>
          </tr>

          <tr><td style="height: 16px;"></td></tr>

          <!-- ── AI INSIGHT ──────────────────────────────────── -->
          ${aiSection}

          <!-- ── CTA BUTTON ──────────────────────────────────── -->
          <tr>
            <td style="text-align: center; padding: 8px 0 32px 0;">
              <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}"
                style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, ${C.crimson}, ${C.crimsonLight}); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">
                Open FinDash Dashboard →
              </a>
            </td>
          </tr>

          <!-- ── FOOTER ──────────────────────────────────────── -->
          <tr>
            <td style="padding: 0 0 8px 0;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, ${C.navyBorder}, transparent);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 0; text-align: center;">
              <div style="font-size: 11px; color: ${C.textMuted}; line-height: 1.8;">
                <strong style="color: ${C.textSecond};">FinDash</strong> — Your personal finance dashboard<br />
                This email was sent because you enabled weekly digests.<br />
                <span style="color: ${C.textMuted};">To stop receiving these, turn off Weekly Digest in Settings.</span>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
