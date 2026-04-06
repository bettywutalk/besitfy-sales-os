import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts, useLeads, useOrgMembers, useCallLogs } from '@/hooks/use-data';
import { MEETING_STAGE_OPTIONS } from '@/types';
import type { MeetingStage } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Target, TrendingUp, BarChart3, Mail, MailOpen, MessageSquare, AlertTriangle, Phone, PhoneCall } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const STAGE_COLORS: Record<MeetingStage, string> = {
  '還沒接觸': 'hsl(var(--muted-foreground))',
  '已接觸，尚需嘗試': 'hsl(45, 93%, 47%)',
  '已接觸，等窗口回覆': 'hsl(var(--primary))',
  '約失敗': 'hsl(var(--destructive))',
  '約成功': 'hsl(142, 71%, 45%)',
  '無需約': 'hsl(var(--muted-foreground))',
};

const EMAIL_COLORS = {
  sent: 'hsl(var(--primary))',
  opened: 'hsl(45, 93%, 47%)',
  responded: 'hsl(142, 71%, 45%)',
  bounced: 'hsl(var(--destructive))',
};

type TimeRange = 'all' | 'this_week' | 'this_month' | 'this_quarter' | 'last_month';

function getTimeRangeStart(range: TimeRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  switch (range) {
    case 'this_week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'this_month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case 'last_month': return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }
}

function getTimeRangeEnd(range: TimeRange): Date | null {
  if (range === 'all') return null;
  if (range === 'last_month') return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: callLogs = [], isLoading: callsLoading } = useCallLogs();
  const { data: members = [] } = useOrgMembers();
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const isLoading = accountsLoading || leadsLoading || callsLoading;

  const getMemberName = (userId?: string) => {
    if (!userId) return '未指派';
    const m = members.find((m: any) => m.user_id === userId);
    return m?.full_name || '未知';
  };

  // Time filtered call logs
  const filteredCallLogs = useMemo(() => {
    const start = getTimeRangeStart(timeRange);
    const end = getTimeRangeEnd(timeRange);
    return callLogs.filter(c => {
      if (start && new Date(c.called_at) < start) return false;
      if (end && new Date(c.called_at) >= end) return false;
      if (selectedRep !== 'all' && c.called_by !== selectedRep) return false;
      return true;
    });
  }, [callLogs, timeRange, selectedRep]);

  // ── Meeting Stage metrics ──
  const stageCounts = useMemo(() => {
    const filtered = selectedRep === 'all' ? accounts : accounts.filter(a => a.assigned_to === selectedRep);
    const counts: Record<string, number> = {};
    MEETING_STAGE_OPTIONS.forEach(s => { counts[s] = 0; });
    filtered.forEach(a => { counts[a.meeting_stage] = (counts[a.meeting_stage] || 0) + 1; });
    return MEETING_STAGE_OPTIONS.map(s => ({ stage: s, count: counts[s] }));
  }, [accounts, selectedRep]);

  const repBreakdown = useMemo(() => {
    const reps = new Map<string, Record<string, number>>();
    accounts.forEach(a => {
      const rep = a.assigned_to || '__unassigned__';
      if (!reps.has(rep)) {
        const init: Record<string, number> = {};
        MEETING_STAGE_OPTIONS.forEach(s => { init[s] = 0; });
        reps.set(rep, init);
      }
      reps.get(rep)![a.meeting_stage] = (reps.get(rep)![a.meeting_stage] || 0) + 1;
    });
    return Array.from(reps.entries()).map(([repId, stages]) => ({
      rep: repId === '__unassigned__' ? '未指派' : getMemberName(repId),
      repId,
      ...stages,
    }));
  }, [accounts, members]);

  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const filteredAccounts = useMemo(() => {
    let list = accounts;
    if (selectedRep !== 'all') list = list.filter(a => a.assigned_to === selectedRep);
    if (selectedStage) list = list.filter(a => a.meeting_stage === selectedStage);
    return list;
  }, [accounts, selectedRep, selectedStage]);

  const totalAccounts = useMemo(() => {
    return selectedRep === 'all' ? accounts.length : accounts.filter(a => a.assigned_to === selectedRep).length;
  }, [accounts, selectedRep]);

  const meetingSuccessRate = useMemo(() => {
    const sc = stageCounts.find(s => s.stage === '約成功');
    return totalAccounts > 0 ? Math.round(((sc?.count || 0) / totalAccounts) * 100) : 0;
  }, [stageCounts, totalAccounts]);

  // ── Cold Email metrics ──
  const filteredLeads = useMemo(() => {
    if (selectedRep === 'all') return leads;
    const repAccountIds = new Set(accounts.filter(a => a.assigned_to === selectedRep).map(a => a.id));
    return leads.filter(l => l.account_id && repAccountIds.has(l.account_id));
  }, [leads, accounts, selectedRep]);

  const emailStats = useMemo(() => {
    const sent = filteredLeads.filter(l => l.yamm_status !== '未發').length;
    const opened = filteredLeads.filter(l => ['EMAIL_OPENED', 'RESPONDED'].includes(l.yamm_status)).length;
    const responded = filteredLeads.filter(l => l.yamm_status === 'RESPONDED').length;
    const bounced = filteredLeads.filter(l => l.yamm_status === 'BOUNCED').length;

    const successAccountIds = new Set(accounts.filter(a => a.meeting_stage === '約成功').map(a => a.id));
    const converted = filteredLeads.filter(l => l.account_id && successAccountIds.has(l.account_id) && l.yamm_status !== '未發').length;

    return {
      sent, opened, responded, bounced, converted,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      responseRate: sent > 0 ? Math.round((responded / sent) * 100) : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
      replyConversionRate: sent > 0 ? Math.round((responded / sent) * 100) : 0,
      meetingConversionRate: sent > 0 ? Math.round((converted / sent) * 100) : 0,
    };
  }, [filteredLeads, accounts]);

  // ── Cold Call metrics ──
  const callStats = useMemo(() => {
    const total = filteredCallLogs.length;
    const connected = filteredCallLogs.filter(c => c.call_result === '已接' || c.call_result === '有效通話').length;
    const effective = filteredCallLogs.filter(c => c.call_result === '有效通話').length;

    // Meeting conversion: only count calls that actually connected (exclude 未接)
    const connectedLogs = filteredCallLogs.filter(c => c.call_result === '已接' || c.call_result === '有效通話');
    const calledAccountIds = new Set(connectedLogs.filter(c => c.account_id).map(c => c.account_id!));
    const successAccountIds = new Set(accounts.filter(a => a.meeting_stage === '約成功').map(a => a.id));
    const convertedCalls = [...calledAccountIds].filter(id => successAccountIds.has(id)).length;

    return {
      total, connected, effective,
      converted: convertedCalls,
      connectRate: total > 0 ? Math.round((connected / total) * 100) : 0,
      effectiveRate: total > 0 ? Math.round((effective / total) * 100) : 0,
      meetingConversionRate: calledAccountIds.size > 0 ? Math.round((convertedCalls / calledAccountIds.size) * 100) : 0,
    };
  }, [filteredCallLogs, accounts]);

  // Per-rep outreach breakdown
  const repOutreach = useMemo(() => {
    const repMap = new Map<string, {
      emailSent: number; emailOpened: number; emailResponded: number;
      calls: number; callsConnected: number; callsEffective: number;
      emailMeetingConv: number; callMeetingConv: number;
    }>();

    const successAccountIds = new Set(accounts.filter(a => a.meeting_stage === '約成功').map(a => a.id));

    // Email data
    leads.forEach(l => {
      if (l.yamm_status === '未發') return;
      const acct = accounts.find(a => a.id === l.account_id);
      const repId = acct?.assigned_to || '__unassigned__';
      if (!repMap.has(repId)) repMap.set(repId, { emailSent: 0, emailOpened: 0, emailResponded: 0, calls: 0, callsConnected: 0, callsEffective: 0, emailMeetingConv: 0, callMeetingConv: 0 });
      const r = repMap.get(repId)!;
      r.emailSent++;
      if (['EMAIL_OPENED', 'RESPONDED'].includes(l.yamm_status)) r.emailOpened++;
      if (l.yamm_status === 'RESPONDED') r.emailResponded++;
      if (l.account_id && successAccountIds.has(l.account_id)) r.emailMeetingConv++;
    });

    // Call data
    callLogs.forEach(c => {
      const repId = c.called_by || '__unassigned__';
      if (!repMap.has(repId)) repMap.set(repId, { emailSent: 0, emailOpened: 0, emailResponded: 0, calls: 0, callsConnected: 0, callsEffective: 0, emailMeetingConv: 0, callMeetingConv: 0 });
      const r = repMap.get(repId)!;
      r.calls++;
      if (c.call_result === '已接' || c.call_result === '有效通話') r.callsConnected++;
      if (c.call_result === '有效通話') r.callsEffective++;
      if (c.account_id && successAccountIds.has(c.account_id) && (c.call_result === '已接' || c.call_result === '有效通話')) r.callMeetingConv++;
    });

    return Array.from(repMap.entries()).map(([repId, stats]) => ({
      rep: repId === '__unassigned__' ? '未指派' : getMemberName(repId),
      ...stats,
      emailReplyRate: stats.emailSent > 0 ? Math.round((stats.emailResponded / stats.emailSent) * 100) : 0,
      emailMeetingRate: stats.emailSent > 0 ? Math.round((stats.emailMeetingConv / stats.emailSent) * 100) : 0,
      callConnectRate: stats.calls > 0 ? Math.round((stats.callsConnected / stats.calls) * 100) : 0,
    }));
  }, [leads, callLogs, accounts, members]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">追蹤業務約會議進度與 Outreach 表現</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部時間</SelectItem>
              <SelectItem value="this_week">本週</SelectItem>
              <SelectItem value="this_month">本月</SelectItem>
              <SelectItem value="last_month">上月</SelectItem>
              <SelectItem value="this_quarter">本季</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedRep} onValueChange={setSelectedRep}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="篩選業務" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部業務</SelectItem>
              {members.map((m: any) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="meeting" className="space-y-6">
        <TabsList>
          <TabsTrigger value="meeting">Meeting 進度</TabsTrigger>
          <TabsTrigger value="outreach">Outreach 表現</TabsTrigger>
        </TabsList>

        {/* ═══ Meeting Tab ═══ */}
        <TabsContent value="meeting" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stageCounts.map(({ stage, count }) => (
              <Card
                key={stage}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedStage === stage ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedStage(selectedStage === stage ? null : stage)}
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-foreground">{count}</div>
                  <StatusBadge type="stage" value={stage} className="mt-1" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
                <div>
                  <div className="text-sm text-muted-foreground">總 Accounts</div>
                  <div className="text-xl font-bold text-foreground">{totalAccounts}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><TrendingUp className="h-5 w-5 text-success" /></div>
                <div>
                  <div className="text-sm text-muted-foreground">約成功率</div>
                  <div className="text-xl font-bold text-foreground">{meetingSuccessRate}%</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10"><Users className="h-5 w-5 text-warning" /></div>
                <div>
                  <div className="text-sm text-muted-foreground">業務人數</div>
                  <div className="text-xl font-bold text-foreground">{members.length}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">階段分佈</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stageCounts.filter(s => s.count > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="count" nameKey="stage" label={({ stage, count }) => `${stage}: ${count}`} labelLine={false}>
                        {stageCounts.filter(s => s.count > 0).map(s => (
                          <Cell key={s.stage} fill={STAGE_COLORS[s.stage as MeetingStage] || '#ccc'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">各業務進度</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={repBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="rep" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {MEETING_STAGE_OPTIONS.map(stage => (
                        <Bar key={stage} dataKey={stage} stackId="a" fill={STAGE_COLORS[stage]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Account 列表
                {selectedStage && <StatusBadge type="stage" value={selectedStage} />}
                <span className="text-sm font-normal text-muted-foreground ml-2">共 {filteredAccounts.length} 筆</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Meeting Stage</TableHead>
                      <TableHead>Meeting Status</TableHead>
                      <TableHead>Customer Status</TableHead>
                      <TableHead>負責業務</TableHead>
                      <TableHead>Country</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">無資料</TableCell></TableRow>
                    ) : filteredAccounts.map(a => (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/accounts/${a.id}`)}>
                        <TableCell className="font-medium">{a.account_name}</TableCell>
                        <TableCell><StatusBadge type="stage" value={a.meeting_stage} /></TableCell>
                        <TableCell><StatusBadge type="meeting" value={a.meeting_status} /></TableCell>
                        <TableCell><StatusBadge type="customer" value={a.customer_status} /></TableCell>
                        <TableCell>{getMemberName(a.assigned_to)}</TableCell>
                        <TableCell>{a.country}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Outreach Tab ═══ */}
        <TabsContent value="outreach" className="space-y-6">
          {/* Email + Call KPI side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email KPIs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Cold Email
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-primary/5">
                    <div className="text-2xl font-bold text-foreground">{emailStats.sent}</div>
                    <div className="text-xs text-muted-foreground">已發信</div>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/5">
                    <div className="text-2xl font-bold text-foreground">{emailStats.opened}</div>
                    <div className="text-xs text-muted-foreground">開信 ({emailStats.openRate}%)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-success/5">
                    <div className="text-2xl font-bold text-foreground">{emailStats.responded}</div>
                    <div className="text-xs text-muted-foreground">回覆 ({emailStats.responseRate}%)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/5">
                    <div className="text-2xl font-bold text-foreground">{emailStats.bounced}</div>
                    <div className="text-xs text-muted-foreground">Bounce ({emailStats.bounceRate}%)</div>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">回覆轉換率</span>
                    <span className="font-bold">{emailStats.replyConversionRate}%</span>
                  </div>
                  <Progress value={emailStats.replyConversionRate} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">會議轉換率</span>
                    <span className="font-bold text-success">{emailStats.meetingConversionRate}%</span>
                  </div>
                  <Progress value={emailStats.meetingConversionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Call KPIs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Cold Call
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-primary/5">
                    <div className="text-2xl font-bold text-foreground">{callStats.total}</div>
                    <div className="text-xs text-muted-foreground">總撥打</div>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/5">
                    <div className="text-2xl font-bold text-foreground">{callStats.connected}</div>
                    <div className="text-xs text-muted-foreground">接通 ({callStats.connectRate}%)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-success/5">
                    <div className="text-2xl font-bold text-foreground">{callStats.effective}</div>
                    <div className="text-xs text-muted-foreground">有效通話 ({callStats.effectiveRate}%)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5">
                    <div className="text-2xl font-bold text-foreground">{callStats.converted}</div>
                    <div className="text-xs text-muted-foreground">約成功 Accounts</div>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">接通率</span>
                    <span className="font-bold">{callStats.connectRate}%</span>
                  </div>
                  <Progress value={callStats.connectRate} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">會議轉換率</span>
                    <span className="font-bold text-success">{callStats.meetingConversionRate}%</span>
                  </div>
                  <Progress value={callStats.meetingConversionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined funnel */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-foreground">{emailStats.sent + callStats.total}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Outreach</div>
                  <div className="text-xs text-muted-foreground">{emailStats.sent} Email + {callStats.total} Call</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{emailStats.responded + callStats.effective}</div>
                  <div className="text-xs text-muted-foreground mt-1">有效接觸</div>
                  <div className="text-xs text-muted-foreground">{emailStats.responded} 回覆 + {callStats.effective} 有效通話</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-success">{emailStats.converted + callStats.converted}</div>
                  <div className="text-xs text-muted-foreground mt-1">約到會議</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">
                    {(emailStats.sent + callStats.total) > 0
                      ? Math.round(((emailStats.converted + callStats.converted) / (emailStats.sent + callStats.total)) * 100)
                      : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">綜合轉換率</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-rep performance table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">各業務 Outreach 績效</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="align-bottom">業務</TableHead>
                      <TableHead colSpan={4} className="text-center border-b-0 text-primary">Cold Email</TableHead>
                      <TableHead colSpan={3} className="text-center border-b-0 text-primary">Cold Call</TableHead>
                      <TableHead colSpan={2} className="text-center border-b-0 text-success">轉換率</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-right text-xs">發信</TableHead>
                      <TableHead className="text-right text-xs">開信</TableHead>
                      <TableHead className="text-right text-xs">回覆</TableHead>
                      <TableHead className="text-right text-xs">回覆率</TableHead>
                      <TableHead className="text-right text-xs">撥打</TableHead>
                      <TableHead className="text-right text-xs">接通</TableHead>
                      <TableHead className="text-right text-xs">接通率</TableHead>
                      <TableHead className="text-right text-xs">Email→會議</TableHead>
                      <TableHead className="text-right text-xs">Call→會議</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repOutreach.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">尚無資料</TableCell></TableRow>
                    ) : repOutreach.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.rep}</TableCell>
                        <TableCell className="text-right">{r.emailSent}</TableCell>
                        <TableCell className="text-right">{r.emailOpened}</TableCell>
                        <TableCell className="text-right">{r.emailResponded}</TableCell>
                        <TableCell className="text-right">{r.emailReplyRate}%</TableCell>
                        <TableCell className="text-right">{r.calls}</TableCell>
                        <TableCell className="text-right">{r.callsConnected}</TableCell>
                        <TableCell className="text-right">{r.callConnectRate}%</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${r.emailMeetingRate >= 10 ? 'text-success' : r.emailMeetingRate >= 5 ? 'text-warning' : 'text-muted-foreground'}`}>
                            {r.emailMeetingRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${r.callConnectRate >= 30 ? 'text-success' : r.callConnectRate >= 15 ? 'text-warning' : 'text-muted-foreground'}`}>
                            {r.calls > 0 ? Math.round((r.callsEffective / r.calls) * 100) : 0}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Email & Call funnel charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Email 漏斗</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: '已發信', value: emailStats.sent, fill: EMAIL_COLORS.sent },
                      { name: '已開信', value: emailStats.opened, fill: EMAIL_COLORS.opened },
                      { name: '已回覆', value: emailStats.responded, fill: EMAIL_COLORS.responded },
                      { name: '約成功', value: emailStats.converted, fill: 'hsl(142, 71%, 45%)' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {[EMAIL_COLORS.sent, EMAIL_COLORS.opened, EMAIL_COLORS.responded, 'hsl(142, 71%, 45%)'].map((color, idx) => (
                          <Cell key={idx} fill={color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Call 漏斗</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: '總撥打', value: callStats.total, fill: 'hsl(var(--primary))' },
                      { name: '已接通', value: callStats.connected, fill: 'hsl(45, 93%, 47%)' },
                      { name: '有效通話', value: callStats.effective, fill: 'hsl(142, 71%, 45%)' },
                      { name: '約成功', value: callStats.converted, fill: 'hsl(200, 80%, 50%)' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {['hsl(var(--primary))', 'hsl(45, 93%, 47%)', 'hsl(142, 71%, 45%)', 'hsl(200, 80%, 50%)'].map((color, idx) => (
                          <Cell key={idx} fill={color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
