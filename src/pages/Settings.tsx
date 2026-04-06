import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Shield, Crown, Users, Briefcase, Handshake, MoreHorizontal, Trash2, Mail, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useOrgMembers, useInvitations, useCreateInvitation, useDeleteInvitation, useUpdateMemberRole, useRemoveMember } from '@/hooks/use-data';
import { toast } from 'sonner';
import type { OrgRole } from '@/types';

const ROLE_CONFIG: Record<OrgRole, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: '管理員', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: Crown },
  sales_manager: { label: '業務經理', color: 'bg-warning/10 text-warning border-warning/20', icon: Shield },
  sales_rep: { label: '業務代表', color: 'bg-primary/10 text-primary border-primary/20', icon: Briefcase },
  partner: { label: '合作夥伴', color: 'bg-muted text-muted-foreground border-border', icon: Handshake },
};

function RoleBadge({ role }: { role: OrgRole }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} gap-1 font-medium`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function Settings() {
  const { data: members = [], isLoading: membersLoading } = useOrgMembers();
  const { data: invitations = [], isLoading: invLoading } = useInvitations();
  const createInvitation = useCreateInvitation();
  const deleteInvitation = useDeleteInvitation();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('sales_rep');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const handleInvite = async () => {
    try {
      await createInvitation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      toast.success(`已發送邀請給 ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('sales_rep');
      setIsInviteOpen(false);
    } catch (e: any) {
      toast.error(e.message || '邀請失敗');
    }
  };

  const handleRoleChange = async (userId: string, role: OrgRole) => {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast.success('角色已更新');
    } catch (e: any) {
      toast.error(e.message || '更新失敗');
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    try {
      await removeMember.mutateAsync(userId);
      toast.success(`已移除 ${name}`);
    } catch (e: any) {
      toast.error(e.message || '移除失敗');
    }
  };

  const handleDeleteInvitation = async (id: string) => {
    try {
      await deleteInvitation.mutateAsync(id);
      toast.success('邀請已取消');
    } catch (e: any) {
      toast.error(e.message || '刪除失敗');
    }
  };

  const pendingInvitations = invitations.filter((i: any) => i.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">設定</h1>
          <p className="text-muted-foreground text-sm">管理公司成員與權限</p>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-4 w-4" />
            成員管理
          </TabsTrigger>
          <TabsTrigger value="org" className="gap-1.5">
            公司設定
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6 mt-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {(Object.entries(ROLE_CONFIG) as [OrgRole, typeof ROLE_CONFIG[OrgRole]][]).map(([role, config]) => {
              const Icon = config.icon;
              const count = members.filter((m: any) => m.role === role).length;
              return (
                <Card key={role}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{config.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Members Table */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">團隊成員</CardTitle>
                <CardDescription>共 {members.length} 位成員</CardDescription>
              </div>
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    邀請成員
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>邀請新成員</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="member@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>角色</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ROLE_CONFIG) as [OrgRole, typeof ROLE_CONFIG[OrgRole]][]).map(([role, config]) => (
                            <SelectItem key={role} value={role}>
                              <span className="flex items-center gap-2">
                                <config.icon className="h-3.5 w-3.5" />
                                {config.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || createInvitation.isPending}
                    >
                      {createInvitation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      發送邀請
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成員</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>加入時間</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : members.map((member: any) => (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {member.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{member.full_name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.joined_at).toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(Object.entries(ROLE_CONFIG) as [OrgRole, typeof ROLE_CONFIG[OrgRole]][]).map(([role, config]) => (
                              <DropdownMenuItem
                                key={role}
                                className="gap-2"
                                onClick={() => handleRoleChange(member.user_id, role)}
                              >
                                <config.icon className="h-3.5 w-3.5" />
                                設為{config.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              className="gap-2 text-destructive"
                              onClick={() => handleRemoveMember(member.user_id, member.full_name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              移除成員
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">待接受邀請</CardTitle>
                <CardDescription>已發送但尚未接受的邀請</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>邀請時間</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvitations.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{inv.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={inv.role} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString('zh-TW')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteInvitation(inv.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="org" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">公司資訊</CardTitle>
              <CardDescription>修改你的公司名稱和 Logo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>公司名稱</Label>
                <Input defaultValue="Insider One" />
              </div>
              <Button>儲存變更</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
