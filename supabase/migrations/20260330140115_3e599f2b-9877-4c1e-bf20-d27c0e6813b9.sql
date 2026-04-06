DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "Authenticated users can view organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (true);