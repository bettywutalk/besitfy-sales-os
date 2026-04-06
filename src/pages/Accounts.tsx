import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAccounts, useUpdateAccount, useOrgMembers } from '@/hooks/use-data';
import { MEETING_STATUS_OPTIONS, CUSTOMER_STATUS_OPTIONS, MEETING_STAGE_OPTIONS, COUNTRY_OPTIONS, INDUSTRY_OPTIONS, PRODUCT_INTEREST_OPTIONS } from '@/types';
import type { Account } from '@/types';
import { Search, Plus, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Globe, Sparkles, Loader2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type SortField = keyof Account | null;
type SortDir = 'asc' | 'desc';

export default function Accounts() {
  const navigate = useNavigate();
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: members = [] } = useOrgMembers();
  const updateAccount = useUpdateAccount();
  const [search, setSearch] = useState('');
  const [meetingFilter, setMeetingFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [colSearch, setColSearch] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // AI Enrichment state
  type EnrichResult = { id: string; ec_link: string; industry: string; platform: string; confidence: string };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)));
    }
  };

  const extractDomain = (url: string): string => {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const buildUUID = (url: string, country: string): string => {
    try {
      const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
      // 從 TLD 判斷國碼
      const tldCountryMap: Record<string, string> = { 'hk': 'HK', 'tw': 'TW', 'cn': 'CN', 'sg': 'SG', 'jp': 'JP', 'kr': 'KR' };
      const tld = hostname.split('.').pop() || '';
      const countryCode = tldCountryMap[tld] || country || 'TW';
      // 取主域名（去掉 TLD 和 country code TLD）
      const parts = hostname.split('.');
      const domainName = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      return `${domainName} ${countryCode}`;
    } catch {
      return '';
    }
  };

  const handleEnrich = async (accountsToEnrich: Account[]) => {
    if (accountsToEnrich.length === 0) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-account', {
        body: {
          accounts: accountsToEnrich.map(a => ({
            id: a.id,
            account_name: a.account_name,
            country: a.country,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // 直接套用到表格，不跳視窗
      const results: EnrichResult[] = data.results || [];
      for (const result of results) {
        const account = accounts.find(a => a.id === result.id);
        const currentMeta = (account?.metadata as any) || {};
        const aiFields = { ...(currentMeta.ai_fields || {}) };
        if (result.ec_link) aiFields.ec_link = 'pending';
        if (result.industry) aiFields.industry = 'pending';
        if (result.platform) aiFields.platform = 'pending';
        const uuid = result.ec_link ? buildUUID(result.ec_link, account?.country || 'TW') : null;
        if (uuid) aiFields.domain_key = 'pending';
        await updateAccount.mutateAsync({
          id: result.id,
          ec_link: result.ec_link || undefined,
          industry: result.industry || undefined,
          platform: result.platform || undefined,
          ...(!account?.domain_key && uuid ? { domain_key: uuid } : {}),
          metadata: { ...currentMeta, ai_fields: aiFields },
        } as any);
      }
      toast.success(`AI 已補齊 ${results.length} 筆，黃色欄位請確認後點 ✨`);
    } catch (err: any) {
      toast.error('AI 補齊失敗', { description: err.message });
    } finally {
      setEnriching(false);
      setSelectedIds(new Set());
    }
  };

  const getAiStatus = (account: Account, field: string): 'pending' | 'verified' | null => {
    return (account.metadata?.ai_fields?.[field] as 'pending' | 'verified') ?? null;
  };

  const handleVerifyField = async (accountId: string, field: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    const currentMeta = (account.metadata as any) || {};
    const aiFields = { ...(currentMeta.ai_fields || {}), [field]: 'verified' };
    await updateAccount.mutateAsync({
      id: accountId,
      metadata: { ...currentMeta, ai_fields: aiFields },
    } as any);
  };

  const AiCellWrapper = ({ account, field, children }: { account: Account; field: string; children: React.ReactNode }) => {
    const status = getAiStatus(account, field);
    if (!status) return <>{children}</>;
    return (
      <div className={`relative rounded-md px-1.5 py-0.5 -mx-1.5 group ${status === 'pending' ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-green-50 ring-1 ring-green-200'}`}>
        {children}
        {status === 'pending' && (
          <button
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 hover:bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-sm transition-colors"
            title="AI 填入，點擊確認"
            onClick={(e) => { e.stopPropagation(); handleVerifyField(account.id, field); }}
          >
            ✨
          </button>
        )}
        {status === 'verified' && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-400 text-white text-[9px] flex items-center justify-center shadow-sm" title="已確認">
            ✓
          </span>
        )}
      </div>
    );
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filtered = useMemo(() => {
    const cs = (field: string) => colSearch[field]?.toLowerCase() || '';
    let result = accounts.filter((a) => {
      if (search && !a.account_name.toLowerCase().includes(search.toLowerCase()) && !a.brand?.toLowerCase().includes(search.toLowerCase()) && !a.domain_key?.toLowerCase().includes(search.toLowerCase())) return false;
      if (meetingFilter !== 'all' && a.meeting_status !== meetingFilter) return false;
      if (customerFilter !== 'all' && a.customer_status !== customerFilter) return false;
      if (countryFilter !== 'all' && a.country !== countryFilter) return false;
      if (assignedFilter !== 'all') {
        if (assignedFilter === '__unassigned__') { if (a.assigned_to) return false; }
        else { if (a.assigned_to !== assignedFilter) return false; }
      }
      if (cs('account_name') && !a.account_name.toLowerCase().includes(cs('account_name'))) return false;
      if (cs('domain_key') && !(a.domain_key || '').toLowerCase().includes(cs('domain_key'))) return false;
      if (cs('ec_link') && !(a.ec_link || '').toLowerCase().includes(cs('ec_link'))) return false;
      if (cs('platform') && !(a.platform || '').toLowerCase().includes(cs('platform'))) return false;
      if (cs('competitor') && !(a.competitor || []).join(',').toLowerCase().includes(cs('competitor'))) return false;
      if (cs('pv_k') && (a.pv_k == null || a.pv_k < Number(colSearch['pv_k']))) return false;
      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        const va = (a as any)[sortField] ?? '';
        const vb = (b as any)[sortField] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        const sa = String(va).toLowerCase();
        const sb = String(vb).toLowerCase();
        return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }

    return result;
  }, [accounts, search, meetingFilter, customerFilter, countryFilter, assignedFilter, sortField, sortDir]);

  const isNoMeeting = (status: string) =>
    status === '不用約（既有客戶）' || status === '不用約（non-ICP）';

  const handleQuickUpdate = (id: string, field: string, value: string) => {
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
        const account = accounts.find((a) => a.id === id);
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
    updateAccount.mutate(updates as any, {
      onSuccess: () => { setSortField(null); toast.success('已更新'); },
      onError: () => toast.error('更新失敗'),
    });
  };

  const handleNumericUpdate = (id: string, field: string, value: string) => {
    const num = value === '' ? null : Number(value);
    updateAccount.mutate({ id, [field]: num } as any, {
      onSuccess: () => toast.success('已更新'),
      onError: () => toast.error('更新失敗'),
    });
  };

  const startEdit = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    if (field === 'pv_k' || field === 'mtu') {
      handleNumericUpdate(id, field, editValue);
    } else {
      handleQuickUpdate(id, field, editValue);
    }
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const isEditing = (id: string, field: string) =>
    editingCell?.id === id && editingCell?.field === field;

  const getMemberName = (userId?: string) => {
    if (!userId) return null;
    return members.find((m) => m.user_id === userId)?.full_name || null;
  };

  const renderEditableText = (account: Account, field: keyof Account, display?: string) => {
    const val = (account[field] as string) ?? '';
    if (isEditing(account.id, field)) {
      return (
        <Input
          autoFocus
          className="h-7 text-sm w-full min-w-[60px]"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
        />
      );
    }
    return (
      <span
        className="cursor-text hover:bg-muted/60 rounded px-1 -mx-1 py-0.5 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          startEdit(account.id, field, val);
        }}
      >
        {display || val || <span className="text-muted-foreground/50">—</span>}
      </span>
    );
  };

  const renderEditableNumber = (account: Account, field: 'pv_k' | 'mtu' | 'line_friends') => {
    const val = account[field];
    if (isEditing(account.id, field)) {
      return (
        <Input
          autoFocus
          type="number"
          className="h-7 text-sm w-20"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
        />
      );
    }
    return (
      <span
        className="cursor-text hover:bg-muted/60 rounded px-1 -mx-1 py-0.5 transition-colors text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          startEdit(account.id, field, val?.toString() ?? '');
        }}
      >
        {val != null ? val.toLocaleString() : <span className="text-muted-foreground/50">—</span>}
      </span>
    );
  };

  const columns: { label: string; field: SortField; width?: string }[] = [
    { label: 'Meeting', field: 'meeting_status', width: 'w-32' },
    { label: 'Stage', field: 'meeting_stage', width: 'w-36' },
    { label: 'Customer', field: 'customer_status', width: 'w-40' },
    { label: 'Country', field: 'country', width: 'w-24' },
    { label: 'UUID', field: 'domain_key', width: 'w-32' },
    { label: 'Account Name', field: 'account_name' },
    { label: '官網', field: 'ec_link', width: 'w-36' },
    { label: 'Industry', field: 'industry', width: 'w-28' },
    { label: 'PV(K)', field: 'pv_k', width: 'w-20' },
    { label: 'Platform', field: 'platform', width: 'w-28' },
    { label: 'Competitor', field: 'competitor', width: 'w-32' },
    { label: 'LINE好友數', field: 'line_friends', width: 'w-24' },
    { label: 'PR吃到飽', field: 'interest_pr', width: 'w-28' },
    { label: '客服機器人', field: 'interest_csbot', width: 'w-28' },
    { label: 'Assigned', field: 'assigned_to', width: 'w-28' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">管理所有客戶帳戶 · {filtered.length} 筆</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={enriching}
              onClick={() => handleEnrich(filtered.filter(a => selectedIds.has(a.id)))}
            >
              {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI 補齊 ({selectedIds.size})
            </Button>
          )}
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            新增 Account
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜尋公司名稱..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            篩選
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-xl">
            <Select value={meetingFilter} onValueChange={setMeetingFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Meeting Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部 Meeting</SelectItem>
                {MEETING_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Customer Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部 Customer</SelectItem>
                {CUSTOMER_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {COUNTRY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="負責業務" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部業務</SelectItem>
                <SelectItem value="__unassigned__">未指派</SelectItem>
                {members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Table */}
      <CardWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.label}
                  className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${col.width || ''}`}
                  onClick={() => toggleSort(col.field)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.field === 'ec_link' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-amber-400 shrink-0" onClick={(e) => e.stopPropagation()} />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                          官網由 AI 自動填入，可能有誤。請人工確認後點 ✨ 改為綠色。
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <SortIcon field={col.field} />
                  </div>
                </TableHead>
              ))}
            </TableRow>
            {/* 欄位搜尋列 */}
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead />
              {columns.map((col) => {
                const textFields = ['account_name', 'domain_key', 'ec_link', 'platform', 'competitor'];
                const isText = col.field && textFields.includes(col.field as string);
                const isPv = col.field === 'pv_k';
                return (
                  <TableHead key={col.label} className="py-1 px-2">
                    {isText && (
                      <Input
                        className="h-6 text-xs px-2 bg-background"
                        placeholder="搜尋…"
                        value={colSearch[col.field as string] || ''}
                        onChange={(e) => setColSearch(prev => ({ ...prev, [col.field as string]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {isPv && (
                      <Input
                        type="number"
                        className="h-6 text-xs px-2 bg-background w-16"
                        placeholder="≥"
                        value={colSearch['pv_k'] || ''}
                        onChange={(e) => setColSearch(prev => ({ ...prev, pv_k: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </TableHead>
                );
              })}
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
                {filtered.map((account) => (
                  <TableRow key={account.id} className="hover:bg-muted/50">
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(account.id)}
                        onCheckedChange={() => toggleSelect(account.id)}
                      />
                    </TableCell>
                    {/* Meeting Status */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={account.meeting_status}
                        onValueChange={(v) => handleQuickUpdate(account.id, 'meeting_status', v)}
                      >
                        <SelectTrigger className="h-7 w-28 border-none bg-transparent p-0 shadow-none focus:ring-0">
                          <StatusBadge type="meeting" value={account.meeting_status} />
                        </SelectTrigger>
                        <SelectContent>
                          {MEETING_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}><StatusBadge type="meeting" value={s} /></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Meeting Stage */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isNoMeeting(account.meeting_status) ? (
                        <StatusBadge type="stage" value="無需約" />
                      ) : (
                        <Select
                          value={account.meeting_stage}
                          onValueChange={(v) => handleQuickUpdate(account.id, 'meeting_stage', v)}
                        >
                          <SelectTrigger className="h-7 w-36 border-none bg-transparent p-0 shadow-none focus:ring-0">
                            <StatusBadge type="stage" value={account.meeting_stage} />
                          </SelectTrigger>
                          <SelectContent>
                            {MEETING_STAGE_OPTIONS.filter(s => s !== '無需約').map((s) => (
                              <SelectItem key={s} value={s}><StatusBadge type="stage" value={s} /></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    {/* Customer Status */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={account.customer_status}
                        onValueChange={(v) => handleQuickUpdate(account.id, 'customer_status', v)}
                      >
                        <SelectTrigger className="h-7 w-36 border-none bg-transparent p-0 shadow-none focus:ring-0">
                          <StatusBadge type="customer" value={account.customer_status} />
                        </SelectTrigger>
                        <SelectContent>
                          {CUSTOMER_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}><StatusBadge type="customer" value={s} /></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Country */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={account.country}
                        onValueChange={(v) => handleQuickUpdate(account.id, 'country', v)}
                      >
                        <SelectTrigger className="h-7 w-20 border-none bg-transparent p-0 shadow-none focus:ring-0">
                          <span className="text-sm font-medium">{account.country}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* UUID (domain_key) */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <AiCellWrapper account={account} field="domain_key">
                        <span className="text-xs text-muted-foreground font-mono">
                          {renderEditableText(account, 'domain_key')}
                        </span>
                      </AiCellWrapper>
                    </TableCell>

                    {/* Account Name */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary">
                          {isEditing(account.id, 'account_name') ? (
                            <Input
                              autoFocus
                              className="h-7 text-sm"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                          ) : (
                            <span
                              className="cursor-text hover:underline"
                              onClick={() => startEdit(account.id, 'account_name', account.account_name)}
                            >
                              {account.account_name}
                            </span>
                          )}
                        </span>
                        {account.brand && !isEditing(account.id, 'account_name') && (
                          <span className="text-xs text-muted-foreground">{account.brand}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* 官網 ec_link */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <AiCellWrapper account={account} field="ec_link">
                      {isEditing(account.id, 'ec_link') ? (
                        <Input
                          autoFocus
                          className="h-7 text-xs"
                          placeholder="https://..."
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          {account.ec_link ? (
                            <a
                              href={account.ec_link.startsWith('http') ? account.ec_link : `https://${account.ec_link}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate max-w-[100px]"
                              title={account.ec_link}
                            >
                              <ExternalLink className="h-3.5 w-3.5 inline mr-1" />
                              {account.ec_link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 20)}
                            </a>
                          ) : (
                            <span
                              className="text-muted-foreground/50 cursor-text hover:text-muted-foreground text-xs"
                              onClick={() => startEdit(account.id, 'ec_link', '')}
                            >
                              —
                            </span>
                          )}
                          <button
                            className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                            title="搜尋官網"
                            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(account.account_name + ' official website')}`, '_blank')}
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </button>
                          {account.ec_link && (
                            <span
                              className="text-muted-foreground/40 hover:text-muted-foreground cursor-text text-xs"
                              onClick={() => startEdit(account.id, 'ec_link', account.ec_link || '')}
                            >
                              ✎
                            </span>
                          )}
                        </div>
                      )}
                      </AiCellWrapper>
                    </TableCell>

                    {/* Industry */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <AiCellWrapper account={account} field="industry">
                      <Select
                        value={account.industry}
                        onValueChange={(v) => handleQuickUpdate(account.id, 'industry', v)}
                      >
                        <SelectTrigger className="h-7 w-24 border-none bg-transparent p-0 shadow-none focus:ring-0">
                          <span className="text-sm text-muted-foreground">{account.industry}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRY_OPTIONS.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      </AiCellWrapper>
                    </TableCell>

                    {/* PV(K) */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {renderEditableNumber(account, 'pv_k')}
                    </TableCell>

                    {/* Platform */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <AiCellWrapper account={account} field="platform">
                        {renderEditableText(account, 'platform')}
                      </AiCellWrapper>
                    </TableCell>

                    {/* Competitor */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isEditing(account.id, 'competitor') ? (
                        <Input
                          autoFocus
                          className="h-7 text-xs w-full"
                          placeholder="逗號分隔..."
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => {
                            const arr = editValue.split(',').map((s) => s.trim()).filter(Boolean);
                            updateAccount.mutate(
                              { id: account.id, competitor: arr } as any,
                              { onSuccess: () => toast.success('已更新'), onError: () => toast.error('更新失敗') }
                            );
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      ) : (
                        <div
                          className="flex gap-1 flex-wrap cursor-text hover:bg-muted/60 rounded px-1 -mx-1 py-0.5 min-h-[28px] transition-colors"
                          onClick={() => startEdit(account.id, 'competitor', (account.competitor ?? []).join(', '))}
                        >
                          {account.competitor?.length ? (
                            account.competitor.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* LINE好友數 */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {renderEditableNumber(account, 'line_friends' as any)}
                    </TableCell>

                    {/* PR吃到飽 */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <Select
                          value={account.interest_pr || '未評估'}
                          onValueChange={(v) => handleQuickUpdate(account.id, 'interest_pr', v)}
                        >
                          <SelectTrigger className="h-7 w-24 border-none bg-transparent p-0 shadow-none focus:ring-0">
                            <InterestBadge value={account.interest_pr} />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_INTEREST_OPTIONS.map((o) => (
                              <SelectItem key={o} value={o}><InterestBadge value={o} /></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderEditableText(account, 'notes_pr' as any, account.notes_pr || undefined)}
                      </div>
                    </TableCell>

                    {/* 客服機器人 */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <Select
                          value={account.interest_csbot || '未評估'}
                          onValueChange={(v) => handleQuickUpdate(account.id, 'interest_csbot', v)}
                        >
                          <SelectTrigger className="h-7 w-24 border-none bg-transparent p-0 shadow-none focus:ring-0">
                            <InterestBadge value={account.interest_csbot} />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_INTEREST_OPTIONS.map((o) => (
                              <SelectItem key={o} value={o}><InterestBadge value={o} /></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderEditableText(account, 'notes_csbot' as any, account.notes_csbot || undefined)}
                      </div>
                    </TableCell>

                    {/* Assigned */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isNoMeeting(account.meeting_status) ? (
                        <span className="text-sm text-muted-foreground">無需分配</span>
                      ) : (
                        <Select
                          value={account.assigned_to || '_unassigned'}
                          onValueChange={(v) => handleQuickUpdate(account.id, 'assigned_to', v === '_unassigned' ? '' : v)}
                        >
                          <SelectTrigger className="h-7 w-28 border-none bg-transparent p-0 shadow-none focus:ring-0">
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
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                      {accounts.length === 0 ? '尚無 Account，點擊右上角新增' : '沒有符合條件的 Account'}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </CardWrapper>

    </div>
  );
}

function CardWrapper({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card shadow-sm overflow-hidden">{children}</div>;
}

function InterestBadge({ value }: { value?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    '未評估': { label: '未評估', className: 'bg-muted text-muted-foreground' },
    '有興趣': { label: '有興趣', className: 'bg-green-100 text-green-700' },
    '考慮中': { label: '考慮中', className: 'bg-amber-100 text-amber-700' },
    '無興趣': { label: '無興趣', className: 'bg-red-100 text-red-600' },
  };
  const v = value || '未評估';
  const cfg = map[v] || map['未評估'];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
