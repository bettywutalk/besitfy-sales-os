
DROP POLICY IF EXISTS "Admins can update org members" ON public.organization_members;
CREATE POLICY "Admins can update org members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (is_org_admin(auth.uid(), org_id))
  WITH CHECK (is_org_admin(auth.uid(), org_id) AND role <> 'admin');
