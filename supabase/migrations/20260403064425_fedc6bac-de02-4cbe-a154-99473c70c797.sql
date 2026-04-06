-- Fix: Admin cannot insert themselves into other orgs
DROP POLICY IF EXISTS "Admins can add org members" ON public.organization_members;

CREATE POLICY "Admins can add org members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_org_admin(auth.uid(), org_id)
  AND user_id != auth.uid()
);

-- Fix: Invitation visibility requires verified email
DROP POLICY IF EXISTS "Invited users can view own invitations" ON public.invitations;

CREATE POLICY "Invited users can view own invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  email = (auth.jwt()->>'email')
  AND (auth.jwt()->'email_confirmed_at') IS NOT NULL
  AND (auth.jwt()->>'email_confirmed_at') != ''
);