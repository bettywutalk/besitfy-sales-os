import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { COUNTRY_OPTIONS } from '@/lib/constants';

interface CsvRow {
  [key: string]: string;
}

interface ImportResult {
  accountsCreated: number;
  accountsExisting: number;
  leadsCreated: number;
  leadsExisting: number;
}

const COLUMN_MAP: Record<string, string> = {
  '姓氏': 'last_name',
  '名字': 'first_name',
  '姓名': 'name',
  '職稱': 'title',
  '公司名稱': 'company',
  '手機號碼': 'phone',
  'email': 'email',
  '公司電話': 'company_phone',
  '其他需求': 'note',
  'utm_content': 'utm_content',
  'Last Name': 'last_name',
  'First Name': 'first_name',
  'Full Name': 'name',
  'Name': 'name',
  'Title': 'title',
  'Company': 'company',
  'Phone': 'phone',
  'Email': 'email',
};

/** Common Chinese compound surnames (複姓) */
const COMPOUND_SURNAMES = new Set([
  '歐陽', '司馬', '上官', '諸葛', '司徒', '皇甫', '令狐', '軒轅',
  '宇文', '慕容', '東方', '西門', '南宮', '公孫', '百里', '端木',
]);

/** Smart split: Chinese → first char surname + rest given; English → split by space */
function smartSplitName(fullName: string): { last_name: string; first_name: string } {
  const name = fullName.trim();
  if (!name) return { last_name: '', first_name: '' };

  // If contains space → split by last space (English-style: First Last or Last First)
  if (/\s/.test(name)) {
    const parts = name.split(/\s+/);
    // If all parts are CJK, treat first as surname
    const isCJK = /^[\u4e00-\u9fff\u3400-\u4dbf]+$/.test(parts.join(''));
    if (isCJK) {
      return { last_name: parts[0], first_name: parts.slice(1).join('') };
    }
    // English: assume "FirstName LastName" format
    return { last_name: parts[parts.length - 1], first_name: parts.slice(0, -1).join(' ') };
  }

  // Pure CJK string without spaces
  if (/^[\u4e00-\u9fff\u3400-\u4dbf]+$/.test(name)) {
    // Check compound surname
    const prefix2 = name.slice(0, 2);
    if (name.length > 2 && COMPOUND_SURNAMES.has(prefix2)) {
      return { last_name: prefix2, first_name: name.slice(2) };
    }
    // Single-char surname
    return { last_name: name.slice(0, 1), first_name: name.slice(1) };
  }

  // Fallback: put everything in last_name
  return { last_name: name, first_name: '' };
}

function mapRow(raw: CsvRow) {
  const mapped: Record<string, string> = {};
  for (const [csvCol, value] of Object.entries(raw)) {
    const key = COLUMN_MAP[csvCol.trim()] || csvCol.trim();
    mapped[key] = value?.trim() ?? '';
  }

  // Smart name splitting: if we have a combined name field but no separate first/last
  const hasFullName = mapped['name'] || mapped['姓名'] || mapped['full_name'] || mapped['fullname'];
  const hasLastName = mapped['last_name']?.trim();
  const hasFirstName = mapped['first_name']?.trim();

  if (hasFullName && !hasLastName && !hasFirstName) {
    const { last_name, first_name } = smartSplitName(hasFullName);
    mapped['last_name'] = last_name;
    mapped['first_name'] = first_name;
  }

  // Also try to split if last_name looks like a full name and first_name is empty
  if (hasLastName && !hasFirstName && hasLastName.length > 1) {
    const looksLikeFullName = /^[\u4e00-\u9fff\u3400-\u4dbf]{2,4}$/.test(hasLastName) ||
      /\s/.test(hasLastName);
    if (looksLikeFullName) {
      const { last_name, first_name } = smartSplitName(hasLastName);
      mapped['last_name'] = last_name;
      mapped['first_name'] = first_name;
    }
  }

  return mapped;
}

/** Extract domain from email: john@nike.com.tw → nike */
function extractDomainFromEmail(email: string): string {
  if (!email) return '';
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return '';
  const host = email.slice(atIdx + 1).toLowerCase(); // e.g. nike.com.tw
  const parts = host.split('.');
  // Remove TLD suffixes like com, co, org, net, tw, hk, sg, cn, etc.
  const tldSet = new Set(['com', 'co', 'org', 'net', 'tw', 'hk', 'sg', 'cn', 'jp', 'io', 'ai', 'uk', 'us', 'de', 'fr', 'kr']);
  const meaningful = parts.filter(p => !tldSet.has(p));
  return meaningful[0] || parts[0] || '';
}

/** Guess country from email domain TLD */
function guessCountryFromEmail(email: string): string {
  if (!email) return 'TW';
  const host = email.split('@')[1]?.toLowerCase() || '';
  if (host.endsWith('.tw')) return 'TW';
  if (host.endsWith('.hk')) return 'HK';
  if (host.endsWith('.cn')) return 'CN';
  if (host.endsWith('.sg')) return 'SG';
  if (host.endsWith('.jp')) return 'JP';
  return 'TW'; // default
}

/** Generate domain_key from domain + country */
function generateDomainKey(domain: string, country: string): string {
  if (!domain) return '';
  return `${domain.toLowerCase()} ${country}`;
}

async function getCurrentOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
  return data?.current_org_id ?? null;
}

const displayHeaders = ['last_name', 'first_name', 'title', 'company', 'email', 'phone', 'domain', 'country', 'domain_key'] as const;
const headerLabels: Record<string, string> = {
  last_name: '姓氏', first_name: '名字', title: '職稱',
  company: '公司', email: 'Email', phone: '電話',
  domain: '網域', country: '國碼', domain_key: 'UUID',
};

export function EventImport() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [eventTag, setEventTag] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  const processRawRows = useCallback((data: CsvRow[]) => {
    const mapped = data.map((raw) => {
      const r = mapRow(raw);
      if (!r.domain) r.domain = extractDomainFromEmail(r.email);
      if (!r.country) r.country = guessCountryFromEmail(r.email);
      r.domain_key = generateDomainKey(r.domain, r.country);
      return r;
    });
    setRows(mapped);
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const arrayBuffer = evt.target?.result;
          if (!arrayBuffer) {
            toast.error('檔案讀取失敗');
            return;
          }
          const data = new Uint8Array(arrayBuffer as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<CsvRow>(ws, { defval: '', raw: false });
          if (jsonData.length === 0) {
            toast.error('Excel 檔案中沒有找到資料');
            return;
          }
          processRawRows(jsonData);
        } catch (err) {
          console.error('Excel parse error:', err);
          toast.error('Excel 解析失敗，請確認檔案格式');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => processRawRows(res.data),
        error: () => toast.error('CSV 解析失敗，請確認檔案格式'),
      });
    }
  }, [processRawRows]);

  const updateCell = useCallback((rowIdx: number, col: string, value: string) => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [col]: value };
      // Recalculate domain_key when domain or country changes
      if (col === 'domain' || col === 'country') {
        updated[rowIdx].domain_key = generateDomainKey(updated[rowIdx].domain, updated[rowIdx].country);
      }
      return updated;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);

    try {
      const orgId = await getCurrentOrgId();
      if (!orgId) {
        toast.error('請先至首頁選擇公司');
        return;
      }

      const { data: existingAccounts } = await supabase
        .from('accounts')
        .select('id, account_name, domain_key')
        .eq('org_id', orgId);

      const accountMap = new Map<string, string>();
      (existingAccounts ?? []).forEach((a) => {
        accountMap.set(a.account_name.toLowerCase(), a.id);
        if (a.domain_key) accountMap.set(a.domain_key.toLowerCase(), a.id);
      });

      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, email')
        .eq('org_id', orgId);

      const existingEmails = new Set(
        (existingLeads ?? []).filter((l) => l.email).map((l) => l.email!.toLowerCase())
      );

      // Collect unique companies by domain_key or company name
      const companyEntries = new Map<string, { name: string; domain_key: string; country: string }>();
      for (const r of rows) {
        if (!r.company) continue;
        const key = r.domain_key?.toLowerCase() || r.company.toLowerCase();
        if (!companyEntries.has(key)) {
          companyEntries.set(key, { name: r.company, domain_key: r.domain_key || '', country: r.country || 'TW' });
        }
      }

      const newCompanies: { name: string; domain_key: string; country: string }[] = [];
      for (const [key, entry] of companyEntries) {
        if (!accountMap.has(key) && !accountMap.has(entry.name.toLowerCase())) {
          newCompanies.push(entry);
        }
      }

      let accountsCreated = 0;
      if (newCompanies.length > 0) {
        const toInsert = newCompanies.map((c) => ({
          org_id: orgId,
          account_name: c.name,
          domain_key: c.domain_key || null,
          country: c.country,
        }));
        const { data: inserted, error } = await supabase
          .from('accounts')
          .insert(toInsert)
          .select('id, account_name, domain_key');
        if (error) throw error;
        (inserted ?? []).forEach((a) => {
          accountMap.set(a.account_name.toLowerCase(), a.id);
          if (a.domain_key) accountMap.set(a.domain_key.toLowerCase(), a.id);
        });
        accountsCreated = inserted?.length ?? 0;
      }

      const newLeadRows = rows.filter((r) => {
        if (!r.email) return true;
        return !existingEmails.has(r.email.toLowerCase());
      });

      let leadsCreated = 0;
      if (newLeadRows.length > 0) {
        const toInsert = newLeadRows.map((r) => {
          const accountKey = r.domain_key?.toLowerCase() || r.company?.toLowerCase() || '';
          return {
            org_id: orgId,
            first_name: r.first_name || '(未填)',
            last_name: r.last_name || '(未填)',
            title: r.title || null,
            email: r.email || null,
            phone: r.phone || null,
            note: [r.note, r.utm_content ? `來源: ${r.utm_content}` : ''].filter(Boolean).join(' | ') || null,
            account_id: accountKey ? (accountMap.get(accountKey) ?? null) : null,
            tags: [eventTag || 'event-import'].filter(Boolean),
          };
        });
        const { error } = await supabase.from('leads').insert(toInsert);
        if (error) throw error;
        leadsCreated = toInsert.length;
      }

      const importResult: ImportResult = {
        accountsCreated,
        accountsExisting: companyEntries.size - accountsCreated,
        leadsCreated,
        leadsExisting: rows.length - newLeadRows.length,
      };
      setResult(importResult);
      toast.success(`匯入完成：新增 ${accountsCreated} 家公司、${leadsCreated} 筆 Lead`);
    } catch (err: any) {
      toast.error(err.message || '匯入失敗');
    } finally {
      setImporting(false);
    }
  }, [rows, eventTag]);

  const editableColumns = new Set(['last_name', 'first_name', 'title', 'company', 'email', 'phone', 'domain', 'country']);

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardContent className="pt-6">
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted-foreground/25 rounded-xl py-12 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Upload className="h-10 w-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">拖曳或點擊上傳 Event 名單</p>
              <p className="text-xs text-muted-foreground mt-1">支援 .csv / .xlsx 格式</p>
            </div>
            {fileName && (
              <Badge variant="secondary" className="gap-1.5">
                <FileSpreadsheet className="h-3 w-3" />
                {fileName}
              </Badge>
            )}
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
          {fileName && (
            <div className="mt-4">
              <label className="text-sm font-medium text-foreground">活動標籤</label>
              <Input
                placeholder="例如：領袖晚宴_24Q3"
                value={eventTag}
                onChange={(e) => setEventTag(e.target.value)}
                className="mt-1.5 max-w-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">匯入的 Lead 都會貼上此標籤，方便日後篩選</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result Summary */}
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-sm">匯入完成</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted-foreground">
                  <span>新增公司：{result.accountsCreated} 家</span>
                  <span>已存在公司：{result.accountsExisting} 家</span>
                  <span>新增 Lead：{result.leadsCreated} 筆</span>
                  <span>重複 Lead（跳過）：{result.leadsExisting} 筆</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base">預覽 · {rows.length} 筆資料</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                <Pencil className="h-3 w-3 inline mr-1" />
                點擊欄位可直接編輯，UUID 由網域+國碼自動產生
              </p>
            </div>
            <Button onClick={handleImport} disabled={importing || !!result} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? '匯入中...' : result ? '已匯入' : '開始匯入'}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    {displayHeaders.map((h) => (
                      <TableHead key={h}>{headerLabels[h] || h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center text-muted-foreground text-xs">{i + 1}</TableCell>
                      {displayHeaders.map((h) => {
                        const isEditing = editingCell?.row === i && editingCell?.col === h;
                        const isEditable = editableColumns.has(h);
                        const isUUID = h === 'domain_key';

                        if (isUUID) {
                          return (
                            <TableCell key={h} className="text-xs font-mono text-muted-foreground">
                              {row[h] || '—'}
                            </TableCell>
                          );
                        }

                        if (h === 'country' && isEditing) {
                          return (
                            <TableCell key={h}>
                              <Select
                                value={row[h] || 'TW'}
                                onValueChange={(v) => {
                                  updateCell(i, h, v);
                                  setEditingCell(null);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_OPTIONS.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          );
                        }

                        if (isEditing && isEditable) {
                          return (
                            <TableCell key={h}>
                              <Input
                                autoFocus
                                className="h-7 text-xs w-full min-w-[60px]"
                                defaultValue={row[h] || ''}
                                onBlur={(e) => {
                                  updateCell(i, h, e.target.value);
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateCell(i, h, (e.target as HTMLInputElement).value);
                                    setEditingCell(null);
                                  }
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              />
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell
                            key={h}
                            className={`text-sm ${isEditable ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                            onClick={() => isEditable && setEditingCell({ row: i, col: h })}
                          >
                            {row[h] || '—'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {rows.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={displayHeaders.length + 1} className="text-center text-muted-foreground text-sm py-4">
                        ⋯ 還有 {rows.length - 50} 筆資料
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
