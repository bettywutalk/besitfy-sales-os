import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useOrgMembers, useCurrentUserRole } from '@/hooks/use-data';
import { toast } from 'sonner';
import { Plus, Target, TrendingUp, Wallet, Clock, Pencil, Check } from 'lucide-react';
import { useAccounts } from '@/hooks/use-data';

interface CommissionProduct {
  id: string;
  name: string;
  commission_rate: number | null;
  base_bonus: number | null;
  is_variable: boolean;
  notes: string | null;
}

interface Deal {
  id: string;
  account_id: string | null;
  product_id: string | null;
  sales_rep_id: string;
  contract_amount_tax: number | null;
  contract_amount: number | null;
  bonus_amount: number;
  status: 'paid' | 'unpaid';
  signed_at: string;
  notes: string | null;
  created_at: string;
  // joined
  product_name?: string;
  account_name?: string;
  rep_name?: string;
}

interface BonusTarget {
  id: string;
  user_id: string;
  target_amount: number;
  year: number;
}

const currentYear = new Date().getFullYear();

export default function BonusDashboard() {
  const { data: members = [] } = useOrgMembers();
  const { data: accounts = [] } = useAccounts();
  const { data: userRole } = useCurrentUserRole();
  const isManager = userRole === 'admin' || userRole === 'sales_manager';

  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [products, setProducts] = useState<CommissionProduct[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [myTarget, setMyTarget] = useState<BonusTarget | null>(null);
  const [viewRep, setViewRep] = useState<string>('me');
  const [loading, setLoading] = useState(true);

  // New deal form
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [dealProduct, setDealProduct] = useState('');
  const [dealAccount, setDealAccount] = useState('');
  const [dealContractTax, setDealContractTax] = useState('');
  const [dealContractNet, setDealContractNet] = useState('');
  const [dealBonus, setDealBonus] = useState('');
  const [dealDate, setDealDate] = useState(new Date().toISOString().split('T')[0]);
  const [dealNotes, setDealNotes] = useState('');
  const [addingDeal, setAddingDeal] = useState(false);

  // Target editing
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  // Product management
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodRate, setProdRate] = useState('');
  const [prodBonus, setProdBonus] = useState('');
  const [prodVariable, setProdVariable] = useState(false);
  const [prodNotes, setProdNotes] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const member = (members as any[]).find((m: any) => m.user_id === user.id);
      setCurrentUser({ id: user.id, name: member?.full_name || user.email || '我' });
    }
    if (members.length > 0) init();
  }, [members]);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
    const orgId = profile?.current_org_id;
    if (!orgId) return;

    const [{ data: prods }, { data: dealData }, { data: targetData }] = await Promise.all([
      supabase.from('commission_products').select('*').eq('org_id', orgId).order('name'),
      supabase.from('deals').select('*').eq('org_id', orgId).order('signed_at', { ascending: false }),
      supabase.from('bonus_targets').select('*').eq('org_id', orgId).eq('user_id', user.id).eq('year', currentYear).maybeSingle(),
    ]);

    setProducts(prods ?? []);
    setMyTarget(targetData ?? null);
    setTargetInput(String(targetData?.target_amount ?? ''));

    // Enrich deals
    const enriched: Deal[] = (dealData ?? []).map((d: any) => ({
      ...d,
      product_name: (prods ?? []).find((p: any) => p.id === d.product_id)?.name,
      account_name: accounts.find(a => a.id === d.account_id)?.account_name,
      rep_name: (members as any[]).find((m: any) => m.user_id === d.sales_rep_id)?.full_name || d.sales_rep_id,
    }));
    setDeals(enriched);
    setLoading(false);
  }

  const getMemberName = (userId: string) => {
    const m = (members as any[]).find((m: any) => m.user_id === userId);
    return m?.full_name || userId;
  };

  // Which deals to show
  const visibleDeals = useMemo(() => {
    if (!currentUser) return [];
    if (isManager && viewRep !== 'me') {
      if (viewRep === 'all') return deals;
      return deals.filter(d => d.sales_rep_id === viewRep);
    }
    return deals.filter(d => d.sales_rep_id === currentUser.id);
  }, [deals, currentUser, viewRep, isManager]);

  const stats = useMemo(() => {
    const achieved = visibleDeals.reduce((s, d) => s + d.bonus_amount, 0);
    const paid = visibleDeals.filter(d => d.status === 'paid').reduce((s, d) => s + d.bonus_amount, 0);
    const unpaid = visibleDeals.filter(d => d.status === 'unpaid').reduce((s, d) => s + d.bonus_amount, 0);
    return { achieved, paid, unpaid };
  }, [visibleDeals]);

  const targetAmount = myTarget?.target_amount ?? 0;
  const progress = targetAmount > 0 ? Math.min(Math.round((stats.achieved / targetAmount) * 100), 100) : 0;

  // Auto-calc bonus when product changes
  function handleProductChange(productId: string) {
    setDealProduct(productId);
    const prod = products.find(p => p.id === productId);
    if (prod && !prod.is_variable && prod.base_bonus) {
      setDealBonus(String(prod.base_bonus));
    } else {
      setDealBonus('');
    }
  }

  // Auto-calc bonus from contract amount for variable products
  function handleContractNetChange(val: string) {
    setDealContractNet(val);
    const prod = products.find(p => p.id === dealProduct);
    if (prod?.is_variable && prod.commission_rate && val) {
      const bonus = Math.round(parseFloat(val) * prod.commission_rate);
      if (!isNaN(bonus)) setDealBonus(String(bonus));
    }
  }

  async function handleSaveTarget() {
    if (!currentUser) return;
    const amount = parseFloat(targetInput);
    if (isNaN(amount) || amount <= 0) { toast.error('請輸入有效金額'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
    const orgId = profile?.current_org_id;
    const { data, error } = await supabase.from('bonus_targets').upsert({
      org_id: orgId,
      user_id: user.id,
      target_amount: amount,
      year: currentYear,
      ...(myTarget ? { id: myTarget.id } : {}),
    }, { onConflict: 'org_id,user_id,year' }).select().single();
    if (error) { toast.error('儲存失敗'); return; }
    setMyTarget(data);
    setEditingTarget(false);
    toast.success('目標已儲存');
  }

  async function handleAddDeal() {
    if (!dealProduct || !dealBonus || !dealDate) { toast.error('請填寫必要欄位'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
    const orgId = profile?.current_org_id;
    setAddingDeal(true);
    const { error } = await supabase.from('deals').insert({
      org_id: orgId,
      account_id: dealAccount || null,
      product_id: dealProduct,
      sales_rep_id: user.id,
      contract_amount_tax: dealContractTax ? parseFloat(dealContractTax) : null,
      contract_amount: dealContractNet ? parseFloat(dealContractNet) : null,
      bonus_amount: parseFloat(dealBonus),
      signed_at: dealDate,
      notes: dealNotes || null,
    });
    setAddingDeal(false);
    if (error) { toast.error('新增失敗：' + error.message); return; }
    toast.success('成交紀錄已新增');
    setShowAddDeal(false);
    setDealProduct(''); setDealAccount(''); setDealContractTax(''); setDealContractNet(''); setDealBonus(''); setDealNotes('');
    loadData();
  }

  async function handleMarkPaid(dealId: string, currentStatus: string) {
    if (!isManager) return;
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    const { error } = await supabase.from('deals').update({ status: newStatus }).eq('id', dealId);
    if (error) { toast.error('更新失敗'); return; }
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: newStatus as 'paid' | 'unpaid' } : d));
    toast.success(newStatus === 'paid' ? '已標記為撥款' : '已標記為未撥款');
  }

  async function handleAddProduct() {
    if (!prodName) { toast.error('請輸入產品名稱'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
    const { error } = await supabase.from('commission_products').insert({
      org_id: profile?.current_org_id,
      name: prodName,
      commission_rate: prodRate ? parseFloat(prodRate) / 100 : null,
      base_bonus: prodBonus ? parseFloat(prodBonus) : null,
      is_variable: prodVariable,
      notes: prodNotes || null,
    });
    if (error) { toast.error('新增失敗'); return; }
    toast.success('產品已新增');
    setShowAddProduct(false);
    setProdName(''); setProdRate(''); setProdBonus(''); setProdVariable(false); setProdNotes('');
    loadData();
  }

  const fmt = (n: number) => n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">獎金 Dashboard</h1>
          <p className="text-sm text-muted-foreground">{currentYear} 年度業績獎金追蹤</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Select value={viewRep} onValueChange={setViewRep}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">我的獎金</SelectItem>
                <SelectItem value="all">全部業務</SelectItem>
                {(members as any[]).map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />新增成交</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>新增成交紀錄</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>產品 *</Label>
                  <Select value={dealProduct} onValueChange={handleProductChange}>
                    <SelectTrigger><SelectValue placeholder="選擇產品" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>客戶 Account</Label>
                  <Select value={dealAccount} onValueChange={setDealAccount}>
                    <SelectTrigger><SelectValue placeholder="選擇客戶（選填）" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>合約金額（含稅）</Label>
                    <Input placeholder="e.g. 118800" value={dealContractTax} onChange={e => setDealContractTax(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>合約金額（扣稅）</Label>
                    <Input placeholder="e.g. 112860" value={dealContractNet} onChange={e => handleContractNetChange(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>獎金金額 *</Label>
                  <Input placeholder="自動計算或手動輸入" value={dealBonus} onChange={e => setDealBonus(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>簽約日期 *</Label>
                  <Input type="date" value={dealDate} onChange={e => setDealDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>備註</Label>
                  <Textarea placeholder="其他備註..." value={dealNotes} onChange={e => setDealNotes(e.target.value)} rows={2} />
                </div>
                <Button className="w-full" onClick={handleAddDeal} disabled={addingDeal}>
                  {addingDeal ? '新增中...' : '新增'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* My target + stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Target card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Target className="h-4 w-4" /> 年度目標
              </div>
              {viewRep === 'me' || !isManager ? (
                <button onClick={() => setEditingTarget(true)} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {editingTarget ? (
              <div className="flex gap-1 mt-1">
                <Input className="h-8 text-sm" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="輸入目標金額" autoFocus />
                <Button size="sm" className="h-8 px-2" onClick={handleSaveTarget}><Check className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <div className="text-2xl font-bold mt-1">{targetAmount > 0 ? fmt(targetAmount) : '—'}</div>
            )}
            {targetAmount > 0 && !editingTarget && (
              <div className="mt-2 space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{progress}% 達成</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> 已達成獎金
            </div>
            <div className="text-2xl font-bold text-foreground">{fmt(stats.achieved)}</div>
            <p className="text-xs text-muted-foreground mt-1">{visibleDeals.length} 筆成交</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" /> 已撥款
            </div>
            <div className="text-2xl font-bold text-green-600">{fmt(stats.paid)}</div>
            <p className="text-xs text-muted-foreground mt-1">{visibleDeals.filter(d => d.status === 'paid').length} 筆</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" /> 待撥款
            </div>
            <div className="text-2xl font-bold text-amber-600">{fmt(stats.unpaid)}</div>
            <p className="text-xs text-muted-foreground mt-1">{visibleDeals.filter(d => d.status === 'unpaid').length} 筆</p>
          </CardContent>
        </Card>
      </div>

      {/* Deals table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">成交紀錄</CardTitle>
          {isManager && (
            <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" />管理產品</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>新增產品分潤設定</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label>產品名稱 *</Label>
                    <Input placeholder="e.g. 好廣告" value={prodName} onChange={e => setProdName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>分潤比例 (%)</Label>
                      <Input placeholder="e.g. 15" value={prodRate} onChange={e => setProdRate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>簽約獎金/單</Label>
                      <Input placeholder="e.g. 12825" value={prodBonus} onChange={e => setProdBonus(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="variable" checked={prodVariable} onChange={e => setProdVariable(e.target.checked)} />
                    <Label htmlFor="variable">金額不固定（依合約計算）</Label>
                  </div>
                  <div className="space-y-1">
                    <Label>備註</Label>
                    <Input placeholder="備註..." value={prodNotes} onChange={e => setProdNotes(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleAddProduct}>新增產品</Button>
                </div>
                {products.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-sm font-medium">現有產品</p>
                    {products.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">
                          {p.commission_rate ? `${Math.round(p.commission_rate * 100)}%` : '—'}
                          {p.base_bonus ? ` / ${p.base_bonus.toLocaleString()}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {products.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              尚未設定產品分潤。{isManager ? '請點「管理產品」新增。' : '請聯絡主管設定產品。'}
            </div>
          )}
          {products.length > 0 && (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>簽約日</TableHead>
                    <TableHead>產品</TableHead>
                    <TableHead>客戶</TableHead>
                    {(isManager && viewRep !== 'me') && <TableHead>業務</TableHead>}
                    <TableHead className="text-right">合約金額（含稅）</TableHead>
                    <TableHead className="text-right">獎金</TableHead>
                    <TableHead>狀態</TableHead>
                    {isManager && <TableHead>操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleDeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        尚無成交紀錄，點「新增成交」開始記錄
                      </TableCell>
                    </TableRow>
                  ) : visibleDeals.map(deal => (
                    <TableRow key={deal.id}>
                      <TableCell className="text-sm">{new Date(deal.signed_at).toLocaleDateString('zh-TW')}</TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">{deal.product_name || '—'}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{deal.account_name || '—'}</TableCell>
                      {(isManager && viewRep !== 'me') && (
                        <TableCell className="text-sm">{getMemberName(deal.sales_rep_id)}</TableCell>
                      )}
                      <TableCell className="text-right text-sm">
                        {deal.contract_amount_tax ? deal.contract_amount_tax.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {fmt(deal.bonus_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={deal.status === 'paid' ? 'default' : 'secondary'}
                          className={deal.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                          {deal.status === 'paid' ? '已撥款' : '待撥款'}
                        </Badge>
                      </TableCell>
                      {isManager && (
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-xs"
                            onClick={() => handleMarkPaid(deal.id, deal.status)}>
                            {deal.status === 'paid' ? '取消撥款' : '標記撥款'}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product reference */}
      {products.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">產品分潤參考</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {products.map(p => (
                <div key={p.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    {p.commission_rate && <div>分潤比例：{Math.round(p.commission_rate * 100)}%</div>}
                    {p.base_bonus && <div>簽約獎金：{p.base_bonus.toLocaleString()} / 單</div>}
                    {p.notes && <div className="text-xs">{p.notes}</div>}
                    <div className="text-xs">{p.is_variable ? '金額不固定，依合約為主' : '金額固定'}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
