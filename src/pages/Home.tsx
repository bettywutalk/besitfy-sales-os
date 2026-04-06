import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, ExternalLink, CheckCircle2, ArrowRight, BookOpen, Link2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

type Section = {
  id: string;
  org_id: string;
  section_type: string;
  title: string;
  content: any;
  sort_order: number;
};

async function getOrgId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
  return data?.current_org_id ?? null;
}

function useHomeSections() {
  return useQuery({
    queryKey: ['homepage-sections'],
    queryFn: async () => {
      const orgId = await getOrgId();
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('homepage_sections')
        .select('*')
        .eq('org_id', orgId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Section[];
    },
  });
}

function useIsAdmin() {
  return useQuery({
    queryKey: ['is-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const orgId = await getOrgId();
      if (!orgId) return false;
      const { data } = await supabase.rpc('is_org_admin', { _user_id: user.id, _org_id: orgId });
      return !!data;
    },
  });
}

export default function Home() {
  const { data: sections = [], isLoading } = useHomeSections();
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState(false);
  const [editSection, setEditSection] = useState<Partial<Section> | null>(null);

  const checklists = sections.filter(s => s.section_type === 'checklist');
  const sops = sections.filter(s => s.section_type === 'sop');
  const resources = sections.filter(s => s.section_type === 'resource');

  const createMutation = useMutation({
    mutationFn: async (section: Omit<Section, 'id'>) => {
      const { error } = await supabase.from('homepage_sections').insert(section as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['homepage-sections'] }); toast.success('已新增'); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Section> & { id: string }) => {
      const { error } = await supabase.from('homepage_sections').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['homepage-sections'] }); toast.success('已更新'); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('homepage_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['homepage-sections'] }); toast.success('已刪除'); },
  });

  const openAdd = (type: string) => {
    setEditSection({ section_type: type, title: '', content: type === 'checklist' ? { items: [{ text: '', done: false }] } : type === 'sop' ? { steps: [{ title: '', description: '' }] } : { items: [{ label: '', url: '', category: '' }] }, sort_order: sections.length });
    setEditDialog(true);
  };

  const openEdit = (section: Section) => {
    setEditSection({ ...section });
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!editSection?.title) { toast.error('請填寫標題'); return; }
    const orgId = await getOrgId();
    if (!orgId) return;

    if (editSection.id) {
      await updateMutation.mutateAsync({ id: editSection.id, title: editSection.title, content: editSection.content, sort_order: editSection.sort_order });
    } else {
      await createMutation.mutateAsync({ org_id: orgId, section_type: editSection.section_type!, title: editSection.title!, content: editSection.content, sort_order: editSection.sort_order ?? 0 } as any);
    }
    setEditDialog(false);
    setEditSection(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const isEmpty = sections.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">首頁</h1>
        <p className="text-muted-foreground text-sm mt-1">歡迎加入！這裡有你需要知道的一切</p>
      </div>

      {isEmpty && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <p className="font-medium">還沒有任何內容</p>
              <p className="text-sm text-muted-foreground">管理員可以新增 Onboarding Checklist、SOP 流程和相關資源連結</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => openAdd('checklist')}>+ Checklist</Button>
                <Button variant="outline" size="sm" onClick={() => openAdd('sop')}>+ SOP 流程</Button>
                <Button variant="outline" size="sm" onClick={() => openAdd('resource')}>+ 資源連結</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Checklist Sections */}
      {checklists.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Onboarding Checklist</h2>
            {isAdmin && <Button variant="ghost" size="sm" onClick={() => openAdd('checklist')}><Plus className="h-4 w-4" /></Button>}
          </div>
          <div className="grid gap-4">
            {checklists.map(section => (
              <Card key={section.id}>
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(section)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(section.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {(section.content?.items || []).map((item: any, i: number) => (
                    <label key={i} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 -mx-2">
                      <Checkbox checked={item.done} disabled />
                      <span className={item.done ? 'line-through text-muted-foreground' : ''}>{item.text}</span>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary ml-auto"><ExternalLink className="h-3 w-3" /></a>
                      )}
                    </label>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* SOP Sections */}
      {sops.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowRight className="h-5 w-5 text-primary" />SOP 流程</h2>
            {isAdmin && <Button variant="ghost" size="sm" onClick={() => openAdd('sop')}><Plus className="h-4 w-4" /></Button>}
          </div>
          {sops.map(section => (
            <Card key={section.id}>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(section)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(section.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(section.content?.steps || []).map((step: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</div>
                      <div>
                        <p className="font-medium text-sm">{step.title}</p>
                        {step.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{step.description}</p>}
                        {step.url && <a href={step.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{step.link_text || '查看連結'}</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resource Sections */}
      {resources.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />相關資源</h2>
            {isAdmin && <Button variant="ghost" size="sm" onClick={() => openAdd('resource')}><Plus className="h-4 w-4" /></Button>}
          </div>
          {resources.map(section => (
            <Card key={section.id}>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(section)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(section.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {(section.content?.items || []).map((item: any, i: number) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-muted/50 transition-colors group">
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        {item.category && <Badge variant="outline" className="text-xs mt-0.5">{item.category}</Badge>}
                      </div>
                      {item.note && <span className="text-xs text-muted-foreground hidden sm:block">{item.note}</span>}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSection?.id ? '編輯' : '新增'}{editSection?.section_type === 'checklist' ? ' Checklist' : editSection?.section_type === 'sop' ? ' SOP 流程' : ' 資源連結'}</DialogTitle>
            <DialogDescription>填寫以下欄位</DialogDescription>
          </DialogHeader>
          {editSection && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">標題</label>
                <Input value={editSection.title || ''} onChange={e => setEditSection({ ...editSection, title: e.target.value })} placeholder="例：新手入門清單" />
              </div>

              {editSection.section_type === 'checklist' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">項目</label>
                  {(editSection.content?.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <Input className="flex-1" value={item.text} placeholder="項目說明" onChange={e => {
                        const items = [...editSection.content.items];
                        items[i] = { ...items[i], text: e.target.value };
                        setEditSection({ ...editSection, content: { ...editSection.content, items } });
                      }} />
                      <Input className="w-40" value={item.url || ''} placeholder="連結 (選填)" onChange={e => {
                        const items = [...editSection.content.items];
                        items[i] = { ...items[i], url: e.target.value };
                        setEditSection({ ...editSection, content: { ...editSection.content, items } });
                      }} />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
                        const items = editSection.content.items.filter((_: any, j: number) => j !== i);
                        setEditSection({ ...editSection, content: { ...editSection.content, items } });
                      }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditSection({ ...editSection, content: { ...editSection.content, items: [...(editSection.content?.items || []), { text: '', done: false }] } });
                  }}>+ 新增項目</Button>
                </div>
              )}

              {editSection.section_type === 'sop' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">步驟</label>
                  {(editSection.content?.steps || []).map((step: any, i: number) => (
                    <div key={i} className="space-y-1 p-3 border rounded-lg">
                      <div className="flex gap-2">
                        <span className="text-sm font-bold text-primary mt-2">#{i + 1}</span>
                        <Input className="flex-1" value={step.title} placeholder="步驟標題" onChange={e => {
                          const steps = [...editSection.content.steps];
                          steps[i] = { ...steps[i], title: e.target.value };
                          setEditSection({ ...editSection, content: { ...editSection.content, steps } });
                        }} />
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
                          const steps = editSection.content.steps.filter((_: any, j: number) => j !== i);
                          setEditSection({ ...editSection, content: { ...editSection.content, steps } });
                        }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <Textarea className="text-sm" rows={2} value={step.description || ''} placeholder="說明 (選填)" onChange={e => {
                        const steps = [...editSection.content.steps];
                        steps[i] = { ...steps[i], description: e.target.value };
                        setEditSection({ ...editSection, content: { ...editSection.content, steps } });
                      }} />
                      <Input value={step.url || ''} placeholder="連結 (選填)" onChange={e => {
                        const steps = [...editSection.content.steps];
                        steps[i] = { ...steps[i], url: e.target.value };
                        setEditSection({ ...editSection, content: { ...editSection.content, steps } });
                      }} />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditSection({ ...editSection, content: { ...editSection.content, steps: [...(editSection.content?.steps || []), { title: '', description: '' }] } });
                  }}>+ 新增步驟</Button>
                </div>
              )}

              {editSection.section_type === 'resource' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">連結</label>
                  {(editSection.content?.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <Input className="flex-1" value={item.label} placeholder="名稱" onChange={e => {
                        const items = [...editSection.content.items];
                        items[i] = { ...items[i], label: e.target.value };
                        setEditSection({ ...editSection, content: { ...editSection.content, items } });
                      }} />
                      <Input className="flex-1" value={item.url || ''} placeholder="URL" onChange={e => {
                        const items = [...editSection.content.items];
                        items[i] = { ...items[i], url: e.target.value };
                        setEditSection({ ...editSection, content: { ...editSection.content, items } });
                      }} />
                      <Input className="w-24" value={item.category || ''} placeholder="分類" onChange={e => {
                        const items = [...editSection.content.items];
                        items[i] = { ...items[i], category: e.target.value };
                        setEditSection({ ...editSection, content: { ...editSection.content, items } });
                      }} />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
                        const items = editSection.content.items.filter((_: any, j: number) => j !== i);
                        setEditSection({ ...editSection, content: { ...editSection.content, items } });
                      }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditSection({ ...editSection, content: { ...editSection.content, items: [...(editSection.content?.items || []), { label: '', url: '', category: '' }] } });
                  }}>+ 新增連結</Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
