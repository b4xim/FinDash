// ============================================================
// POST /api/credit-cards/fetch
// Fetches credit card billing statements from Gmail for all 7
// configured cards. Runs all cards in parallel via Promise.allSettled().
// Results are upserted into credit_card_bills table.
//
// Card configs (sender, password) come from credit_card_config table.
// Regex patterns and UI config come from /lib/creditCardConfig.ts.
// Gmail auth reuses the existing token infrastructure in /lib/gmail.ts.
//
// Returns: { results: CardFetchResult[], successCount, totalCount }
// ============================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import {
  getValidAccessToken,
  searchMessages,
  getMessageDetail,
  extractHtmlBody,
  downloadAttachment,
} from "@/lib/gmail";
import { CREDIT_CARD_CONFIGS, getCurrentStatementMonth } from "@/lib/creditCardConfig";
import { getAllCardConfigs, upsertBill, autoMarkOverdue } from "@/lib/creditCardQueries";
// pdfParser is imported dynamically inside fetchPdfCard to avoid
// pdfjs-dist crashing the route module at startup in the Next.js server environment.
import { CreditCardUIConfig, CreditCardConfig } from "@/types";

// ── Result type for a single card fetch ──────────────────────
interface CardFetchResult {
  cardName: string;
  success: boolean;
  error?: string;
  totalAmountDue?: number;
  minimumDue?: number;
  dueDate?: string | null;
  statementMonth?: string;
}

// ── Parse amount from various string formats ──────────────────
function parseAmount(raw: string | undefined | null): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/,/g, "").trim()) || 0;
}

// ── Parse date to ISO format ──────────────────────────────────
function parseDateToISO(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // DD-Mon-YYYY or "DD Mon YYYY" e.g. "15-Jul-2026", "15 Jul 2026"
  const ddMonyyyy = s.match(/^(\d{1,2})[\s\-](\w{3,})[\s\-](\d{4})$/);
  if (ddMonyyyy) {
    const [, dd, mon, yyyy] = ddMonyyyy;
    const d = new Date(`${dd} ${mon} ${yyyy}`);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  // Native Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
}

// ── Derive statement month from a due date ────────────────────
function deriveStatementMonth(dueDate: string | null): string {
  if (dueDate) {
    // Statement is typically the month before the due date
    const d = new Date(dueDate);
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }
  return getCurrentStatementMonth();
}

// ── Build Gmail search query for a card ──────────────────────
function buildCardQuery(
  senderEmail: string,
  subjectKeyword: string,
  excludeKeyword?: string
): string {
  // Search last 45 days to cover any billing cycle
  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
  const afterTimestamp = Math.floor(fortyFiveDaysAgo.getTime() / 1000);

  let query = `from:${senderEmail} subject:"${subjectKeyword}" after:${afterTimestamp}`;
  if (excludeKeyword) {
    query += ` -subject:"${excludeKeyword}"`;
  }
  return query;
}

// ── Fetch an email-body card ──────────────────────────────────
async function fetchEmailBodyCard(
  accessToken: string,
  config: CreditCardUIConfig,
  dbConfig: CreditCardConfig | undefined
): Promise<Omit<CardFetchResult, "cardName">> {
  const senderEmail = dbConfig?.sender_email ?? "";

  // ICICI Coral Rupay: exclude "Amazon Pay" from results to avoid
  // matching Amazon Pay ICICI emails (same sender, different subject)
  const excludeKeyword =
    config.cardName === "ICICI Coral Rupay" ? "Amazon Pay" : undefined;

  const query = buildCardQuery(senderEmail, config.subjectKeyword, excludeKeyword);
  const messages = await searchMessages(accessToken, query, 5);

  if (messages.length === 0) {
    return { success: false, error: "No matching email found in the last 45 days" };
  }

  // Take the most recent message
  const detail = await getMessageDetail(accessToken, messages[0].id);
  const htmlBody = extractHtmlBody(detail.payload);

  const totalMatch   = config.totalRegex.exec(htmlBody);
  const dueDateMatch = config.dueDateRegex.exec(htmlBody);
  const minDueMatch  = config.minDueRegex.exec(htmlBody);

  const totalAmountDue = parseAmount(totalMatch?.[1]);
  const minimumDue     = parseAmount(minDueMatch?.[1]);
  const dueDate        = parseDateToISO(dueDateMatch?.[1]);
  const statementMonth = deriveStatementMonth(dueDate);

  if (totalAmountDue === 0 && !dueDate) {
    return { success: false, error: "Could not parse amount or due date from email" };
  }

  return {
    success: true,
    totalAmountDue,
    minimumDue,
    dueDate,
    statementMonth,
  };
}

// ── Find a PDF attachment recursively in a Gmail payload ──────
interface GmailPart {
  mimeType: string;
  filename?: string;
  body?: { attachmentId?: string; data?: string };
  parts?: GmailPart[];
}

function findPdfAttachment(
  parts: GmailPart[],
  filenamePattern?: RegExp
): { attachmentId: string; filename: string } | null {
  for (const part of parts) {
    if (part.mimeType === "application/pdf" && part.body?.attachmentId) {
      const filename = part.filename || "";
      if (!filenamePattern || filenamePattern.test(filename)) {
        return { attachmentId: part.body.attachmentId, filename };
      }
    }
    if (part.parts) {
      const found = findPdfAttachment(part.parts, filenamePattern);
      if (found) return found;
    }
  }
  return null;
}

// ── Fetch a PDF-attachment card ───────────────────────────────
async function fetchPdfCard(
  accessToken: string,
  config: CreditCardUIConfig,
  dbConfig: CreditCardConfig | undefined
): Promise<Omit<CardFetchResult, "cardName">> {
  if (!dbConfig?.pdf_password) {
    return {
      success: false,
      error: "PDF password not configured in credit_card_config table",
    };
  }

  const query = buildCardQuery(dbConfig.sender_email, config.subjectKeyword);
  const messages = await searchMessages(accessToken, query, 5);

  if (messages.length === 0) {
    return { success: false, error: "No matching email found in the last 45 days" };
  }

  const detail = await getMessageDetail(accessToken, messages[0].id);
  const allParts = (detail.payload.parts as GmailPart[] | undefined) ?? [];
  const pdfAttachment = findPdfAttachment(allParts, config.pdfFilenamePattern);

  if (!pdfAttachment) {
    return { success: false, error: "No PDF attachment found in email" };
  }

  const encryptedBuffer = await downloadAttachment(
    accessToken,
    messages[0].id,
    pdfAttachment.attachmentId
  );

  // Dynamic import: avoids pdfjs-dist crashing the route module at load time
  const { parsePdfStatement } = await import("@/lib/pdfParser");
  const parsed = await parsePdfStatement(encryptedBuffer, dbConfig.pdf_password, config);

  if (parsed.totalAmountDue === null && !parsed.dueDate) {
    return {
      success: false,
      error: "Could not parse amount or due date from PDF",
    };
  }

  return {
    success: true,
    totalAmountDue: parsed.totalAmountDue ?? 0,
    minimumDue: parsed.minimumDue ?? 0,
    dueDate: parsed.dueDate,
    statementMonth: parsed.statementMonth,
  };
}

// ── Main POST handler ─────────────────────────────────────────
export async function POST() {
  // Top-level guard: any unhandled throw returns clean JSON (not an HTML 500 page).
  // Without this, Next.js returns HTML on crash, res.json() throws on the client,
  // and the error detail is completely hidden.
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected. Go to Settings to connect your Gmail account." },
        { status: 400 }
      );
    }

    // Load DB configs (includes pdf_password — never logged or returned to client)
    let dbConfigs: CreditCardConfig[];
    try {
      dbConfigs = await getAllCardConfigs();
    } catch (err) {
      console.error("Failed to load credit_card_config from DB:", err);
      return NextResponse.json(
        {
          error:
            "Could not read credit_card_config table. Have you run the Supabase migration?\n" +
            (err instanceof Error ? err.message : String(err)),
        },
        { status: 500 }
      );
    }
    const dbConfigByName = Object.fromEntries(dbConfigs.map(c => [c.card_name, c]));

    // Run all 7 cards in parallel via Promise.allSettled
    const fetchPromises = CREDIT_CARD_CONFIGS.map(config => {
      const dbConfig = dbConfigByName[config.cardName];
      const fetchFn =
        config.amountSource === "pdf"
          ? fetchPdfCard(accessToken, config, dbConfig)
          : fetchEmailBodyCard(accessToken, config, dbConfig);

      return fetchFn
        .then(async result => {
          const cardResult: CardFetchResult = { cardName: config.cardName, ...result };

          // On success, upsert the bill into the database
          if (result.success && result.totalAmountDue !== undefined) {
            await upsertBill({
              card_name: config.cardName,
              sender_email: dbConfig?.sender_email ?? null,
              total_amount_due: result.totalAmountDue,
              minimum_due: result.minimumDue ?? 0,
              due_date: result.dueDate ?? null,
              statement_month: result.statementMonth ?? getCurrentStatementMonth(),
              last_fetched_at: new Date().toISOString(),
            });
          }

          return cardResult;
        })
        .catch(err => ({
          cardName: config.cardName,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }));
    });

    const settled = await Promise.allSettled(fetchPromises);
    const cardResults: CardFetchResult[] = settled.map(r =>
      r.status === "fulfilled"
        ? r.value
        : { cardName: "Unknown", success: false, error: "Unexpected fetch error" }
    );

    // Auto-mark past-due unpaid bills as Overdue (non-fatal side effect)
    await autoMarkOverdue();

    const successCount = cardResults.filter(r => r.success).length;

    return NextResponse.json({
      successCount,
      totalCount: CREDIT_CARD_CONFIGS.length,
      results: cardResults.map(r => ({
        cardName: r.cardName,
        success: r.success,
        error: r.error,
        totalAmountDue: r.totalAmountDue,
        dueDate: r.dueDate,
        statementMonth: r.statementMonth,
      })),
    });
  } catch (err) {
    // Catch-all: log the real error server-side, return clean JSON to the client
    console.error("POST /api/credit-cards/fetch unhandled error:", err);
    return NextResponse.json(
      {
        error:
          "Unexpected server error: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 500 }
    );
  }
}
