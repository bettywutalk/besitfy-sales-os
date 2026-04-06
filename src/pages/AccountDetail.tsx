import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccount, useLeadsByAccount, useUpdateAccount, useOrgMembers } from '@/hooks/use-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ExternalLink, Edit, Plus, Sparkles, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MEETING_STATUS_OPTIONS, CUSTOMER_STATUS_OPTIONS, MEETING_STAGE_OPTIONS } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: account, isLoading } = useAccount(id);
  const { data: leads = [], isLoading: leadsLoading } = useLeadsByAccount(id);
  const { data: members = [] } = useOrgMembers();
  const updateAccount = useUpdateAccount();
  const [enriching, setEnriching] = useState(false);

  const isNoMeeting = (status: string) =>
    status === '不用約（既有客戶）' || status === '不用約（non-ICP）';

  const handleQuickUpdate = (field: string, value: string) => {
    if (!id) return;
    const updates: Record<string, any> = { id, [field]: value || null };

    if (field === 'customer_status') {
      if (value === 'Active Customer') {
        updates.meeting_status = '不用約（既有客戶）';
        updates.meeting_stage = '無需約';
        updates.assigned_to = null;
      } else if (value === 'non-ICP') {
        updates.meeting_status = '不用約（non-ICP）';
        updates.meeting_stage = '無需約';
        updates.assigned_to = null;
      } else {
        if (account && isNoMeeting(account.meeting_status)) {
          updates.meeting_status = '尚未開發';
          updates.meeting_stage = '還沒接觸';
        }
      }
    }

    if (field === 'meeting_status' && isNoMeeting(value)) {
      updates.meeting_stage = '無需約';
      updates.assigned_to = null;
    }

    updateAccount.mutate(
      updates as any,
      {
        onSuccess: () => toast.success('已更新'),
        onError: () => toast.error('更新失敗'),
      }
    );
  };

  const getMemberName = (userId?: string) => {
    if (!userId) return null;
    return members.find((m) => m.user_id === userId)?.full_name || null;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>Account not found</p>
        <Button variant="link" onClick={() => navigate('/accounts')}>返回列表</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{account.account_name}</h1>
          <p className="text-muted-foreground text-sm">{account.brand} · {account.country} · {account.industry}</p>
        </div>
        <Button variant="outline" className="gap-2" disabled={enriching} onClick={async () => {
          setEnriching(true);
          try {
            const { data, error } = await supabase.functions.invoke('enrich-account', {
              body: { accounts: [{ id: account.id, account_name: account.account_name, country: account.country }] },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            const result = data.results?.[0];
            if (result) {
              await updateAccount.mutateAsync({ id: account.id, ec_link: result.ec_link, industry: result.industry, platform: result.platform });
              toast.success('AI 補齊完成', { description: `官網: ${result.ec_link} · 產業: ${result.industry} · 平台: ${result.platform}` });
            } else {
              toast.info('AI 未找到相關資訊');
            }
          } catch (err: any) {
            toast.error('AI 補齊失敗', { description: err.message });
          } finally {
            setEnriching(false);
          }
        }}>
          {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI 補齊
        </Button>
        <Button variant="outline" className="gap-2"><Edit className="h-4 w-4" />編輯</Button>
      </div>

      {/* Status Cards - with inline edit */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Meeting Status</CardTitle></CardHeader>
          <CardContent>
            <Select value={account.meeting_status} onValueChange={(v) => handleQuickUpdate('meeting_status', v)}>
              <SelectTrigger className="h-8 w-full border-dashed">
                <StatusBadge type="meeting" value={account.meeting_status} />
              </SelectTrigger>
              <SelectContent>
                {MEETING_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}><StatusBadge type="meeting" value={s} /></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Meeting Stage</CardTitle></CardHeader>
          <CardContent>
            {account && isNoMeeting(account.meeting_status) ? (
              <StatusBadge type="stage" value="無需約" />
            ) : (
              <Select value={account.meeting_stage} onValueChange={(v) => handleQuickUpdate('meeting_stage', v)}>
                <SelectTrigger className="h-8 w-full border-dashed">
                  <StatusBadge type="stage" value={account.meeting_stage} />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_STAGE_OPTIONS.filter(s => s !== '無需約').map((s) => (
                    <SelectItem key={s} value={s}><StatusBadge type="stage" value={s} /></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Customer Status</CardTitle></CardHeader>
          <CardContent><StatusBadge type="customer" value={account.customer_status} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Monthly PV</CardTitle></CardHeader>
          <CardContent><span className="text-xl font-bold">{account.pv_k?.toLocaleString()}K</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">負責業務</CardTitle></CardHeader>
          <CardContent>
            {account && isNoMeeting(account.meeting_status) ? (
              <span className="text-sm text-muted-foreground">無需分配</span>
            ) : (
              <Select
                value={account.assigned_to || '_unassigned'}
                onValueChange={(v) => handleQuickUpdate('assigned_to', v === '_unassigned' ? '' : v)}
              >
                <SelectTrigger className="h-8 w-full border-dashed">
                  <span className={account.assigned_to ? 'text-sm' : 'text-sm text-destructive'}>
                    {getMemberName(account.assigned_to) || '未分配'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_unassigned"><span className="text-destructive">未分配</span></SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info + Leads */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本資訊</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="activity">活動記錄</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <InfoRow label="UUID" value={account.domain_key} />
              <InfoRow label="Platform" value={account.platform} />
              <InfoRow label="MarTech Stack" value={
                <div className="flex gap-1 flex-wrap">
                  {account.martech_stack?.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              } />
              <InfoRow label="Competitor" value={
                <div className="flex gap-1 flex-wrap">
                  {account.competitor?.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                </div>
              } />
              <InfoRow label="MTU" value={account.mtu?.toLocaleString()} />
              <InfoRow label="EC Link" value={
                account.ec_link ? <a href={account.ec_link} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">{account.ec_link}<ExternalLink className="h-3 w-3" /></a> : undefined
              } />
              <InfoRow label="Notes" value={account.notes} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">相關 Leads</CardTitle>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />新增 Lead</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>職稱</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Priority</TableHead>
                    
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">
                            {lead.is_manager && <span className="mr-1">👔</span>}
                            {lead.is_foreigner && <span className="mr-1">🌐</span>}
                            {lead.last_name}{lead.first_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{lead.title}</TableCell>
                          <TableCell className={lead.email_status === 'bounced' ? 'line-through text-destructive' : ''}>{lead.email}</TableCell>
                          <TableCell><StatusBadge type="priority" value={lead.priority} /></TableCell>
                          
                        </TableRow>
                      ))}
                      {leads.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">尚無 Lead</TableCell></TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              活動記錄功能即將推出
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
