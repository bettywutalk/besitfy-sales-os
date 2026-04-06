import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAccounts, useCreateAccount } from '@/hooks/use-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, TrendingUp, FileText, Search, Loader2, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// Industries for Besitfy (大健康)
const BESITFY_INDUSTRIES = [
  '醫美-整形外科', '醫美-皮膚科', '醫美-牙科', '醫美-產後中心',
  '醫美-眼科', '醫美-婦產科', '醫美-中醫', '醫美-小兒科',
  '醫美-骨科', '醫美-復健科', '醫美-耳鼻喉科', '醫美-家醫科',
  '醫美-身心科', '醫美-泌尿科', '醫美-減重門診',
  '健康-健身房', '健康-瑜伽教室', '健康-營養品', '健康-保健食品',
  '健康-藥局', '健康-長照中心', '健康-心理諮商', '健康-寵物醫院',
];

// Open industries for Insider
const INSIDER_INDUSTRIES = [
  'E-commerce', 'Retail', 'Travel', 'Finance', 'Telecom',
  'Media', 'Gaming', 'Education', 'F&B', 'Fashion',
  'Automotive', 'Real Estate', 'Insurance', 'Healthcare', 'Other',
];

const REGIONS = [
  '台北市', '新北市', '桃園市', '台中市', '台南市',
  '高雄市', '新竹市', '新竹縣', '基隆市', '嘉義市',
  '彰化縣', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣',
];

type ScraperResult = {
  company_name: string;
  website?: string;
  industry?: string;
  description?: string;
  region?: string;
  phone?: string;
  email?: string;
  extra_data?: Record<string, unknown>;
  selected?: boolean;
  enriched?: boolean;
  enriching?: boolean;
};

async function getCurrentOrgInfo() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_org_id')
    .eq('id', user.id)
    .single();
  if (!profile?.current_org_id) return null;
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', profile.current_org_id)
    .single();
  return org;
}

export default function Scraper() {
  const location = useLocation();
  const [tab, setTab] = useState('settings');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [keywords, setKeywords] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ScraperResult[]>([]);
  const [orgType, setOrgType] = useState<'besitfy' | 'insider' | null>(null);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();
  const createAccount = useCreateAccount();

  useEffect(() => {
    getCurrentOrgInfo().then(org => {
      if (!org) return;
      const name = org.name.toLowerCase();
      if (name.includes('besitfy') || name.includes('bestify')) {
        setOrgType('besitfy');
      } else {
        setOrgType('insider');
      }
      setIndustry('');
    });
  }, [location.key]);

  const industries = orgType === 'besitfy' ? BESITFY_INDUSTRIES : INSIDER_INDUSTRIES;

  const handleSearch = useCallback(async () => {
    if (!industry && !keywords) {
      toast.error('請選擇產業或輸入關鍵字');
      return;
    }
    setSearching(true);
    setTab('progress');
    try {
      const { data, error } = await supabase.functions.invoke('scraper-search', {
        body: { industry, region, keywords, org_type: orgType },
      });
      if (error) throw error;
      const companies = (data?.companies || []).map((c: any) => ({
        ...c,
        selected: false,
        enriched: false,
      }));
      setResults(companies);
      setTab('results');
      toast.success(`找到 ${companies.length} 間公司`);
    } catch (err: any) {
      console.error(err);
      toast.error('搜尋失敗：' + (err.message || '未知錯誤'));
      setTab('settings');
    } finally {
      setSearching(false);
    }
  }, [industry, region, keywords, orgType]);

  const handleEnrich = useCallback(async (indices: number[]) => {
    const toEnrich = indices.map(i => ({
      index: i,
      url: results[i]?.website,
    })).filter(s => s.url);

    if (toEnrich.length === 0) {
      toast.error('請選擇有網站的公司');
      return;
    }

    // Mark as enriching
    setResults(prev => prev.map((r, i) =>
      indices.includes(i) ? { ...r, enriching: true } : r
    ));

    try {
      const { data, error } = await supabase.functions.invoke('scraper-enrich', {
        body: { websites: toEnrich, org_type: orgType },
      });
      if (error) throw error;

      setResults(prev => prev.map((r, i) => {
        const enriched = data?.results?.find((e: any) => e.original_index === i);
        if (!enriched) return { ...r, enriching: false };
        return {
          ...r,
          enriching: false,
          enriched: true,
          description: enriched.description || r.description,
          industry: enriched.industry || r.industry,
          phone: enriched.phone || r.phone,
          email: enriched.email || r.email,
          extra_data: {
            ...r.extra_data,
            ...(enriched.line_followers ? { line_followers: enriched.line_followers } : {}),
            ...(enriched.line_id ? { line_id: enriched.line_id } : {}),
            ...(enriched.monthly_traffic ? { monthly_traffic: enriched.monthly_traffic } : {}),
            ...(enriched.tech_stack ? { tech_stack: enriched.tech_stack } : {}),
          },
        };
      }));
      toast.success('已完成資料補充');
    } catch (err: any) {
      toast.error('補充失敗：' + (err.message || ''));
      setResults(prev => prev.map((r, i) =>
        indices.includes(i) ? { ...r, enriching: false } : r
      ));
    }
  }, [results, orgType]);

  const handleImport = useCallback(async () => {
    const selected = results.filter(r => r.selected);
    if (selected.length === 0) {
      toast.error('請勾選要匯入的公司');
      return;
    }
    setImporting(true);
    const org = await getCurrentOrgInfo();
    if (!org) {
      toast.error('無法取得組織資訊');
      setImporting(false);
      return;
    }

    let success = 0;
    for (const company of selected) {
      try {
        await createAccount.mutateAsync({
          org_id: org.id,
          account_name: company.company_name,
          country: 'TW',
          industry: company.industry || 'Other',
          ec_link: company.website || null,
          metadata: company.extra_data || {},
          customer_status: 'New',
          meeting_status: '尚未開發',
          meeting_stage: '還沒接觸',
        } as any);
        success++;
      } catch (err) {
        console.error('Import failed for', company.company_name, err);
      }
    }

    toast.success(`已匯入 ${success} / ${selected.length} 間公司`);
    setResults(prev => prev.map(r => r.selected ? { ...r, selected: false } : r));
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    setImporting(false);
  }, [results, createAccount, queryClient]);

  const toggleSelect = (index: number) => {
    setResults(prev => prev.map((r, i) =>
      i === index ? { ...r, selected: !r.selected } : r
    ));
  };

  const toggleAll = () => {
    const allSelected = results.every(r => r.selected);
    setResults(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const selectedCount = results.filter(r => r.selected).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">名單爬取工具</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" /> 設定
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2">
            <TrendingUp className="h-4 w-4" /> 進度
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <FileText className="h-4 w-4" /> 結果
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>目標設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">產業</label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇產業..." />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map(ind => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">地區</label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇地區..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">額外關鍵字</label>
                <Input
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="輸入關鍵字後按 Enter..."
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSearch} disabled={searching} className="w-full" size="lg">
            {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            開始爬取
          </Button>
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardContent className="py-12 text-center">
              {searching ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <p className="text-lg font-medium">正在搜尋 {industry || '所有產業'} 的公司...</p>
                  <p className="text-sm text-muted-foreground">
                    {region ? `地區：${region}` : '不限地區'}
                    {keywords ? ` · 關鍵字：${keywords}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">尚未開始搜尋</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={results.length > 0 && results.every(r => r.selected)}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedCount > 0 ? `已選 ${selectedCount} 間` : `共 ${results.length} 間公司`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const indices = results
                        .map((r, i) => r.selected && r.website ? i : -1)
                        .filter(i => i >= 0);
                      handleEnrich(indices);
                    }}
                    disabled={selectedCount === 0}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    補充資料
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={selectedCount === 0 || importing}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                    匯入 Accounts ({selectedCount})
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {results.map((r, i) => (
                  <Card key={i} className={r.selected ? 'ring-2 ring-primary' : ''}>
                    <CardContent className="py-3 flex items-start gap-3">
                      <Checkbox
                        checked={r.selected}
                        onCheckedChange={() => toggleSelect(i)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{r.company_name}</span>
                          {r.industry && <Badge variant="outline">{r.industry}</Badge>}
                          {r.enriched && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">已補充</Badge>}
                          {r.enriching && <Loader2 className="h-3 w-3 animate-spin" />}
                        </div>
                        {r.website && (
                          <a href={r.website} target="_blank" rel="noopener" className="text-xs text-primary hover:underline truncate block">
                            {r.website}
                          </a>
                        )}
                        {(r.phone || r.email) && (
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            {r.phone && <span>📞 {r.phone}</span>}
                            {r.email && <a href={`mailto:${r.email}`} className="text-primary hover:underline">✉️ {r.email}</a>}
                          </div>
                        )}
                        {r.description && (
                          <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                        )}
                        {r.extra_data && Object.keys(r.extra_data).length > 0 && (
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {Object.entries(r.extra_data).map(([k, v]) => (
                              v != null && <Badge key={k} variant="secondary" className="text-xs">
                                {k}: {String(v)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {results.length === 0 && !searching && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                尚無搜尋結果，請先到「設定」頁籤進行搜尋
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
