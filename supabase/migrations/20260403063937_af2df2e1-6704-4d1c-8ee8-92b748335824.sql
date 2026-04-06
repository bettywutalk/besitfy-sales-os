-- Create atomic function for org creation
CREATE OR REPLACE FUNCTION public.create_organization_with_member(
  _name text,
  _logo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, logo_url)
  VALUES (_name, _logo_url)
  RETURNING id INTO _org_id;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (_org_id, auth.uid(), 'admin');

  -- Set as current org
  UPDATE public.profiles SET current_org_id = _org_id WHERE id = auth.uid();

  RETURN _org_id;
END;
$$;

-- Remove unsafe policies
DROP POLICY IF EXISTS "Creator can view org during setup" ON public.organizations;
DROP POLICY IF EXISTS "Creator can add self as first member" ON public.organization_members;