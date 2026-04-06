
-- Add LINE friends count and product interest fields to accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS line_friends INTEGER,
  ADD COLUMN IF NOT EXISTS interest_pr TEXT NOT NULL DEFAULT '未評估',
  ADD COLUMN IF NOT EXISTS notes_pr TEXT,
  ADD COLUMN IF NOT EXISTS interest_csbot TEXT NOT NULL DEFAULT '未評估',
  ADD COLUMN IF NOT EXISTS notes_csbot TEXT;
