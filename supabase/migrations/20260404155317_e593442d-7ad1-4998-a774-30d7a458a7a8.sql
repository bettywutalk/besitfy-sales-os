
-- Fix invitation email check: use auth.users instead of JWT claim
DROP POLICY IF EXISTS "Invited users can view own invitations" ON public.invitations;
CREATE POLICY "Invited users can view own invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL));

-- Fix org members INSERT: only admins can add members
DROP POLICY IF EXISTS "Admins can add org members" ON public.organization_members;
CREATE POLICY "Admins can add org members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (is_org_admin(auth.uid(), org_id));
