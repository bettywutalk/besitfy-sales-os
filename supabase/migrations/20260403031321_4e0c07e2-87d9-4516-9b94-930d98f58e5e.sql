-- Create call_result type
CREATE TYPE public.call_result AS ENUM ('未接', '已接', '有效通話');

-- Create call_logs table
CREATE TABLE public.call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  called_by uuid NOT NULL,
  call_result public.call_result NOT NULL DEFAULT '未接',
  note text,
  called_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_call_logs_org_id ON public.call_logs(org_id);
CREATE INDEX idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_account_id ON public.call_logs(account_id);
CREATE INDEX idx_call_logs_called_by ON public.call_logs(called_by);
CREATE INDEX idx_call_logs_called_at ON public.call_logs(called_at);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Org members can view call logs
CREATE POLICY "Org members can view call logs"
ON public.call_logs FOR SELECT
TO authenticated
USING (is_org_member(auth.uid(), org_id));

-- Org members can insert call logs
CREATE POLICY "Org members can insert call logs"
ON public.call_logs FOR INSERT
TO authenticated
WITH CHECK (is_org_member(auth.uid(), org_id) AND called_by = auth.uid());

-- Org members can update own call logs
CREATE POLICY "Org members can update own call logs"
ON public.call_logs FOR UPDATE
TO authenticated
USING (is_org_member(auth.uid(), org_id) AND called_by = auth.uid());

-- Admins can delete call logs
CREATE POLICY "Admins can delete call logs"
ON public.call_logs FOR DELETE
TO authenticated
USING (is_org_admin(auth.uid(), org_id));