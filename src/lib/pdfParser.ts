// ============================================================
// PDF Parser — password-protected PDF decryption + text extraction
// Used for Federal Bank Signet and TATA NEU HDFC Plus Rupay cards,
// both of which send statements as encrypted PDF attachments.
//
// Libraries:
//   pdf-lib  — pure JS PDF manipulation, handles decryption
//   pdf-parse — class-based PDF text extraction (new API: PDFParse class)
// Both are Vercel serverless compatible (no native binaries).
//
// NOTE ON VERCEL LIMITS:
//   - Hobby plan: 10s timeout. Pro plan: 60s timeout.
//   - pdf-lib decryption is fast (pure JS). pdf-parse via pdfjs-dist
//     loads lazily — first call may be slow on cold start. Consider
//     upgrading to Vercel Pro if PDF parsing times out on Hobby plan.
// ============================================================

import { PDFDocument } from "pdf-lib";
import { CreditCardUIConfig } from "@/types";

// ── Parsed data from a PDF statement ─────────────────────────
export interface ParsedBillData {
  totalAmountDue: number | null;
  minimumDue: number | null;
  dueDate: string | null;         // ISO date string "YYYY-MM-DD"
  statementMonth: string;         // e.g. "Jul 2026"
}

// ── Decrypt a password-protected PDF ─────────────────────────
/**
 * Uses pdf-lib to remove encryption from a password-protected PDF.
 * Returns a new Buffer containing the decrypted (unlocked) PDF.
 * Throws if the password is wrong or the PDF is corrupt.
 */
export async function decryptPdf(encryptedBuffer: Buffer, password: string): Promise<Buffer> {
  try {
    // pdf-lib's LoadOptions type doesn't include 'password' in TS types,
    // but the runtime implementation fully supports it. Cast to any here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfDoc = await PDFDocument.load(encryptedBuffer, {
      ignoreEncryption: false,
      password,
    } as any);

    // Re-save without encryption
    const decryptedBytes = await pdfDoc.save();
    return Buffer.from(decryptedBytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF decryption failed (wrong password or corrupt PDF): ${message}`);
  }
}

// ── Extract text from a password-protected PDF ────────────────
/**
 * Uses pdf-parse (PDFParse class API) to extract text from a PDF buffer.
 * It natively handles decryption via pdfjs-dist if the password is provided.
 */
export async function extractPdfText(buffer: Buffer, password?: string): Promise<string> {
  try {
    // Polyfill DOMMatrix for Vercel Node 18/20 environments
    // We do this inside the function to avoid ES module import hoisting!
    if (typeof globalThis !== "undefined" && !(globalThis as any).DOMMatrix) {
      (globalThis as any).DOMMatrix = require("dommatrix");
    }
    if (typeof global !== "undefined" && !(global as any).DOMMatrix) {
      (global as any).DOMMatrix = require("dommatrix");
    }

    // Dynamically require pdf-parse AFTER polyfilling
    const pdfParseMod = require("pdf-parse");
    const PDFParseClass = pdfParseMod.PDFParse;
    
    const parser = new PDFParseClass({ data: buffer, password });
    const result = await parser.getText();
    await parser.destroy();
    return result.text ?? "";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF text extraction failed: ${message}`);
  }
}

// ── Parse amount string like "12,345.67" or "12345" → number ──
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ── Parse a date string into ISO format ──────────────────────
function parseDateToISO(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // DD-Mon-YYYY e.g. "15-Jul-2026" or "15 Jul 2026"
  const ddMonyyyy = s.match(/^(\d{1,2})[\s\-](\w{3,})[\s\-](\d{4})$/);
  if (ddMonyyyy) {
    const [, dd, mon, yyyy] = ddMonyyyy;
    const date = new Date(`${dd} ${mon} ${yyyy}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  // Native Date parse as last resort (prevent timezone shifting by treating as UTC)
  const d = new Date(s + " UTC");
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
}

// ── Derive statement month from a due date or current date ────
function deriveStatementMonth(dueDate: string | null): string {
  if (dueDate) {
    // Statement month is typically the month before the due date
    const d = new Date(dueDate);
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }
  return new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// ── Full pipeline: decrypt → extract text → parse amounts ─────
/**
 * Combined function: decrypts the PDF, extracts text, then applies
 * the card-specific regex patterns to extract billing data.
 */
export async function parsePdfStatement(
  encryptedBuffer: Buffer,
  password: string,
  config: CreditCardUIConfig
): Promise<ParsedBillData> {
  // Try multiple password casings (banks often enforce strict casing that users get wrong)
  const passwordsToTry = [
    password,
    password.toLowerCase(),
    password.toUpperCase(),
    password.charAt(0).toUpperCase() + password.slice(1).toLowerCase()
  ];

  let text = "";
  let success = false;
  let lastErr = null;

  for (const pwd of passwordsToTry) {
    try {
      text = await extractPdfText(encryptedBuffer, pwd);
      success = true;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!success) {
    throw lastErr;
  }

  // Step 3: Apply regex patterns
  const totalMatch   = config.totalRegex.exec(text);
  const dueDateMatch = config.dueDateRegex.exec(text);
  const minDueMatch  = config.minDueRegex.exec(text);

  const totalAmountDue = parseAmount(totalMatch?.[1]);
  const minimumDue     = parseAmount(minDueMatch?.[1]);
  const dueDate        = parseDateToISO(dueDateMatch?.[1]);
  const statementMonth = deriveStatementMonth(dueDate);

  return { totalAmountDue, minimumDue, dueDate, statementMonth };
}
