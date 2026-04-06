
-- Fix scraper_results policies: change from public to authenticated
DROP POLICY IF EXISTS "Org members can view scraper results" ON public.scraper_results;
DROP POLICY IF EXISTS "Org members can insert scraper results" ON public.scraper_results;
DROP POLICY IF EXISTS "Org members can update scraper results" ON public.scraper_results;
DROP POLICY IF EXISTS "Admins can delete scraper results" ON public.scraper_results;

CREATE POLICY "Org members can view scraper results" ON public.scraper_results
  FOR SELECT TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert scraper results" ON public.scraper_results
  FOR INSERT TO authenticated WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update scraper results" ON public.scraper_results
  FOR UPDATE TO authenticated USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can delete scraper results" ON public.scraper_results
  FOR DELETE TO authenticated USING (is_org_admin(auth.uid(), org_id));
