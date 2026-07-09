// ============================================================
// GET /api/credit-cards/debug-email?card=Axis+Privilege
// TEMPORARY diagnostic endpoint — dumps the raw HTML body of the
// most recent Gmail statement email for the given card.
// DELETE THIS FILE after debugging is complete.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  getValidAccessToken,
  searchMessages,
  getMessageDetail,
  extractHtmlBody,
} from "@/lib/gmail";
import { getAllCardConfigs } from "@/lib/creditCardQueries";
import { CREDIT_CARD_CONFIGS } from "@/lib/creditCardConfig";

export async function GET(req: NextRequest) {
  const cardName = req.nextUrl.searchParams.get("card") ?? "Axis Privilege";

  const accessToken = await getValidAccessToken();
  if (!accessToken) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  const config = CREDIT_CARD_CONFIGS.find(c => c.cardName === cardName);
  if (!config) return NextResponse.json({ error: `Card not found: ${cardName}` }, { status: 400 });

  const dbConfigs = await getAllCardConfigs();
  const dbConfig = dbConfigs.find(c => c.card_name === cardName);

  const senderEmail = dbConfig?.sender_email ?? "";
  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
  const afterTimestamp = Math.floor(fortyFiveDaysAgo.getTime() / 1000);
  const query = `from:${senderEmail} subject:"${config.subjectKeyword}" after:${afterTimestamp}`;

  const messages = await searchMessages(accessToken, query, 3);
  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages found", query });
  }

  const detail = await getMessageDetail(accessToken, messages[0].id);
  const html = extractHtmlBody(detail.payload);

  // Find targeted snippets around key phrases (more useful than raw first 3000 chars)
  function findContext(html: string, phrase: string, chars = 300): string {
    const idx = html.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx === -1) return `[phrase "${phrase}" NOT FOUND in HTML]`;
    return html.slice(Math.max(0, idx - 50), idx + chars);
  }

  const totalMatch   = config.totalRegex.exec(html);
  const minDueMatch  = config.minDueRegex.exec(html);
  const dueDateMatch = config.dueDateRegex.exec(html);

  return NextResponse.json({
    cardName,
    query,
    messageId: messages[0].id,
    htmlLength: html.length,
    snippets: {
      aroundTotalAmountDue: findContext(html, "Total Amount Due"),
      aroundMinimumDue:     findContext(html, "Minimum"),
      aroundPaymentDue:     findContext(html, "Payment Due"),
    },
    regexResults: {
      totalRegex:   totalMatch   ? { matched: true,  capture: totalMatch[1]   } : { matched: false },
      minDueRegex:  minDueMatch  ? { matched: true,  capture: minDueMatch[1]  } : { matched: false },
      dueDateRegex: dueDateMatch ? { matched: true,  capture: dueDateMatch[1] } : { matched: false },
    },
  });
}
