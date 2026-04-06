import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';

type PartnerMember = {
  id: string;
  user_id: string;
  role: string;
  full_name: string;
  region: string | null;
  industry_focus: string | null;
  supervisor_id: string | null;
};

const REGIONS = ['北部（台北）', '北部（新北）', '中部（台中）', '南部', '東部', '全區'];
const INDUSTRIES = ['醫美-整形外科', '醫美-皮膚科', '醫美-牙科', '醫美-眼科', '醫美-產後中心', '美妝保養', '寵物周邊', '健康保健', 'SaaS', 'F&B', 'Other'];

async function getOrgId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
  return data?.current_org_id ?? null;
}

function usePartners() {
  return useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const orgId = await getOrgId();
      if (!orgId) return [];
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, region, industry_focus, supervisor_id')
        .eq('org_id', orgId);
      if (error) throw error;

      const userIds = (members ?? []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      const nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]));

      return (members ?? []).map((m: any) => ({
        ...m,
        full_name: nameMap[m.user_id] || '未知',
      })) as PartnerMember[];
    },
  });
}

export default function Partners() {
  const { data: partners = [], isLoading } = usePartners();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PartnerMember>>({});

  const updateMutation = useMutation({
    mutationFn: async ({ id, region, industry_focus, supervisor_id }: { id: string; region?: string | null; industry_focus?: string | null; supervisor_id?: string | null }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ region, industry_focus, supervisor_id } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('已更新');
      setEditingId(null);
    },
  });

  const startEdit = (partner: PartnerMember) => {
    setEditingId(partner.id);
    setEditValues({ region: partner.region, industry_focus: partner.industry_focus, supervisor_id: partner.supervisor_id });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, ...editValues });
  };

  const getSupervisorName = (id: string | null) => {
    if (!id) return '-';
    return partners.find(p => p.user_id === id)?.full_name || '-';
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = { admin: '管理員', sales_manager: '業務主管', sales_rep: '業務', partner: '夥伴' };
    return map[role] || role;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          夥伴清單
        </h1>
        <p className="text-muted-foreground text-sm mt-1">管理夥伴分工與負責區域 · {partners.length} 位</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">總人數</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{partners.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">已分配區域</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{partners.filter(p => p.region).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">已分配產業</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{partners.filter(p => p.industry_focus).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">有直屬主管</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{partners.filter(p => p.supervisor_id).length}</p></CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead className="w-24">角色</TableHead>
              <TableHead className="w-36">負責地區</TableHead>
              <TableHead className="w-36">負責產業</TableHead>
              <TableHead className="w-28">直屬主管</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : partners.map(partner => (
              <TableRow key={partner.id}>
                <TableCell className="font-medium">{partner.full_name}</TableCell>
                <TableCell><Badge variant="outline">{roleLabel(partner.role)}</Badge></TableCell>
                <TableCell>
                  {editingId === partner.id ? (
                    <Select value={editValues.region || ''} onValueChange={v => setEditValues({ ...editValues, region: v || null })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="選擇地區" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未分配</SelectItem>
                        {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    partner.region || <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === partner.id ? (
                    <Select value={editValues.industry_focus || ''} onValueChange={v => setEditValues({ ...editValues, industry_focus: v || null })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="選擇產業" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未分配</SelectItem>
                        {INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    partner.industry_focus || <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === partner.id ? (
                    <Select value={editValues.supervisor_id || ''} onValueChange={v => setEditValues({ ...editValues, supervisor_id: v || null })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="選擇主管" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">無</SelectItem>
                        {partners.filter(p => p.user_id !== partner.user_id).map(p => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    getSupervisorName(partner.supervisor_id)
                  )}
                </TableCell>
                <TableCell>
                  {editingId === partner.id ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}><Save className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(partner)}><Pencil className="h-3 w-3" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && partners.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">尚無夥伴，請到設定頁面邀請成員加入</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
