// ============================================================
// Credit Card Static UI Config
// Maps card_name → UI config (colors, images, regex patterns).
// Sensitive data (pdf_password, sender_email) lives in Supabase
// credit_card_config table — NOT here.
// ============================================================

import { CreditCardUIConfig } from "@/types";

// Bank brand colors — used for card bottom borders and fallback icon bg
export const BANK_COLORS: Record<string, string> = {
  ICICI:   "#F47920",
  Axis:    "#7B2D8E",
  SBI:     "#1A75BB",
  Federal: "#C5A556",
  HDFC:    "#ED1C24",
};

// ── All 7 card configs ────────────────────────────────────────
export const CREDIT_CARD_CONFIGS: CreditCardUIConfig[] = [
  // ── 1. ICICI Amazon Pay ──────────────────────────────────
  {
    cardName:       "ICICI Amazon Pay",
    shortName:      "Amazon Pay",
    bankName:       "ICICI",
    bankColor:      BANK_COLORS.ICICI,
    imagePath:      "/card-images/icici-amazon-pay.png",
    subjectKeyword: "Amazon Pay ICICI",
    amountSource:   "email",
    // Matches: ₹12,345 due on 15 Jul
    totalRegex:     /₹([\d,]+\.?\d*)\s*\ndue on\s*(\d+\s+\w+)/,
    dueDateRegex:   /due on\s*(\d+\s+\w+\s+\d{4})/i,
    minDueRegex:    /Minimum due\s*₹([\d,]+\.?\d*)/i,
  },

  // ── 2. ICICI Coral Rupay ─────────────────────────────────
  {
    cardName:       "ICICI Coral Rupay",
    shortName:      "Coral Rupay",
    bankName:       "ICICI",
    bankColor:      BANK_COLORS.ICICI,
    imagePath:      "/card-images/icici-coral-rupay.png",
    subjectKeyword: "ICICI Bank Credit Card Statement",
    cardLast4:      "7009",  // Disambiguates from Amazon Pay (same sender)
    amountSource:   "email",
    totalRegex:     /₹([\d,]+\.?\d*)\s*\ndue on\s*(\d+\s+\w+)/,
    dueDateRegex:   /due on\s*(\d+\s+\w+\s+\d{4})/i,
    minDueRegex:    /Minimum due\s*₹([\d,]+\.?\d*)/i,
  },

  // ── 3. Axis Privilege ────────────────────────────────────
  {
    cardName:       "Axis Privilege",
    shortName:      "Privilege",
    bankName:       "Axis",
    bankColor:      BANK_COLORS.Axis,
    imagePath:      "/card-images/axis-privilege.png",
    subjectKeyword: "Privilege",
    amountSource:   "email",
    // Matches the pink HTML table format
    totalRegex:     /Total\s*Amount\s*Due\s*INR[\s\S]*?([\d,]+\.?\d*)\s*Dr/i,
    dueDateRegex:   /Payment\s*Due\s*Date[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i,
    minDueRegex:    /Minimum\s*Amount\s*Due[\s\S]*?([\d,]+\.?\d*)\s*Dr/i,
  },

  // ── 4. Axis IndianOil Rupay ──────────────────────────────
  {
    cardName:       "Axis IndianOil Rupay",
    shortName:      "IndianOil",
    bankName:       "Axis",
    bankColor:      BANK_COLORS.Axis,
    imagePath:      "/card-images/axis-indianoil-rupay.png",
    subjectKeyword: "Indianoil",
    amountSource:   "email",
    totalRegex:     /Total\s*Amount\s*Due\s*INR[\s\S]*?([\d,]+\.?\d*)\s*Dr/i,
    dueDateRegex:   /Payment\s*Due\s*Date[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i,
    minDueRegex:    /Minimum\s*Amount\s*Due[\s\S]*?([\d,]+\.?\d*)\s*Dr/i,
  },

  // ── 5. SBI Cashback ──────────────────────────────────────
  {
    cardName:       "SBI Cashback",
    shortName:      "Cashback",
    bankName:       "SBI",
    bankColor:      BANK_COLORS.SBI,
    imagePath:      "/card-images/sbi-cashback.png",
    subjectKeyword: "CASHBACK SBI",
    amountSource:   "email",
    totalRegex:     /Total amount due\s*\(\s*\)\s*([\d,]+\.?\d*)/i,
    dueDateRegex:   /Payment due date\s*([\d]+-\w+-\d{4})/i,
    minDueRegex:    /Minimum amount due\s*\(\s*\)\s*([\d,]+\.?\d*)/i,
  },

  // ── 6. Federal Bank Signet ───────────────────────────────
  {
    cardName:       "Federal Bank Signet",
    shortName:      "Signet",
    bankName:       "Federal",
    bankColor:      BANK_COLORS.Federal,
    imagePath:      "/card-images/federal-bank-signet.png",
    subjectKeyword: "Credit Card Statement",
    amountSource:   "pdf",
    // PDF generic patterns — Federal Bank statement PDFs vary; these cover common layouts
    totalRegex:     /Total\s*Amount\s*Due\s*[:\s]*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i,
    dueDateRegex:   /(?:Payment\s*Due\s*Date|Due\s*Date)\s*[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})/i,
    minDueRegex:    /Minimum\s*(?:Amount\s*)?Due\s*[:\s]*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i,
  },

  // ── 7. TATA NEU HDFC Plus Rupay ─────────────────────────
  {
    cardName:           "TATA NEU HDFC Plus Rupay",
    shortName:          "TATA NEU Plus",
    bankName:           "HDFC",
    bankColor:          BANK_COLORS.HDFC,
    imagePath:          "/card-images/tata-neu-hdfc-plus.png",
    subjectKeyword:     "Tata Neu Plus",
    amountSource:       "pdf",
    pdfFilenamePattern: /^6529/,          // HDFC filenames start with 6529
    totalRegex:         /Total\s*Amount\s*Due\s*[:\s]*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i,
    dueDateRegex:       /(?:Payment\s*Due\s*Date|Due\s*Date)\s*[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})/i,
    minDueRegex:        /Minimum\s*(?:Amount\s*)?Due\s*[:\s]*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i,
  },
];

// ── Lookup helpers ────────────────────────────────────────────

/** Look up static UI config by exact card_name */
export function getCardConfig(cardName: string): CreditCardUIConfig | undefined {
  return CREDIT_CARD_CONFIGS.find(c => c.cardName === cardName);
}

/** Calculate urgency level for a due date */
export function getDueUrgency(dueDateStr: string | null): "overdue" | "urgent" | "warning" | "ok" {
  if (!dueDateStr) return "ok";
  const due = new Date(dueDateStr);
  const now = new Date();
  // Zero out time for pure day comparison
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)  return "overdue";
  if (daysLeft <= 3) return "urgent";
  if (daysLeft <= 7) return "warning";
  return "ok";
}

/** Get Tailwind color classes for a given urgency level */
export function getUrgencyClasses(urgency: ReturnType<typeof getDueUrgency>): {
  text: string;
  bg: string;
  border: string;
} {
  switch (urgency) {
    case "overdue": return { text: "text-rose-400",  bg: "bg-rose-400/10",  border: "border-rose-400/30" };
    case "urgent":  return { text: "text-rose-400",  bg: "bg-rose-400/10",  border: "border-rose-400/30" };
    case "warning": return { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" };
    case "ok":      return { text: "text-emerald-fin", bg: "bg-emerald-fin-dim", border: "border-emerald-fin/30" };
  }
}

/** Format days left as a human-readable string */
export function formatDaysLeft(dueDateStr: string | null): string {
  if (!dueDateStr) return "—";
  const due = new Date(dueDateStr);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)  return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft}d left`;
}

/** Derive current statement month string e.g. "Jul 2026" */
export function getCurrentStatementMonth(): string {
  return new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
