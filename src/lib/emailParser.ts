// ============================================================
// Email Parser — extracts best-guess transaction data from
// bank/card alert emails and investment confirmation emails.
//
// IMPORTANT: This is intentionally a "best guess" parser. Bank
// email formats change, vary by account, and aren't guaranteed
// to match these patterns perfectly. That's exactly why every
// parsed result goes into a REVIEW QUEUE instead of being saved
// directly — see /api/sync and the Sync page.
//
// Each parser below is a small, focused function for one sender.
// To add a new bank/platform: add its sender to RELEVANT_SENDERS
// in lib/gmail.ts, then add a parser function + dispatch case here.
// ============================================================

import { Category, TransactionType } from "@/types";

export interface ParsedTransaction {
  date: string | null;        // ISO date, or null if we couldn't extract it
  description: string | null; // Merchant/description
  amount: number | null;
  type: TransactionType | null;
  category: Category;
  account: string | null;     // e.g. "ICICI Credit Card"
  card_last4: string | null;  // Last 4 digits, if a card transaction
  confidence: "high" | "medium" | "low"; // How much we trust this parse
}

// ── Category guessing — simple keyword matching on merchant name ──
function guessCategory(description: string): Category {
  const d = description.toLowerCase();

  if (/swiggy|zomato|restaurant|cafe|food|dine|eat/.test(d)) return "Food & Dining";
  if (/amazon|flipkart|myntra|ajio|shopping|mall|store/.test(d)) return "Shopping";
  if (/uber|ola|rapido|fuel|petrol|diesel|metro|irctc|fly|flight/.test(d)) return "Transport";
  if (/electricity|water bill|gas bill|broadband|wifi|recharge|airtel|jio|vodafone/.test(d)) return "Utilities";
  if (/netflix|spotify|prime video|hotstar|bookmyshow|movie/.test(d)) return "Entertainment";
  if (/hospital|pharmacy|clinic|medical|apollo|doctor/.test(d)) return "Healthcare";
  if (/zerodha|groww|5paisa|sip|mutual fund|nse|bse|stock/.test(d)) return "Investment";
  if (/salary|credited|refund|cashback/.test(d)) return "Income";

  return "Other";
}

// ── Generic amount extractor — looks for "Rs. 1,234.56" or "INR 1234" patterns ──
function extractAmount(text: string): number | null {
  const match = text.match(/(?:Rs\.?|INR)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ""));
}

// ── Generic last-4-digits extractor — looks for "ending 1234" or "XX1234" ──
function extractLast4(text: string): string | null {
  const match = text.match(/(?:ending|XX|xx|card no\.?\s*)(\d{4})\b/i);
  return match ? match[1] : null;
}

// ── Generic date extractor — looks for common date formats ──
function extractDate(text: string, fallbackDate: string): string {
  // Try DD-MM-YYYY or DD/MM/YYYY
  const match = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return fallbackDate; // Fall back to the email's received date
}

// ============================================================
// ICICI Bank credit card alerts
// Typical format: "Rs.450.00 spent on ICICI Bank Card XX1234 at
// SWIGGY on 15-06-26. Avl limit: Rs.50000"
// ============================================================
function parseICICI(subject: string, body: string, receivedDate: string): ParsedTransaction {
  const text = `${subject} ${body}`;
  const amount = extractAmount(text);
  const last4 = extractLast4(text);
  const date = extractDate(text, receivedDate);

  // Merchant — text between "at" and "on" is the common pattern
  const merchantMatch = text.match(/at\s+([A-Za-z0-9\s&.'-]+?)\s+on\s+\d/i);
  const description = merchantMatch ? merchantMatch[1].trim() : "ICICI Card Transaction";

  // Determine debit vs credit
  const isCredit = /credited|refund|reversed/i.test(text);

  return {
    date,
    description,
    amount,
    type: isCredit ? "credit" : "debit",
    category: guessCategory(description),
    account: "ICICI Credit Card",
    card_last4: last4,
    confidence: amount && description !== "ICICI Card Transaction" ? "high" : "medium",
  };
}

// ============================================================
// SBI Card alerts
// Typical format: "Rs 1,200.00 spent on your SBI Card ending 5678
// at AMAZON on 15-Jun-26"
// ============================================================
function parseSBICard(subject: string, body: string, receivedDate: string): ParsedTransaction {
  const text = `${subject} ${body}`;
  const amount = extractAmount(text);
  const last4 = extractLast4(text);
  const date = extractDate(text, receivedDate);

  const merchantMatch = text.match(/at\s+([A-Za-z0-9\s&.'-]+?)\s+on\s+\d/i);
  const description = merchantMatch ? merchantMatch[1].trim() : "SBI Card Transaction";

  const isCredit = /credited|refund|reversed|payment received/i.test(text);

  return {
    date,
    description,
    amount,
    type: isCredit ? "credit" : "debit",
    category: guessCategory(description),
    account: "SBI Credit Card",
    card_last4: last4,
    confidence: amount && description !== "SBI Card Transaction" ? "high" : "medium",
  };
}

// ============================================================
// Axis Bank alerts (can be card or account alerts)
// Typical format: "INR 850.00 debited from A/c XX1234 on 15-06-26
// at MERCHANT NAME"
// ============================================================
function parseAxis(subject: string, body: string, receivedDate: string): ParsedTransaction {
  const text = `${subject} ${body}`;
  const amount = extractAmount(text);
  const last4 = extractLast4(text);
  const date = extractDate(text, receivedDate);

  const merchantMatch = text.match(/at\s+([A-Za-z0-9\s&.'-]+?)(?:\.|$|\s+on)/i);
  const description = merchantMatch ? merchantMatch[1].trim() : "Axis Bank Transaction";

  const isCredit = /credited|refund|reversed/i.test(text);
  const isCard = /card/i.test(text);

  return {
    date,
    description,
    amount,
    type: isCredit ? "credit" : "debit",
    category: guessCategory(description),
    account: isCard ? "Axis Credit Card" : "Axis Bank Account",
    card_last4: isCard ? last4 : null,
    confidence: amount && description !== "Axis Bank Transaction" ? "high" : "medium",
  };
}

// ============================================================
// Zerodha — SIP confirmations, order confirmations
// Typical format: "Your SIP order for Rs.5000 in PARAG PARIKH
// FLEXI CAP FUND has been placed"
// ============================================================
function parseZerodha(subject: string, body: string, receivedDate: string): ParsedTransaction {
  const text = `${subject} ${body}`;
  const amount = extractAmount(text);
  const date = extractDate(text, receivedDate);

  const fundMatch = text.match(/in\s+([A-Za-z0-9\s&.'-]+?)(?:fund|has been|\.|$)/i);
  const description = fundMatch ? `${fundMatch[1].trim()} (Zerodha)` : "Zerodha Investment";

  return {
    date,
    description,
    amount,
    type: "debit", // Investments are treated as a debit (money moving out of cash flow)
    category: "Investment",
    account: "Zerodha",
    card_last4: null,
    confidence: amount ? "medium" : "low",
  };
}

// ============================================================
// Groww — similar pattern to Zerodha
// ============================================================
function parseGroww(subject: string, body: string, receivedDate: string): ParsedTransaction {
  const text = `${subject} ${body}`;
  const amount = extractAmount(text);
  const date = extractDate(text, receivedDate);

  const fundMatch = text.match(/in\s+([A-Za-z0-9\s&.'-]+?)(?:fund|has been|\.|$)/i);
  const description = fundMatch ? `${fundMatch[1].trim()} (Groww)` : "Groww Investment";

  return {
    date,
    description,
    amount,
    type: "debit",
    category: "Investment",
    account: "Groww",
    card_last4: null,
    confidence: amount ? "medium" : "low",
  };
}

// ============================================================
// 5paisa — similar pattern
// ============================================================
function parse5paisa(subject: string, body: string, receivedDate: string): ParsedTransaction {
  const text = `${subject} ${body}`;
  const amount = extractAmount(text);
  const date = extractDate(text, receivedDate);

  return {
    date,
    description: "5paisa Investment",
    amount,
    type: "debit",
    category: "Investment",
    account: "5paisa",
    card_last4: null,
    confidence: amount ? "medium" : "low",
  };
}

// ============================================================
// Main dispatch — picks the right parser based on sender email
// ============================================================
export function parseEmail(
  sender: string,
  subject: string,
  body: string,
  receivedDate: string
): ParsedTransaction {
  const s = sender.toLowerCase();

  if (s.includes("icicibank.com"))  return parseICICI(subject, body, receivedDate);
  if (s.includes("sbicard.com"))    return parseSBICard(subject, body, receivedDate);
  if (s.includes("axisbank.com"))   return parseAxis(subject, body, receivedDate);
  if (s.includes("zerodha.com"))    return parseZerodha(subject, body, receivedDate);
  if (s.includes("groww.in"))       return parseGroww(subject, body, receivedDate);
  if (s.includes("5paisa.com"))     return parse5paisa(subject, body, receivedDate);

  // Unknown sender — return a low-confidence empty shell so the
  // user can still see the email and fill in details manually
  return {
    date: receivedDate,
    description: null,
    amount: extractAmount(`${subject} ${body}`),
    type: null,
    category: "Other",
    account: null,
    card_last4: null,
    confidence: "low",
  };
}
