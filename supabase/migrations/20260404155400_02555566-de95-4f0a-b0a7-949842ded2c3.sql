
-- Strengthen org_members INSERT: admin only, prevent inserting admin role
DROP POLICY IF EXISTS "Admins can add org members" ON public.organization_members;
CREATE POLICY "Admins can add org members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_admin(auth.uid(), org_id)
    AND role <> 'admin'
    AND user_id <> auth.uid()
  );

-- Add UPDATE/DELETE policies for organizations (admin only)
CREATE POLICY "Admins can update their organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (is_org_admin(auth.uid(), id));

CREATE POLICY "Admins can delete their organization" ON public.organizations
  FOR DELETE TO authenticated
  USING (is_org_admin(auth.uid(), id));
