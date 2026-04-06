-- Fix critical: restrict "Creator can add self as first member"
DROP POLICY IF EXISTS "Creator can add self as first member" ON public.organization_members;

CREATE POLICY "Creator can add self as first member"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om WHERE om.org_id = organization_members.org_id
  )
);

-- Fix: restrict organization visibility to members only
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;

CREATE POLICY "Members can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.org_id = organizations.id
    AND organization_members.user_id = auth.uid()
  )
);

-- Also allow viewing org if user just created it (for the create flow)
CREATE POLICY "Creator can view org during setup"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE organization_members.org_id = organizations.id
  )
);

-- Fix: invited users can view their own invitations
CREATE POLICY "Invited users can view own invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (email = (auth.jwt()->>'email'));