import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Building2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Org {
  id: string;
  name: string;
  created_at: string;
}

export default function SelectOrg() {
  const navigate = useNavigate();
  const [newOrgName, setNewOrgName] = useState('');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // 先檢查現有 session 是否為 recovery 類型
    supabase.auth.getSession().then(({ data: { session } }) => {
      if ((session as any)?.user?.aud === 'authenticated' && window.location.hash.includes('type=recovery')) {
        navigate('/auth?recovery=1', { replace: true });
        return;
      }
    });
    // 攔截 PASSWORD_RECOVERY 事件，避免被帶到選組織頁
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/auth?recovery=1', { replace: true });
      }
    });
    loadOrgs();
    return () => subscription.unsubscribe();
  }, []);

  async function loadOrgs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    const { data } = await supabase.from('organizations').select('id, name, created_at');
    setOrgs(data ?? []);
    setLoading(false);
  }

  async function selectOrg(orgId: string) {
    setSelecting(orgId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ current_org_id: orgId }).eq('id', user.id);
    if (error) {
      toast.error('選擇公司失敗');
      setSelecting(null);
      return;
    }
    navigate('/accounts');
  }

  async function createOrg() {
    setCreating(true);
    const { data, error } = await supabase.rpc('create_organization_with_member', {
      _name: newOrgName.trim(),
    });
    if (error) {
      toast.error('建立公司失敗：' + error.message);
      setCreating(false);
      return;
    }
    navigate('/accounts');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Target className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Besitfy Sales OS</h1>
          </div>
          <p className="text-muted-foreground text-sm">選擇你的工作空間</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {orgs.map((org) => (
              <Card
                key={org.id}
                className="cursor-pointer border hover:border-primary/50 hover:shadow-md transition-all group"
                onClick={() => selectOrg(org.id)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {org.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{org.name}</h3>
                    <p className="text-sm text-muted-foreground">建立於 {new Date(org.created_at).toLocaleDateString('zh-TW')}</p>
                  </div>
                  {selecting === org.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </CardContent>
              </Card>
            ))}

            {orgs.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">尚無工作空間，請建立一個新公司</p>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Card className="cursor-pointer border-dashed hover:border-primary/50 hover:shadow-md transition-all">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-muted-foreground">建立新公司</h3>
                      <p className="text-sm text-muted-foreground">建立一個新的工作空間</p>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>建立新公司</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>公司名稱</Label>
                    <Input placeholder="例如：Insider One" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={createOrg} disabled={!newOrgName.trim() || creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    建立並進入
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
