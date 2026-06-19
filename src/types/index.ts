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
export type LoanType = "home" | "car" | "personal" | "education" | "other";

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
