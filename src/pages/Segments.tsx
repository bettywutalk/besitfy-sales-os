import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Filter, Download, Tag, Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useLeads } from '@/hooks/use-data';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import type { FilterRule, Lead } from '@/types';
import {
  MEETING_STATUS_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  YAMM_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  INDUSTRY_OPTIONS,
  COUNTRY_OPTIONS,
} from '@/types';

// Field definitions with value options
const FILTER_FIELDS: { value: string; label: string; options?: readonly string[] | string[] }[] = [
  { value: 'meeting_status', label: 'Meeting Status', options: MEETING_STATUS_OPTIONS },
  { value: 'customer_status', label: 'Customer Status', options: CUSTOMER_STATUS_OPTIONS },
  { value: 'country', label: 'Country', options: [...COUNTRY_OPTIONS] },
  { value: 'industry', label: 'Industry', options: [...INDUSTRY_OPTIONS] },
  { value: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
  
  { value: 'is_manager', label: 'Is Manager', options: ['true', 'false'] },
  { value: 'is_foreigner', label: 'Is Foreigner', options: ['true', 'false'] },
  { value: 'linkedin_engaged', label: 'LinkedIn Engaged', options: ['true', 'false'] },
  { value: 'email_status', label: 'Email Status', options: ['valid', 'bounced', 'unknown'] },
  { value: 'tags', label: 'Tags' },
  { value: 'title', label: '職稱' },
  { value: 'platform', label: 'Platform' },
  { value: 'brand', label: 'Brand' },
  { value: 'lead_source_status', label: 'Lead Source' },
];

const OPERATORS = [
  { value: 'equals', label: '等於' },
  { value: 'not_equals', label: '不等於' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'is_empty', label: '為空' },
  { value: 'is_not_empty', label: '不為空' },
];

/** Map filter field to the actual Lead property (some come from joined account) */
function getLeadValue(lead: Lead, field: string): string | boolean | string[] | undefined {
  switch (field) {
    case 'meeting_status': return lead.account_meeting_status;
    case 'customer_status': return lead.account_customer_status;
    case 'country': return lead.account_country;
    case 'industry': return lead.account_industry;
    case 'platform': return (lead as any).platform; // from account
    case 'brand': return (lead as any).brand;
    default: return (lead as any)[field];
  }
}

function matchesRule(lead: Lead, rule: FilterRule): boolean {
  const raw = getLeadValue(lead, rule.field);
  const val = Array.isArray(raw) ? raw.join(',') : String(raw ?? '');
  const ruleVal = typeof rule.value === 'string' ? rule.value : (rule.value as string[]).join(',');

  switch (rule.operator) {
    case 'equals': return val.toLowerCase() === ruleVal.toLowerCase();
    case 'not_equals': return val.toLowerCase() !== ruleVal.toLowerCase();
    case 'contains': return val.toLowerCase().includes(ruleVal.toLowerCase());
    case 'not_contains': return !val.toLowerCase().includes(ruleVal.toLowerCase());
    case 'is_empty': return !val || val === 'undefined' || val === 'null';
    case 'is_not_empty': return !!val && val !== 'undefined' && val !== 'null';
    default: return true;
  }
}

function applyFilters(leads: Lead[], rules: FilterRule[]): Lead[] {
  if (rules.length === 0) return leads;
  return leads.filter((lead) => {
    let result = matchesRule(lead, rules[0]);
    for (let i = 1; i < rules.length; i++) {
      const match = matchesRule(lead, rules[i]);
      if (rules[i].conjunction === 'AND') result = result && match;
      else result = result || match;
    }
    return result;
  });
}

export default function Segments() {
  const { data: leads = [], isLoading } = useLeads();
  const [rules, setRules] = useState<FilterRule[]>([
    { field: 'meeting_status', operator: 'equals', value: '', conjunction: 'AND' },
  ]);
  const [exportTag, setExportTag] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [tagging, setTagging] = useState(false);

  const filtered = useMemo(() => applyFilters(leads, rules), [leads, rules]);

  const addRule = () => {
    setRules([...rules, { field: 'country', operator: 'equals', value: '', conjunction: 'AND' }]);
  };
  const removeRule = (index: number) => setRules(rules.filter((_, i) => i !== index));
  const updateRule = (index: number, updates: Partial<FilterRule>) => {
    setRules(rules.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const getFieldDef = (fieldValue: string) => FILTER_FIELDS.find((f) => f.value === fieldValue);

  /** Build export data rows */
  const buildExportData = (tag: string) => {
    const headers = ['Email Address', 'First Name', 'Last Name', 'Title', 'Company', 'Phone', 'Tags'];
    const dataRows = filtered.map((l) => [
      l.email ?? '',
      l.first_name,
      l.last_name,
      l.title ?? '',
      l.account_name ?? '',
      l.phone ?? '',
      [...(l.tags ?? []), tag].filter((v, i, a) => a.indexOf(v) === i).join('; '),
    ]);
    return { headers, dataRows };
  };

  const downloadFile = (tag: string) => {
    const { headers, dataRows } = buildExportData(tag);
    const dateStr = new Date().toISOString().slice(0, 10);

    if (exportFormat === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      // Auto-width columns
      ws['!cols'] = headers.map((_, i) => ({
        wch: Math.max(
          headers[i].length,
          ...dataRows.map((r) => String(r[i]).length)
        ) + 2,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      XLSX.writeFile(wb, `segment_${tag}_${dateStr}.xlsx`);
    } else {
      const csvRows = [
        headers.join(','),
        ...dataRows.map((row) =>
          row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
        ),
      ];
      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segment_${tag}_${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /** Export filtered leads + auto-tag */
  const handleExport = useCallback(async () => {
    if (filtered.length === 0) {
      toast.error('沒有符合條件的受眾');
      return;
    }
    const tag = exportTag.trim();
    if (!tag) {
      toast.error('請輸入匯出標籤');
      return;
    }

    // 1. Auto-tag all filtered leads
    setTagging(true);
    try {
      const updates = filtered.map((lead) => {
        const existingTags = lead.tags ?? [];
        if (existingTags.includes(tag)) return null;
        return supabase
          .from('leads')
          .update({ tags: [...existingTags, tag] })
          .eq('id', lead.id);
      }).filter(Boolean);

      if (updates.length > 0) {
        await Promise.all(updates);
      }
      toast.success(`已為 ${updates.length} 筆 Lead 貼上「${tag}」標籤`);
    } catch {
      toast.error('貼標失敗');
    } finally {
      setTagging(false);
    }

    // 2. Download file
    downloadFile(tag);
  }, [filtered, exportTag, exportFormat]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Segments</h1>
        <p className="text-muted-foreground text-sm mt-1">篩選受眾 → 匯出名單 → 自動貼標</p>
      </div>

      {/* Rule Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />篩選條件
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map((rule, index) => {
            const fieldDef = getFieldDef(rule.field);
            const hasOptions = fieldDef?.options && fieldDef.options.length > 0;
            const noValueNeeded = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
            return (
              <div key={index} className="flex items-center gap-2 flex-wrap">
                {index > 0 ? (
                  <Select value={rule.conjunction} onValueChange={(v) => updateRule(index, { conjunction: v as 'AND' | 'OR' })}>
                    <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="w-20 shrink-0 text-sm text-muted-foreground text-center">WHERE</div>
                )}
                <Select value={rule.field} onValueChange={(v) => updateRule(index, { field: v, value: '' })}>
                  <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILTER_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={rule.operator} onValueChange={(v) => updateRule(index, { operator: v as FilterRule['operator'] })}>
                  <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!noValueNeeded && (
                  hasOptions ? (
                    <Select value={typeof rule.value === 'string' ? rule.value : ''} onValueChange={(v) => updateRule(index, { value: v })}>
                      <SelectTrigger className="h-9 w-44"><SelectValue placeholder="選擇值..." /></SelectTrigger>
                      <SelectContent>
                        {fieldDef!.options!.map((o) => <SelectItem key={String(o)} value={String(o)}>{String(o)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={typeof rule.value === 'string' ? rule.value : ''}
                      onChange={(e) => updateRule(index, { value: e.target.value })}
                      placeholder="輸入值..."
                      className="h-9 w-44"
                    />
                  )
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeRule(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addRule} className="gap-2">
            <Plus className="h-4 w-4" />新增條件
          </Button>
        </CardContent>
      </Card>

      {/* Results Summary + Export */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm">
              符合條件：
              {isLoading ? (
                <Skeleton className="inline-block h-5 w-10" />
              ) : (
                <span className="font-bold text-lg text-primary">{filtered.length}</span>
              )}
              <span className="text-muted-foreground ml-1">筆 Lead</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="匯出標籤（如：YAMM_24Q4）"
                  value={exportTag}
                  onChange={(e) => setExportTag(e.target.value)}
                  className="h-9 w-56"
                />
              </div>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'xlsx')}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />CSV</span>
                  </SelectItem>
                  <SelectItem value="xlsx">
                    <span className="flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExport} disabled={tagging || filtered.length === 0 || !exportTag.trim()} className="gap-2">
                {tagging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {tagging ? '貼標中...' : `匯出 ${exportFormat.toUpperCase()} + 貼標`}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            匯出時會自動幫所有受眾貼上標籤，並下載 YAMM 格式檔案（含 Email Address、First Name、Last Name 等欄位）
          </p>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {!isLoading && filtered.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">受眾預覽（前 50 筆）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>姓氏</TableHead>
                    <TableHead>名字</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>職稱</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 50).map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium">{l.last_name}</TableCell>
                      <TableCell>{l.first_name}</TableCell>
                      <TableCell className="text-sm">{l.email ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.title ?? '—'}</TableCell>
                      <TableCell className="text-sm">{l.account_name ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {l.tags?.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                          {(l.tags?.length ?? 0) > 3 && <span className="text-xs text-muted-foreground">+{(l.tags?.length ?? 0) - 3}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-4">
                        ⋯ 還有 {filtered.length - 50} 筆
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
