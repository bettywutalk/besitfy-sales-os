ALTER TABLE public.accounts ADD COLUMN domain_key text;

-- Generate domain_key = lower(domain_key_input) + ' ' + country for display
-- This is a manual field, so no auto-generation needed at DB level

CREATE UNIQUE INDEX IF NOT EXISTS accounts_org_domain_key_idx ON public.accounts (org_id, domain_key) WHERE domain_key IS NOT NULL;