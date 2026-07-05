-- ============================================================
-- Lending Tracker — Supabase table
-- Run this in your Supabase SQL editor to create the table
-- ============================================================

CREATE TABLE IF NOT EXISTS lendings (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person       TEXT NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
  amount       NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  settled_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (settled_amount >= 0),
  date         DATE NOT NULL,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_settled', 'settled')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_lendings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lendings_updated_at
  BEFORE UPDATE ON lendings
  FOR EACH ROW
  EXECUTE FUNCTION update_lendings_updated_at();

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_lendings_status ON lendings (status);
CREATE INDEX IF NOT EXISTS idx_lendings_direction ON lendings (direction);
CREATE INDEX IF NOT EXISTS idx_lendings_person ON lendings (person);
