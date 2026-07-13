-- ============================================================
-- FinDash — SIP (Systematic Investment Plan) Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── SIPs table ───────────────────────────────────────────────
-- Tracks recurring investment instructions (SIP mandates).
-- A SIP is the *instruction* ("₹5,000/month into Nifty 50"),
-- while a Holding is the *accumulated result* ("47.23 units owned").
-- They can optionally link via holding_id.
CREATE TABLE IF NOT EXISTS sips (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,              -- e.g. "Nifty 50 Index Fund SIP"
  asset_type               TEXT NOT NULL DEFAULT 'mutual_fund'
                             CHECK (asset_type IN ('mutual_fund', 'etf', 'stock')),
  sip_amount               NUMERIC(12, 2) NOT NULL CHECK (sip_amount > 0),
  frequency                TEXT NOT NULL DEFAULT 'monthly'
                             CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
  sip_date                 INT NOT NULL DEFAULT 1
                             CHECK (sip_date BETWEEN 1 AND 31),  -- Day of month/week
  start_date               DATE NOT NULL,              -- When the SIP mandate started
  end_date                 DATE,                       -- Optional: when SIP will end
  total_installments_done  INT NOT NULL DEFAULT 0,    -- Count of completed installments
  total_invested           NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- Running ₹ total invested
  holding_id               UUID REFERENCES holdings(id) ON DELETE SET NULL,
  account                  TEXT,                       -- Broker, e.g. "Zerodha", "Groww"
  mfapi_code               TEXT,                       -- AMFI code for MF SIPs
  ticker                   TEXT,                       -- Symbol for stock/ETF SIPs
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  step_up_pct              NUMERIC(5, 2) DEFAULT 0,   -- Annual step-up % (future use)
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast active SIP lookups
CREATE INDEX IF NOT EXISTS idx_sips_is_active ON sips(is_active);

-- Index on holding_id for join lookups
CREATE INDEX IF NOT EXISTS idx_sips_holding_id ON sips(holding_id);

-- ── Auto-update updated_at trigger ───────────────────────────
CREATE TRIGGER trg_sips_updated_at
  BEFORE UPDATE ON sips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- NOTE: The update_updated_at() function already exists from
-- supabase-schema.sql. If running this in isolation, run that
-- schema first, or create the function manually.
