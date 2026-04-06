CREATE TABLE public.scraper_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  query_industry text,
  query_region text,
  company_name text NOT NULL,
  website text,
  industry text,
  description text,
  extra_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  imported_account_id uuid REFERENCES public.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scraper_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scraper results"
  ON public.scraper_results FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert scraper results"
  ON public.scraper_results FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update scraper results"
  ON public.scraper_results FOR UPDATE
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can delete scraper results"
  ON public.scraper_results FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

CREATE TRIGGER set_scraper_results_updated_at
  BEFORE UPDATE ON public.scraper_results
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();