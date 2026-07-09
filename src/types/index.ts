// ============================================================
// Central type definitions — add new types here as the app grows
// ============================================================

export type TransactionType = "debit" | "credit";

export type Category =
  | "Food & Dining"
  | "Shopping"
  | "Transport"
  | "Utilities"
  | "Entertainment"
  | "Healthcare"
  | "Investment"
  | "Income"
  | "Transfer"
  | "Other";

// A single financial transaction (spending or income)
export interface Transaction {
  id: string;
  date: string;           // ISO date string: "2024-01-15"
  description: string;    // Merchant name or description
  amount: number;         // Always positive; direction = type field
  type: TransactionType;
  category: Category;
  account?: string;       // e.g. "ICICI Credit Card"
  card_last4?: string;    // Last 4 digits, only for card transactions
  notes?: string;
  necessary?: "Necessary" | "Unnecessary"; // From Sheets or manually set
  source: "manual" | "gmail" | "sheets";   // How it was added
  gmail_msg_id?: string;
  created_at: string;
}


// A single investment holding
export interface Holding {
  id: string;
  name: string;           // e.g. "Nifty 50 Index Fund"
  ticker?: string;        // e.g. "NIFTYBEES"
  asset_type: "mutual_fund" | "stock" | "etf" | "fd" | "ppf" | "other";
  units: number;
  buy_price: number;      // Average buy price per unit
  current_price: number;  // Latest known price
  account?: string;       // e.g. "Zerodha", "Groww"
  notes?: string;
  mfapi_code?: string;        // AMFI scheme code — enables auto NAV fetch for mutual funds
  price_updated_at?: string;  // When current_price was last refreshed
  updated_at: string;
}

// A mutual fund scheme returned by the MFapi.in search
export interface MFScheme {
  schemeCode: number;
  schemeName: string;
}

// Our best-guess parse of an email — matches lib/emailParser.ts output
export interface ParsedTransactionGuess {
  date: string | null;
  description: string | null;
  amount: number | null;
  type: TransactionType | null;
  category: Category;
  account: string | null;
  card_last4: string | null;
  confidence: "high" | "medium" | "low";
}

// Email from Gmail waiting to be parsed and approved
export interface PendingEmail {
  id: string;
  gmail_msg_id: string;
  sender: string;
  subject: string;
  received_at: string;
  raw_snippet: string;
  parsed_json: ParsedTransactionGuess | null; // Our best guess at parsing
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

// Session data stored in the signed cookie
export interface SessionData {
  isLoggedIn: boolean;
  // Gmail OAuth tokens stored separately in DB
}

// Loan type for EMI tracker
export type LoanType =
  | "phone"
  | "laptop"
  | "appliance"
  | "gadget"
  | "credit_card"
  | "bike"
  | "car"
  | "furniture"
  | "other";

// A single EMI loan entry
export interface EmiLoan {
  id: string;
  name: string;             // e.g. "iPhone 15 Pro - Bajaj Finance"
  lender?: string;          // e.g. "Bajaj Finance", "Amazon Pay Later"
  loan_type: LoanType;
  principal: number;        // Original loan amount / product price
  interest_rate: number;    // Annual rate — set to 0 for No-Cost EMI
  tenure_months: number;    // Total number of EMIs
  start_date: string;       // ISO date string: "2024-01-01"
  emi_amount: number;       // Monthly EMI
  account?: string;         // Card / account used
  notes?: string;
  is_active: boolean;
  is_no_cost_emi?: boolean; // True = 0% interest / no-cost EMI
  created_at: string;
  updated_at: string;
}

// Monthly budget cap for a spending category
export interface BudgetLimit {
  id: string;
  category: Category;
  monthly_limit: number;    // Monthly spending cap in ₹
  alert_at_pct: number;     // Alert when spending reaches this % of limit (1–100)
  created_at: string;
  updated_at: string;
}

// A financial savings goal
export interface FinancialGoal {
  id: string;
  name: string;             // e.g. "Vacation Fund"
  target_amount: number;    // e.g. 100000
  saved_amount: number;     // Current amount saved toward this goal
  deadline?: string;        // ISO date string, e.g. "2026-12-31"
  color: string;            // Hex color for the progress ring
  icon: string;             // Lucide icon name, e.g. "plane", "home", "car"
  notes?: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}


// A single EMI loan entry
export interface EmiLoan {
  id: string;
  name: string;             // e.g. "Home Loan - SBI"
  lender?: string;          // e.g. "SBI", "HDFC"
  loan_type: LoanType;
  principal: number;        // Original loan amount
  interest_rate: number;    // Annual rate, e.g. 8.5 for 8.5%
  tenure_months: number;    // Total number of EMIs
  start_date: string;       // ISO date string: "2024-01-01"
  emi_amount: number;       // Monthly EMI
  account?: string;         // Bank account debited
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Smart Picks (AI buy recommendations) ──

export type PickSignal = "Strong Buy" | "Buy" | "Watch";
export type RiskLevel = "Low" | "Medium" | "High";
export type StockCategory = "nifty50" | "midcap" | "smallcap" | "etf";

export interface SmartPick {
  name: string;             // e.g. "HDFC Bank"
  ticker: string;           // e.g. "HDFCBANK.NS" or MF scheme code
  assetType: "stock" | "mutual_fund";
  stockCategory?: StockCategory; // Only set for stocks
  currentPrice: number;
  returnPct: number;        // 1Y return %
  signal: PickSignal;
  riskLevel: RiskLevel;
  rationale: string;        // AI-generated buy rationale (1-2 sentences)
  metrics: {
    pe?: number;            // P/E ratio (stocks)
    high52w?: number;       // 52-week high
    low52w?: number;        // 52-week low
    cagr3y?: number;        // 3Y CAGR (mutual funds)
    volatility?: number;    // Approximate volatility score (distance from 52w high %)
  };
}

// ── Lending Tracker (money lent to / borrowed from people) ──

export type LendingDirection = "lent" | "borrowed";
export type LendingStatus = "pending" | "partially_settled" | "settled";

export interface LendingEntry {
  id: string;
  person: string;            // Name of the person
  direction: LendingDirection; // "lent" = you gave money, "borrowed" = you received money
  amount: number;            // Original amount
  settled_amount: number;    // How much has been settled so far
  date: string;              // ISO date string when the lending happened
  due_date?: string;         // Optional expected return date
  status: LendingStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Credit Cards ──────────────────────────────────────────────

export type CreditCardStatus = "Unpaid" | "Paid" | "Overdue";

// One row per card per statement month in the credit_card_bills table
export interface CreditCardBill {
  id: string;
  card_name: string;
  sender_email: string | null;
  total_amount_due: number;
  minimum_due: number;
  due_date: string | null;        // ISO date string e.g. "2026-07-15"
  statement_month: string;        // e.g. "Jul 2026"
  status: CreditCardStatus;
  last_fetched_at: string;        // ISO timestamp
  created_at: string;
}

// Static per-card config read from credit_card_config Supabase table
export interface CreditCardConfig {
  card_name: string;
  pdf_password: string | null;    // Only set for PDF-based cards
  sender_email: string;
  created_at: string;
}

// UI-layer config (lives in /lib/creditCardConfig.ts as a static object)
// Merged with CreditCardBill at render time
export interface CreditCardUIConfig {
  cardName: string;
  shortName: string;              // Short display name e.g. "Amazon Pay"
  bankName: string;               // Bank name e.g. "ICICI", "Axis"
  bankColor: string;              // Hex color for bank branding
  imagePath: string;              // Path in /public/card-images/
  subjectKeyword: string;         // Gmail subject filter
  cardLast4?: string;             // For disambiguation (ICICI Coral = "7009")
  amountSource: "email" | "pdf";
  totalRegex: RegExp;
  dueDateRegex: RegExp;
  minDueRegex: RegExp;
  pdfFilenamePattern?: RegExp;    // For HDFC filename matching
}
