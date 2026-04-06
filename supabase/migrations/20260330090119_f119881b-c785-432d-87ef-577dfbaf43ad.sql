
-- Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_name_sf TEXT,
  country TEXT NOT NULL DEFAULT 'TW',
  industry TEXT NOT NULL DEFAULT 'Other',
  brand TEXT,
  pv_k INTEGER,
  platform TEXT,
  martech_stack TEXT[] DEFAULT '{}',
  competitor TEXT[] DEFAULT '{}',
  mtu INTEGER,
  ec_link TEXT,
  meeting_status TEXT NOT NULL DEFAULT '尚未開發',
  customer_status TEXT NOT NULL DEFAULT 'New',
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  is_manager BOOLEAN NOT NULL DEFAULT false,
  is_foreigner BOOLEAN NOT NULL DEFAULT false,
  email TEXT,
  email_status TEXT,
  phone TEXT,
  linkedin_url TEXT,
  pic TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium',
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  lead_source_status TEXT,
  linkedin_engaged BOOLEAN NOT NULL DEFAULT false,
  linkedin_messaged_at TIMESTAMPTZ,
  yamm_status TEXT NOT NULL DEFAULT '未發',
  yamm_last_sent TIMESTAMPTZ,
  bounce_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS for accounts: org members can view
CREATE POLICY "Org members can view accounts"
  ON public.accounts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update accounts"
  ON public.accounts FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can delete accounts"
  ON public.accounts FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

-- RLS for leads: org members can view
CREATE POLICY "Org members can view leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
