import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./pages/Auth";
import SelectOrg from "./pages/SelectOrg";
import { AppLayout } from "./components/AppLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Leads from "./pages/Leads";
import Segments from "./pages/Segments";
import Events from "./pages/Events";
import Scraper from "./pages/Scraper";

import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RecoveryRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    // 頁面載入時，若 URL hash 含有 recovery token，立即導向
    if (window.location.hash.includes('type=recovery')) {
      navigate('/auth?recovery=1', { replace: true });
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/auth?recovery=1', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RecoveryRedirect />
        <Routes>
          <Route path="/" element={<SelectOrg />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/select-org" element={<Navigate to="/" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:id" element={<AccountDetail />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/segments" element={<Segments />} />
            <Route path="/events" element={<Events />} />
            <Route path="/scraper" element={<Scraper />} />
            {/* Partners page removed */}
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
