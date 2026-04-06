import { Building2, Users, Target, Filter, Calendar, LogOut, ChevronDown, ChevronsUpDown, Settings, LayoutDashboard, Home, UserCheck, Search } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { useCurrentUserRole } from '@/hooks/use-data';
import { supabase } from '@/integrations/supabase/client';

const baseNavItems = [
  { title: 'Home', url: '/home', icon: Home },
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Accounts', url: '/accounts', icon: Building2 },
  { title: 'Leads', url: '/leads', icon: Users },
  { title: 'Segments', url: '/segments', icon: Filter },
  { title: 'Events', url: '/events', icon: Calendar },
  { title: 'Scraper', url: '/scraper', icon: Search },
];

const adminNavItems = [
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = location; // just for type
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [currentOrg, setCurrentOrg] = useState<{ id: string; name: string } | null>(null);
  const { data: userRole } = useCurrentUserRole();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: members } = await supabase.from('organization_members').select('org_id').eq('user_id', user.id);
      if (!members?.length) return;
      const orgIds = members.map(m => m.org_id);
      const { data: orgList } = await supabase.from('organizations').select('id, name').in('id', orgIds);
      if (orgList) setOrgs(orgList);
      const { data: profile } = await supabase.from('profiles').select('current_org_id').eq('id', user.id).single();
      const cur = orgList?.find(o => o.id === profile?.current_org_id) || orgList?.[0];
      if (cur) setCurrentOrg(cur);
    }
    load();
  }, []);

  const navItems = userRole === 'admin'
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                {currentOrg?.name.charAt(0) ?? '?'}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">{currentOrg?.name ?? '選擇公司'}</p>
                    <p className="text-xs text-muted-foreground">Sales OS</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {orgs.map((org) => (
              <DropdownMenuItem key={org.id} onClick={async () => {
                setCurrentOrg(org);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase.from('profiles').update({ current_org_id: org.id }).eq('id', user.id);
                  window.location.reload();
                }
              }} className="gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-semibold">
                  {org.name.charAt(0)}
                </div>
                {org.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="gap-2 text-muted-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded border border-dashed text-xs">+</div>
              建立新公司
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)}>
                    <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">U</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">User</p>
              <p className="text-xs text-muted-foreground truncate">user@example.com</p>
            </div>
          )}
          {!collapsed && (
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
