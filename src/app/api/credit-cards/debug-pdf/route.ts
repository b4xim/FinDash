// ============================================================
// GET /api/credit-cards/debug-pdf?card=TATA+NEU+HDFC+Plus+Rupay
// TEMPORARY diagnostic endpoint — dumps the raw text extracted
// from the PDF attachment for the given card.
// DELETE THIS FILE after debugging is complete.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  getValidAccessToken,
  searchMessages,
  getMessageDetail,
  downloadAttachment,
} from "@/lib/gmail";
import { getAllCardConfigs } from "@/lib/creditCardQueries";
import { CREDIT_CARD_CONFIGS } from "@/lib/creditCardConfig";

export async function GET(req: NextRequest) {
  try {
    const cardName = req.nextUrl.searchParams.get("card") ?? "Federal Bank Signet";

    const accessToken = await getValidAccessToken();
    if (!accessToken) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

    const config = CREDIT_CARD_CONFIGS.find(c => c.cardName === cardName);
    if (!config) return NextResponse.json({ error: `Card not found: ${cardName}` }, { status: 400 });

    const dbConfigs = await getAllCardConfigs();
    const dbConfig = dbConfigs.find(c => c.card_name === cardName);
    
    if (!dbConfig?.pdf_password) {
      return NextResponse.json({ error: "PDF password missing in DB for this card" }, { status: 400 });
    }

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
    
    // Find PDF attachment ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findPdf = (parts: any[]): { attachmentId: string; filename: string } | null => {
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith(".pdf")) {
          if (config!.pdfFilenamePattern && !config!.pdfFilenamePattern.test(part.filename)) {
            continue;
          }
          if (part.body?.attachmentId) {
            return { attachmentId: part.body.attachmentId, filename: part.filename };
          }
        }
        if (part.parts) {
          const found = findPdf(part.parts);
          if (found) return found;
        }
      }
      return null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allParts = (detail.payload.parts as any[]) ?? [];
    const pdfInfo = findPdf(allParts);

    if (!pdfInfo) {
      return NextResponse.json({
        error: "No PDF attachment found",
        messageId: messages[0].id,
        attachments: allParts.flatMap(p => [p.filename, ...(p.parts ?? []).map((x: any) => x.filename)]).filter(Boolean),
      });
    }

    const encryptedBuffer = await downloadAttachment(
      accessToken,
      messages[0].id,
      pdfInfo.attachmentId
    );

    const { extractPdfText } = await import("@/lib/pdfParser");
    let rawText = "";
    let extractError = null;
    let successfulPassword = null;

    const passwordsToTry = [
      dbConfig.pdf_password,
      dbConfig.pdf_password.toLowerCase(),
      dbConfig.pdf_password.toUpperCase(),
      dbConfig.pdf_password.charAt(0).toUpperCase() + dbConfig.pdf_password.slice(1).toLowerCase()
    ];

    for (const pwd of passwordsToTry) {
      try {
        rawText = await extractPdfText(encryptedBuffer, pwd);
        successfulPassword = pwd;
        extractError = null; // cleared
        break; // Success!
      } catch (err) {
        extractError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!successfulPassword) {
       return NextResponse.json({ 
         error: "PDF decryption/parsing failed with all password variants", 
         extractError, 
         passwordsTried: passwordsToTry 
       });
    }
    
    // Dynamic import to test fetchPdfCard from the actual fetch route logic
    const { parsePdfStatement } = await import("@/lib/pdfParser");
    let fetchResult = null;
    let fetchError = null;
    try {
      fetchResult = await parsePdfStatement(encryptedBuffer, dbConfig.pdf_password, config);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      cardName,
      query,
      messageId: messages[0].id,
      textLength: rawText.length,
      fetchResult,
      fetchError,
      snippets: {
        aroundTotalAmountDue: '' /*findContext(rawText, "Total Amount Due"),
        aroundMinimumDue:     findContext(rawText, "Minimum"),
        aroundPaymentDue:     '' /*findContext(rawText, "Due Date"),*/
      }
    });
  } catch (err) {
    console.error("debug-pdf error:", err);
    return NextResponse.json(
      { error: "Unhandled error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
