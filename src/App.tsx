import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import PublicLayout from "@/components/layout/PublicLayout";
import DashboardLayout from "@/components/layout/DashboardLayout";

import HomePage from "@/pages/Home";
import FeaturesPage from "@/pages/Features";
import PricingPage from "@/pages/Pricing";
import ContactPage from "@/pages/Contact";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import NotFound from "@/pages/NotFound";

import AdminDashboard from "@/pages/admin/Dashboard";
import GroupDashboard from "@/pages/group/Dashboard";
import MemberDashboard from "@/pages/member/Dashboard";
import PlaceholderPage from "@/components/PlaceholderPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Global Admin */}
          <Route element={<DashboardLayout role="global-admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/groups" element={<PlaceholderPage title="Manage Groups" />} />
            <Route path="/admin/plans" element={<PlaceholderPage title="Plans & Pricing" />} />
            <Route path="/admin/payments" element={<PlaceholderPage title="Payments" />} />
            <Route path="/admin/audit" element={<PlaceholderPage title="Audit Logs" />} />
            <Route path="/admin/settings" element={<PlaceholderPage title="Platform Settings" />} />
          </Route>

          {/* Group Admin */}
          <Route element={<DashboardLayout role="group-admin" />}>
            <Route path="/group" element={<GroupDashboard />} />
            <Route path="/group/members" element={<PlaceholderPage title="Member Management" />} />
            <Route path="/group/elections" element={<PlaceholderPage title="Elections" />} />
            <Route path="/group/results" element={<PlaceholderPage title="Results" />} />
            <Route path="/group/billing" element={<PlaceholderPage title="Billing & Subscription" />} />
            <Route path="/group/audit" element={<PlaceholderPage title="Audit Logs" />} />
            <Route path="/group/settings" element={<PlaceholderPage title="Group Settings" />} />
          </Route>

          {/* Member */}
          <Route element={<DashboardLayout role="member" />}>
            <Route path="/member" element={<MemberDashboard />} />
            <Route path="/member/nominations" element={<PlaceholderPage title="Nominations" />} />
            <Route path="/member/vote" element={<PlaceholderPage title="Cast Your Vote" />} />
            <Route path="/member/results" element={<PlaceholderPage title="Published Results" />} />
            <Route path="/member/profile" element={<PlaceholderPage title="My Profile" />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
