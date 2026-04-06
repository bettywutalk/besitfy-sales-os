-- Commission products (product settings per org)
CREATE TABLE IF NOT EXISTS public.commission_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  commission_rate NUMERIC(6,4),       -- e.g. 0.13 for 13%
  base_bonus NUMERIC(12,2),           -- fixed bonus per deal
  is_variable BOOLEAN DEFAULT false,  -- if true, calculate from contract amount
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commission_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read commission_products"
  ON public.commission_products FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "admin can manage commission_products"
  ON public.commission_products FOR ALL
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sales_manager')));

-- Deals (closed deals with bonus)
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.commission_products(id) ON DELETE SET NULL,
  sales_rep_id UUID NOT NULL,
  contract_amount_tax NUMERIC(12,2),  -- 含稅
  contract_amount NUMERIC(12,2),      -- 扣除稅
  bonus_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  signed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read deals"
  ON public.deals FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "sales rep can insert own deals"
  ON public.deals FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()) AND sales_rep_id = auth.uid());
CREATE POLICY "admin can update deals"
  ON public.deals FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sales_manager')));
CREATE POLICY "sales rep can update own deals"
  ON public.deals FOR UPDATE
  USING (sales_rep_id = auth.uid() AND status = 'unpaid');

-- Bonus targets (per user per year)
CREATE TABLE IF NOT EXISTS public.bonus_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id, year)
);

ALTER TABLE public.bonus_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can manage own targets"
  ON public.bonus_targets FOR ALL
  USING (user_id = auth.uid());
CREATE POLICY "admin can read all targets"
  ON public.bonus_targets FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'sales_manager')));
