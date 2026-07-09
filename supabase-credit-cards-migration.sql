-- ============================================================
-- FinDash — Credit Cards Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Credit Card Config (static per-card, seeded once) ────────
-- Stores PDF passwords and sender emails — sensitive data that
-- shouldn't live in source control.
-- NOTE: pdf_password is stored plaintext. This is a single-user
-- personal dashboard using the service role key server-side only.
-- The RLS policy below blocks anon/public reads of this table.
CREATE TABLE IF NOT EXISTS credit_card_config (
  card_name      TEXT PRIMARY KEY,
  pdf_password   TEXT,                -- Only set for PDF-based cards
  sender_email   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on credit_card_config so the anon key cannot read it
ALTER TABLE credit_card_config ENABLE ROW LEVEL SECURITY;

-- Allow ONLY the service role (used server-side) to read/write.
-- The anon/public key used in client components cannot access this table.
CREATE POLICY "service_role_only" ON credit_card_config
  USING (auth.role() = 'service_role');

-- ── Seed all 7 cards ─────────────────────────────────────────
INSERT INTO credit_card_config (card_name, sender_email, pdf_password) VALUES
  ('ICICI Amazon Pay',            'credit_cards@icici.bank.in',             NULL),
  ('ICICI Coral Rupay',           'credit_cards@icici.bank.in',             NULL),
  ('Axis Privilege',              'cc.statements@axis.bank.in',             NULL),
  ('Axis IndianOil Rupay',        'cc.statements@axis.bank.in',             NULL),
  ('SBI Cashback',                'Statements@sbicard.com',                 NULL),
  ('Federal Bank Signet',         'fedmail@federal.bank.in',                'BASI1303'),
  ('TATA NEU HDFC Plus Rupay',    'Emailstatements.cards@hdfcbank.bank.in', 'BASI1303')
ON CONFLICT (card_name) DO NOTHING;

-- ── Credit Card Bills (per-statement, one row per card per month) ──
-- Stores statement data fetched from Gmail each billing cycle.
CREATE TABLE IF NOT EXISTS credit_card_bills (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_name        TEXT NOT NULL,
  sender_email     TEXT,
  total_amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  minimum_due      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_date         DATE,
  statement_month  TEXT NOT NULL,       -- e.g. "Jul 2026"
  status           TEXT NOT NULL DEFAULT 'Unpaid'
                     CHECK (status IN ('Unpaid', 'Paid', 'Overdue')),
  last_fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index enables upsert on (card_name, statement_month)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_bills_card_month
  ON credit_card_bills (card_name, statement_month);

-- Index for fast lookups by month (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_cc_bills_month
  ON credit_card_bills (statement_month DESC);

-- Index for fast lookups by card_name
CREATE INDEX IF NOT EXISTS idx_cc_bills_card_name
  ON credit_card_bills (card_name);

-- ── Auto-update trigger for status changes ────────────────────
-- (No updated_at column on credit_card_bills by design — last_fetched_at
--  serves that purpose for fetch events; status changes are lightweight)
