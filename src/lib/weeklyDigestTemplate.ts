// ============================================================
// weeklyDigestTemplate.ts
// Generates a fully self-contained dark-themed HTML email for
// the weekly FinDash summary. Uses inline CSS only (required
// for broad email client support — Gmail, Apple Mail, Outlook).
//
// Sections:
//   1. This Week at a Glance
//   2. Top Spending Categories
//   3. Food & Dining Spotlight  ← NEW
//   4. Biggest Expenses This Week
//   5. Month-to-Date & Portfolio
//   6. Portfolio Movers (Top Gainers / Losers)  ← NEW
//   7. EMI Tracker Summary  ← NEW
//   8. Budget Watch
//   9. AI Weekly Insight
// ============================================================

import type { WeeklyDigestData } from "@/lib/weeklyDigestData";

// ── Colour tokens (matching app theme: charcoal dark + crimson red) ──
const C = {
  navy:        "#0A0A0A",
  navyCard:    "#111111",
  navyBorder:  "#2A2A2A",
  crimson:     "#E8253A",
  crimsonLight:"#FF3D52",
  emerald:     "#10D98C",
  gold:        "#FF6B6B",
  rose:        "#FF5C7A",
  amber:       "#F59E0B",
  orange:      "#F97316",
  sky:         "#38BDF8",
  textPrimary: "#F5F5F5",
  textSecond:  "#A0A0A0",
  textMuted:   "#555555",
  white:       "#FFFFFF",
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

// ── Shared: section heading ───────────────────────────────────
function sectionHeading(emoji: string, title: string): string {
  return `<div style="font-size: 11px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">${emoji} ${title}</div>`;
}

// ── Shared: card wrapper ──────────────────────────────────────
function card(content: string): string {
  return `
    <tr>
      <td style="padding: 20px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 12px;">
        ${content}
      </td>
    </tr>
    <tr><td style="height: 16px;"></td></tr>`;
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

// ── Row: key/value table row ──────────────────────────────────
function kvRow(label: string, value: string, valueColor: string = C.textPrimary, isLast = false): string {
  const border = isLast ? "" : `border-bottom: 1px solid ${C.navyBorder};`;
  return `
    <tr>
      <td style="padding: 8px 0; font-size: 13px; color: ${C.textSecond}; ${border}">${label}</td>
      <td style="padding: 8px 0; text-align: right; font-size: 13px; color: ${valueColor}; ${border} font-weight: 600;">${value}</td>
    </tr>`;
}

// ── Main template ─────────────────────────────────────────────
export function renderWeeklyDigestEmail(data: WeeklyDigestData, aiInsight?: string): string {
  const {
    weekLabel, monthLabel,
    weekSpend, weekIncome, weekSavings,
    weekTopCategories, monthSpend, monthIncome,
    savingsRate, investmentsTotal, investmentsGainLoss,
    topGainers, topLosers,
    netWorth, budgetAlerts, topTransactions,
    foodSpendThisMonth, avgDailyFoodSpend, foodTxnCount, foodSpendPct,
    activeEmiCount, totalMonthlyEmi, noCostEmiCount,
  } = data;

  const savingsColor = weekSavings >= 0 ? C.emerald : C.rose;
  const gainColor    = investmentsGainLoss >= 0 ? C.emerald : C.rose;
  const gainPrefix   = investmentsGainLoss >= 0 ? "+" : "";
  const maxCatAmt    = weekTopCategories[0]?.amount ?? 1;

  // ── Budget alert rows ────────────────────────────────────────
  const alertRows = budgetAlerts.length > 0
    ? budgetAlerts.map(a => `
        <tr>
          <td style="padding: 8px 0; font-size: 12px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">${a.category}</td>
          <td style="padding: 8px 0; text-align: center; font-size: 12px; color: ${pctColor(a.pct)}; border-bottom: 1px solid ${C.navyBorder};">${a.pct.toFixed(0)}% of limit</td>
          <td style="padding: 8px 0; text-align: right; font-size: 12px; color: ${C.textPrimary}; border-bottom: 1px solid ${C.navyBorder};">${formatINR(a.spent)} / ${formatINR(a.limit)}</td>
        </tr>`).join("")
    : `<tr><td colspan="3" style="padding: 16px; text-align: center; color: ${C.textMuted}; font-size: 13px;">✅ All budgets on track this week</td></tr>`;

  // ── Top transactions rows ────────────────────────────────────
  const txnRows = topTransactions.length > 0
    ? topTransactions.map(t => `
        <tr>
          <td style="padding: 8px 0; font-size: 12px; color: ${C.textPrimary}; border-bottom: 1px solid ${C.navyBorder}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.description}</td>
          <td style="padding: 8px 0; text-align: center; font-size: 11px; color: ${C.textMuted}; border-bottom: 1px solid ${C.navyBorder};">${t.category}</td>
          <td style="padding: 8px 0; text-align: right; font-size: 12px; color: ${C.rose}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 600;">−${formatINR(t.amount)}</td>
        </tr>`).join("")
    : `<tr><td colspan="3" style="padding: 16px; text-align: center; color: ${C.textMuted}; font-size: 13px;">No transactions this week</td></tr>`;

  // ── Food bar ─────────────────────────────────────────────────
  const foodBarPct   = Math.min(foodSpendPct, 100);
  const foodBarColor = foodSpendPct > 40
    ? `linear-gradient(90deg, ${C.orange}, ${C.rose})`
    : foodSpendPct > 25
    ? `linear-gradient(90deg, ${C.orange}, ${C.amber})`
    : `linear-gradient(90deg, ${C.orange}, ${C.emerald})`;
  const foodLabel = foodSpendPct > 40
    ? "⚠️ High food share — consider meal prepping"
    : foodSpendPct > 25
    ? "💡 Moderate — a notable chunk on food"
    : "✅ Well-balanced food spend";
  const foodBadgeColor = foodSpendPct > 40 ? C.rose : foodSpendPct > 25 ? C.amber : C.emerald;

  // ── Portfolio movers rows ─────────────────────────────────────
  const moverRows = (items: typeof topGainers, isGainer: boolean) =>
    items.map(h => {
      const color = isGainer ? C.emerald : C.rose;
      const prefix = isGainer ? "+" : "";
      return `
        <tr>
          <td style="padding: 7px 0; font-size: 12px; color: ${C.textPrimary}; border-bottom: 1px solid ${C.navyBorder}; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${h.name}</td>
          <td style="padding: 7px 0; text-align: right; font-size: 12px; color: ${color}; border-bottom: 1px solid ${C.navyBorder}; font-weight: 700;">${prefix}${h.gainLossPct.toFixed(1)}%</td>
          <td style="padding: 7px 0; text-align: right; font-size: 12px; color: ${C.textSecond}; border-bottom: 1px solid ${C.navyBorder};">${formatINR(h.currentValue)}</td>
        </tr>`;
    }).join("");

  const hasMovers = topGainers.length > 0 || topLosers.length > 0;

  // ── AI Insight section ────────────────────────────────────────
  const aiSection = aiInsight ? `
    <!-- AI Insight -->
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 0;">
      ${card(`
        ${sectionHeading("✨", "AI Weekly Insight")}
        <div style="font-size: 14px; color: ${C.textPrimary}; line-height: 1.8;">${aiInsight}</div>
      `)}
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
    FinDash ${weekLabel} — Spent ${formatINR(weekSpend)}, Food ${formatINR(foodSpendThisMonth)}, Portfolio ${gainPrefix}${formatINR(investmentsGainLoss)} ✨
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
              <div style="display: inline-block; margin-bottom: 16px;">
                <span style="font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #E8253A, #FF6B6B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px;">FinDash</span>
              </div>
              <div style="font-size: 13px; color: ${C.textMuted}; margin-top: 4px; letter-spacing: 0.5px;">
                Weekly Summary &nbsp;·&nbsp; ${weekLabel}
              </div>
            </td>
          </tr>

          <!-- Gradient divider -->
          <tr>
            <td style="padding: 0 0 28px 0;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, ${C.crimson}, transparent);"></div>
            </td>
          </tr>

          <!-- ── 1. THIS WEEK AT A GLANCE ───────────────────── -->
          <tr>
            <td style="padding: 0 0 8px 0;">
              <div style="font-size: 11px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px;">📊 This Week at a Glance</div>
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: separate; border-spacing: 8px;">
                <tr>
                  ${statBox("Total Spent",  formatINR(weekSpend),              `${weekLabel.split("–")[0].trim()} to now`, C.rose)}
                  <td style="width: 8px;"></td>
                  ${statBox("Total Income", formatINR(weekIncome),             "Received this week", C.emerald)}
                  <td style="width: 8px;"></td>
                  ${statBox("Net Savings",  formatINR(Math.abs(weekSavings)),  weekSavings >= 0 ? "Saved this week 🎉" : "Deficit this week", savingsColor)}
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height: 24px;"></td></tr>

          <!-- ── 2. SPENDING BY CATEGORY ────────────────────── -->
          ${weekTopCategories.length > 0 ? `
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            ${card(`
              ${sectionHeading("🗂", "Top Spending Categories")}
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                ${weekTopCategories.map(c => categoryBar(c.name, c.amount, maxCatAmt)).join("")}
              </table>
            `)}
          </table>` : ""}

          <!-- ── 3. FOOD & DINING SPOTLIGHT ─────────────────── -->
          ${foodSpendThisMonth > 0 ? `
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            ${card(`
              ${sectionHeading("🍽️", "Food &amp; Dining Spotlight")}

              <!-- 3 mini stat boxes -->
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: separate; border-spacing: 6px; margin-bottom: 16px;">
                <tr>
                  <td style="width: 33%; padding: 12px; background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2); border-radius: 8px; text-align: center;">
                    <div style="font-size: 10px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Avg Daily</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${C.orange};">${formatINR(avgDailyFoodSpend)}</div>
                    <div style="font-size: 10px; color: ${C.textSecond};">per day this month</div>
                  </td>
                  <td style="width: 6px;"></td>
                  <td style="width: 33%; padding: 12px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 8px; text-align: center;">
                    <div style="font-size: 10px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">This Month</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${C.textPrimary};">${formatINR(foodSpendThisMonth)}</div>
                    <div style="font-size: 10px; color: ${C.textSecond};">${foodTxnCount} transaction${foodTxnCount !== 1 ? "s" : ""}</div>
                  </td>
                  <td style="width: 6px;"></td>
                  <td style="width: 33%; padding: 12px; background: ${C.navyCard}; border: 1px solid ${C.navyBorder}; border-radius: 8px; text-align: center;">
                    <div style="font-size: 10px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">% of Spend</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${foodBadgeColor};">${foodSpendPct.toFixed(1)}%</div>
                    <div style="font-size: 10px; color: ${C.textSecond};">of total spend</div>
                  </td>
                </tr>
              </table>

              <!-- Share bar -->
              <div style="background: rgba(255,255,255,0.04); border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 8px;">
                <div style="background: ${foodBarColor}; border-radius: 4px; height: 8px; width: ${foodBarPct}%;"></div>
              </div>
              <div style="font-size: 11px; color: ${C.textSecond}; text-align: right;">${foodLabel}</div>
            `)}
          </table>` : ""}

          <!-- ── 4. BIGGEST EXPENSES THIS WEEK ──────────────── -->
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            ${card(`
              ${sectionHeading("💳", "Biggest Expenses This Week")}
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <th style="text-align: left; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Description</th>
                  <th style="text-align: center; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Category</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Amount</th>
                </tr>
                ${txnRows}
              </table>
            `)}
          </table>

          <!-- ── 5. MONTH-TO-DATE & PORTFOLIO ───────────────── -->
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            ${card(`
              ${sectionHeading("📅", `Month-to-Date · ${monthLabel}`)}
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                ${kvRow("Total Spend",       formatINR(monthSpend),  C.rose)}
                ${kvRow("Total Income",      formatINR(monthIncome), C.emerald)}
                ${savingsRate !== null ? kvRow("Savings Rate", `${savingsRate.toFixed(1)}%`, savingsRate >= 20 ? C.emerald : savingsRate >= 10 ? C.gold : C.rose) : ""}
                ${kvRow("Portfolio Value",   formatINR(investmentsTotal))}
                ${kvRow("Portfolio Gain/Loss", `${gainPrefix}${formatINR(investmentsGainLoss)}`, gainColor)}
                ${kvRow("Net Worth",         formatINR(netWorth), C.crimsonLight, true)}
              </table>
            `)}
          </table>

          <!-- ── 6. PORTFOLIO MOVERS ────────────────────────── -->
          ${hasMovers ? `
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            ${card(`
              ${sectionHeading("📈", "Portfolio Movers")}
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">

                ${topGainers.length > 0 ? `
                <!-- Gainers header -->
                <tr>
                  <td colspan="3" style="padding: 4px 0 6px 0;">
                    <span style="font-size: 11px; font-weight: 600; color: ${C.emerald}; text-transform: uppercase; letter-spacing: 1px;">▲ Top Gainers</span>
                  </td>
                </tr>
                <tr>
                  <th style="text-align: left; font-size: 10px; color: ${C.textMuted}; padding-bottom: 6px; font-weight: 400;">Holding</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 6px; font-weight: 400;">Return</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 6px; font-weight: 400;">Value</th>
                </tr>
                ${moverRows(topGainers, true)}` : ""}

                ${topLosers.length > 0 ? `
                <!-- Spacer between gainers and losers -->
                ${topGainers.length > 0 ? `<tr><td colspan="3" style="height: 12px;"></td></tr>` : ""}
                <!-- Losers header -->
                <tr>
                  <td colspan="3" style="padding: 4px 0 6px 0;">
                    <span style="font-size: 11px; font-weight: 600; color: ${C.rose}; text-transform: uppercase; letter-spacing: 1px;">▼ Under Pressure</span>
                  </td>
                </tr>
                <tr>
                  <th style="text-align: left; font-size: 10px; color: ${C.textMuted}; padding-bottom: 6px; font-weight: 400;">Holding</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 6px; font-weight: 400;">Return</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 6px; font-weight: 400;">Value</th>
                </tr>
                ${moverRows(topLosers, false)}` : ""}

              </table>
            `)}
          </table>` : ""}

          <!-- ── 7. EMI TRACKER SUMMARY ─────────────────────── -->
          ${activeEmiCount > 0 ? `
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            ${card(`
              ${sectionHeading("📱", "EMI Tracker")}
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                ${kvRow("Active EMIs",        `${activeEmiCount} EMI${activeEmiCount !== 1 ? "s" : ""}`)}
                ${kvRow("Monthly Outflow",    formatINR(totalMonthlyEmi), C.rose)}
                ${noCostEmiCount > 0 ? kvRow("No-Cost EMIs", `${noCostEmiCount} (0% interest ✓)`, C.emerald, true) : kvRow("Interest-Free", "None active", C.textMuted, true)}
              </table>
            `)}
          </table>` : ""}

          <!-- ── 8. BUDGET ALERTS ───────────────────────────── -->
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            ${card(`
              ${sectionHeading("🚨", "Budget Watch")}
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <th style="text-align: left; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Category</th>
                  <th style="text-align: center; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Usage</th>
                  <th style="text-align: right; font-size: 10px; color: ${C.textMuted}; padding-bottom: 8px; font-weight: 500;">Spent / Limit</th>
                </tr>
                ${alertRows}
              </table>
            `)}
          </table>

          <!-- ── 9. AI INSIGHT ──────────────────────────────── -->
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
