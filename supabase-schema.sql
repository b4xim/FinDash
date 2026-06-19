-- ============================================================
-- FinDash — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Transactions table ──────────────────────────────────────
-- Stores every spending/income entry, whether manual or from Gmail
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  description   TEXT NOT NULL,
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type          TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  category      TEXT NOT NULL DEFAULT 'Other',
  account       TEXT,               -- e.g. "ICICI Credit Card"
  card_last4    TEXT,               -- Last 4 digits, only for card transactions — powers the Credit Cards view
  notes         TEXT,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'gmail')),
  gmail_msg_id  TEXT,               -- Gmail message ID if source='gmail'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on date for fast monthly queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

-- ── Holdings table ───────────────────────────────────────────
-- Investment holdings — updated manually or via sync
CREATE TABLE IF NOT EXISTS holdings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  ticker        TEXT,
  asset_type    TEXT NOT NULL DEFAULT 'other'
                  CHECK (asset_type IN ('mutual_fund', 'stock', 'etf', 'fd', 'ppf', 'other')),
  units         NUMERIC(16, 4) NOT NULL DEFAULT 0,
  buy_price     NUMERIC(12, 4) NOT NULL DEFAULT 0,  -- Average cost per unit
  current_price NUMERIC(12, 4) NOT NULL DEFAULT 0,  -- Latest known price
  account       TEXT,               -- e.g. "Zerodha", "Groww"
  notes         TEXT,
  mfapi_code    TEXT,               -- AMFI scheme code, only for mutual_fund type — enables auto NAV fetch
  price_updated_at TIMESTAMPTZ,     -- When current_price was last refreshed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pending emails (Gmail sync review queue) ──────────────────
CREATE TABLE IF NOT EXISTS pending_emails (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_msg_id   TEXT NOT NULL UNIQUE,
  sender         TEXT NOT NULL,
  subject        TEXT NOT NULL,
  received_at    TIMESTAMPTZ NOT NULL,
  raw_snippet    TEXT,              -- First ~500 chars of body
  parsed_json    JSONB,             -- Our best-guess parsed transaction
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── App settings (key-value store) ───────────────────────────
-- Used for: last_gmail_sync, gmail_access_token, etc.
CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auto-update updated_at trigger ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Sample data (optional — delete before production) ────────
-- Uncomment to seed some test transactions
/*
INSERT INTO transactions (date, description, amount, type, category, account, source) VALUES
  ('2024-06-01', 'Swiggy', 450, 'debit', 'Food & Dining', 'ICICI Credit Card', 'manual'),
  ('2024-06-03', 'Amazon', 2299, 'debit', 'Shopping', 'ICICI Credit Card', 'manual'),
  ('2024-06-05', 'Salary Credit', 85000, 'credit', 'Income', 'SBI Savings', 'manual'),
  ('2024-06-07', 'Zerodha MF SIP', 5000, 'debit', 'Investment', 'Zerodha', 'manual');
*/

-- ============================================================
-- MIGRATION — run this ONLY if you already created tables
-- before Chunk 4 (i.e. you ran this schema file previously).
-- If running this schema file for the very first time, skip —
-- the CREATE TABLE statements above already include everything.
-- ============================================================
-- ALTER TABLE holdings ADD COLUMN IF NOT EXISTS mfapi_code TEXT;
-- ALTER TABLE holdings ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ;
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS card_last4 TEXT;
