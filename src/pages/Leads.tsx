import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useLeads, useCallLogs, useCreateCallLog } from '@/hooks/use-data';
import { PRIORITY_OPTIONS, CALL_RESULT_OPTIONS } from '@/types';
import { Search, Plus, SlidersHorizontal, Phone, PhoneCall } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Lead, CallResult } from '@/types';
import { toast } from 'sonner';

export default function Leads() {
  const { data: leads = [], isLoading } = useLeads();
  const { data: callLogs = [] } = useCallLogs();
  const createCallLog = useCreateCallLog();
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Call log dialog state
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callDialogLead, setCallDialogLead] = useState<Lead | null>(null);
  const [callResult, setCallResult] = useState<CallResult>('未接');
  const [callNote, setCallNote] = useState('');

  // Call count per lead
  const callCountMap = useMemo(() => {
    const map = new Map<string, number>();
    callLogs.forEach(c => {
      map.set(c.lead_id, (map.get(c.lead_id) || 0) + 1);
    });
    return map;
  }, [callLogs]);

  // Call logs for selected lead
  const selectedLeadCallLogs = useMemo(() => {
    if (!selectedLead) return [];
    return callLogs.filter(c => c.lead_id === selectedLead.id);
  }, [callLogs, selectedLead]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${l.first_name}${l.last_name}${l.title}${l.email}${l.account_name}`.toLowerCase().includes(q)) return false;
      }
      if (priorityFilter !== 'all' && l.priority !== priorityFilter) return false;
      return true;
    });
  }, [leads, search, priorityFilter]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((l) => l.id)));
  };

  const openCallDialog = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setCallDialogLead(lead);
    setCallResult('未接');
    setCallNote('');
    setCallDialogOpen(true);
  };

  const handleCreateCall = async () => {
    if (!callDialogLead) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('請先登入'); return; }

    createCallLog.mutate(
      {
        org_id: callDialogLead.org_id,
        lead_id: callDialogLead.id,
        account_id: callDialogLead.account_id || undefined,
        called_by: user.id,
        call_result: callResult,
        note: callNote || undefined,
        called_at: new Date().toISOString(),
      },
      {
        onSuccess: () => { toast.success('通話記錄已新增'); setCallDialogOpen(false); },
        onError: () => toast.error('新增失敗'),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">管理所有潛在客戶聯絡人 · {filtered.length} 筆</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" />新增 Lead</Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜尋姓名、職稱、公司..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />篩選
          </Button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">已選 {selectedIds.size} 筆</span>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-xl">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部 Priority</SelectItem>
                {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>姓氏</TableHead>
              <TableHead>名字</TableHead>
              <TableHead>職稱</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Email</TableHead>
              
              <TableHead>Calls</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <>
                {filtered.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                    </TableCell>
                    <TableCell><StatusBadge type="priority" value={lead.priority} /></TableCell>
                    <TableCell className="font-medium">
                      {lead.is_manager && <span className="mr-1" title="主管">👔</span>}
                      {lead.is_foreigner && <span className="mr-1" title="外國人">🌐</span>}
                      {lead.last_name}
                    </TableCell>
                    <TableCell>{lead.first_name}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.title}</TableCell>
                    <TableCell>
                      <span className="text-primary hover:underline text-sm">{lead.account_name}</span>
                    </TableCell>
                    <TableCell className={lead.email_status === 'bounced' ? 'line-through text-destructive text-sm' : 'text-sm'}>
                      {lead.email}
                    </TableCell>
                    
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 h-7 px-2 text-xs"
                        onClick={(e) => openCallDialog(lead, e)}
                      >
                        <PhoneCall className="h-3 w-3" />
                        {callCountMap.get(lead.id) || 0}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {lead.linkedin_engaged ? (
                        <Badge variant="secondary" className="text-xs bg-success/15 text-success">Engaged</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {lead.tags?.slice(0, 2).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                        {(lead.tags?.length || 0) > 2 && <span className="text-xs text-muted-foreground">+{(lead.tags?.length || 0) - 2}</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    {leads.length === 0 ? '尚無 Lead，點擊右上角新增' : '沒有符合條件的 Lead'}
                  </TableCell></TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Call Log Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              記錄通話 — {callDialogLead?.last_name}{callDialogLead?.first_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>通話結果</Label>
              <Select value={callResult} onValueChange={(v) => setCallResult(v as CallResult)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CALL_RESULT_OPTIONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea placeholder="通話內容摘要..." value={callNote} onChange={e => setCallNote(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateCall} disabled={createCallLog.isPending}>
              {createCallLog.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Side Panel */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedLead.is_manager && <span>👔</span>}
                  {selectedLead.is_foreigner && <span>🌐</span>}
                  {selectedLead.last_name}{selectedLead.first_name}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">{selectedLead.title}</p>
              </SheetHeader>

              <Tabs defaultValue="info" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="info" className="flex-1">基本資料</TabsTrigger>
                  <TabsTrigger value="calls" className="flex-1">通話 ({selectedLeadCallLogs.length})</TabsTrigger>
                  <TabsTrigger value="email" className="flex-1">郵件</TabsTrigger>
                  <TabsTrigger value="bounce" className="flex-1">Bounce</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <DetailRow label="Account" value={selectedLead.account_name} />
                  <DetailRow label="Email" value={selectedLead.email} />
                  <DetailRow label="Phone" value={selectedLead.phone} />
                  <DetailRow label="Priority" value={<StatusBadge type="priority" value={selectedLead.priority} />} />
                  
                  <DetailRow label="LinkedIn" value={
                    selectedLead.linkedin_url ? <a href={selectedLead.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm">Profile</a> : undefined
                  } />
                  <DetailRow label="LinkedIn Engaged" value={selectedLead.linkedin_engaged ? '✅ Yes' : '❌ No'} />
                  <DetailRow label="通話次數" value={callCountMap.get(selectedLead.id)?.toString() || '0'} />
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Tags</Label>
                    <div className="flex gap-1 flex-wrap">
                      {selectedLead.tags?.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      {(!selectedLead.tags || selectedLead.tags.length === 0) && <span className="text-xs text-muted-foreground">無標籤</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Notes</Label>
                    <p className="text-sm">{selectedLead.note || '無備註'}</p>
                  </div>
                </TabsContent>

                <TabsContent value="calls" className="mt-4 space-y-4">
                  <Button size="sm" className="gap-1" onClick={(e) => openCallDialog(selectedLead, e as any)}>
                    <Phone className="h-3 w-3" /> 記錄通話
                  </Button>
                  {selectedLeadCallLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">尚無通話記錄</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedLeadCallLogs.map(log => (
                        <div key={log.id} className="border rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant={log.call_result === '有效通話' ? 'default' : log.call_result === '已接' ? 'secondary' : 'outline'} className="text-xs">
                              {log.call_result}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.called_at).toLocaleString('zh-TW')}
                            </span>
                          </div>
                          {log.note && <p className="text-sm text-muted-foreground">{log.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="email" className="mt-4">
                  <p className="text-center text-muted-foreground py-8">郵件功能即將推出</p>
                </TabsContent>
                <TabsContent value="bounce" className="mt-4">
                  <p className="text-center text-muted-foreground py-8">
                    {selectedLead.bounce_note ? `Bounce 原因：${selectedLead.bounce_note}` : 'Bounce 管理功能即將推出'}
                  </p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}
