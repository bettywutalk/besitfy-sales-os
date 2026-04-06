-- Add metadata JSONB to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add partner fields to organization_members
ALTER TABLE public.organization_members 
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS industry_focus text,
  ADD COLUMN IF NOT EXISTS supervisor_id uuid;

-- Create homepage_sections table for CMS
CREATE TABLE public.homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  section_type text NOT NULL DEFAULT 'resource',
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view homepage sections"
ON public.homepage_sections FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can insert homepage sections"
ON public.homepage_sections FOR INSERT TO authenticated
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update homepage sections"
ON public.homepage_sections FOR UPDATE TO authenticated
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete homepage sections"
ON public.homepage_sections FOR DELETE TO authenticated
USING (is_org_admin(auth.uid(), org_id));

CREATE TRIGGER update_homepage_sections_updated_at
BEFORE UPDATE ON public.homepage_sections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();