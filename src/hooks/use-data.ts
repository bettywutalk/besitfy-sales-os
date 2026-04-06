import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Account, Lead, CallLog } from '@/types';

// Get current org_id from profile (or fallback)
async function getCurrentOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_org_id')
    .eq('id', user.id)
    .single();
  
  return profile?.current_org_id ?? null;
}

// ─── Current User Role ───

export function useCurrentUserRole() {
  return useQuery({
    queryKey: ['current-user-role'],
    queryFn: async () => {
      const orgId = await getCurrentOrgId();
      if (!orgId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('organization_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .single();
      return data?.role ?? null;
    },
  });
}

// ─── Org Members (with email + joined_at) ───

export function useOrgMembers() {
  return useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const orgId = await getCurrentOrgId();
      if (!orgId) return [];

      const { data: members, error } = await supabase
        .from('organization_members')
        .select('user_id, role, joined_at')
        .eq('org_id', orgId);

      if (error) throw error;

      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (pErr) throw pErr;

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]));

      return members.map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        full_name: profileMap[m.user_id] || '未知',
      }));
    },
  });
}

// ─── Invitations ───

export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const orgId = await getCurrentOrgId();
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const orgId = await getCurrentOrgId();
      if (!orgId) throw new Error('No org');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('invitations')
        .insert({ email, role: role as any, org_id: orgId, invited_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}

export function useDeleteInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const orgId = await getCurrentOrgId();
      if (!orgId) throw new Error('No org');
      const { error } = await supabase
        .from('organization_members')
        .update({ role: role as any })
        .eq('org_id', orgId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const orgId = await getCurrentOrgId();
      if (!orgId) throw new Error('No org');
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

// ─── Accounts ───

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const orgId = await getCurrentOrgId();
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Account[];
    },
  });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: ['accounts', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id!)
        .single();
      
      if (error) throw error;
      return data as Account;
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: Omit<Account, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert(account)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', vars.id] });
    },
  });
}

// ─── Leads ───

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const orgId = await getCurrentOrgId();
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          accounts:account_id (
            account_name,
            country,
            industry,
            customer_status,
            meeting_status
          )
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Flatten joined account data
      return (data ?? []).map((l: any) => ({
        ...l,
        account_name: l.accounts?.account_name,
        account_country: l.accounts?.country,
        account_industry: l.accounts?.industry,
        account_customer_status: l.accounts?.customer_status,
        account_meeting_status: l.accounts?.meeting_status,
        accounts: undefined,
      })) as Lead[];
    },
  });
}

export function useLeadsByAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: ['leads', 'account', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Lead[];
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'account_name' | 'account_country' | 'account_industry' | 'account_customer_status' | 'account_meeting_status'>) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

// ─── Call Logs ───

export function useCallLogs() {
  return useQuery({
    queryKey: ['call-logs'],
    queryFn: async () => {
      const orgId = await getCurrentOrgId();
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('org_id', orgId)
        .order('called_at', { ascending: false });
      
      if (error) throw error;
      return data as CallLog[];
    },
  });
}

export function useCallLogsByLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['call-logs', 'lead', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('lead_id', leadId!)
        .order('called_at', { ascending: false });
      
      if (error) throw error;
      return data as CallLog[];
    },
  });
}

export function useCreateCallLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (log: Omit<CallLog, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('call_logs')
        .insert(log as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    },
  });
}
