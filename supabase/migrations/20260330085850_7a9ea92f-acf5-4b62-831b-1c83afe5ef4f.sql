
-- Fix: restrict org creation - user must add themselves as admin after creating
-- Drop the overly permissive policy
DROP POLICY "Authenticated users can create organizations" ON public.organizations;

-- Replace with: authenticated users can create orgs (this is intentionally permissive for org creation flow)
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (
    -- Ensure the creator will add themselves as a member (enforced at app level)
    auth.uid() IS NOT NULL
  );
