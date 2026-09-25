import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import PublicLayout from "@/components/layout/PublicLayout";
import DashboardLayout from "@/components/layout/DashboardLayout";

const HomePage = lazy(() => import("@/pages/Home"));
const FeaturesPage = lazy(() => import("@/pages/Features"));
const PricingPage = lazy(() => import("@/pages/Pricing"));
const ContactPage = lazy(() => import("@/pages/Contact"));
const LoginPage = lazy(() => import("@/pages/Login"));
const RegisterPage = lazy(() => import("@/pages/Register"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPassword"));
const UnauthorizedPage = lazy(() => import("@/pages/Unauthorized"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const GroupDashboard = lazy(() => import("@/pages/group/Dashboard"));
const GroupElections = lazy(() => import("@/pages/group/Elections"));
const ElectionCreate = lazy(() => import("@/pages/group/ElectionCreate"));
const ElectionDetail = lazy(() => import("@/pages/group/ElectionDetail"));
const MemberDashboard = lazy(() => import("@/pages/member/Dashboard"));
const MemberNominations = lazy(() => import("@/pages/member/Nominations"));
const MemberVotePage = lazy(() => import("@/pages/member/VotePage"));
const MemberResults = lazy(() => import("@/pages/member/Results"));
import PlaceholderPage from "@/components/PlaceholderPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /><span className="sr-only">Loading…</span></div>}>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Global Admin */}
            <Route element={
              <ProtectedRoute requiredRole="global_admin">
                <DashboardLayout role="global-admin" />
              </ProtectedRoute>
            }>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/groups" element={<PlaceholderPage title="Manage Groups" />} />
              <Route path="/admin/plans" element={<PlaceholderPage title="Plans & Pricing" />} />
              <Route path="/admin/payments" element={<PlaceholderPage title="Payments" />} />
              <Route path="/admin/audit" element={<PlaceholderPage title="Audit Logs" />} />
              <Route path="/admin/settings" element={<PlaceholderPage title="Platform Settings" />} />
            </Route>

            {/* Group Admin */}
            <Route element={
              <ProtectedRoute requiredRole="group_admin">
                <DashboardLayout role="group-admin" />
              </ProtectedRoute>
            }>
              <Route path="/group" element={<GroupDashboard />} />
              <Route path="/group/members" element={<PlaceholderPage title="Member Management" />} />
              <Route path="/group/elections" element={<GroupElections />} />
              <Route path="/group/elections/new" element={<ElectionCreate />} />
              <Route path="/group/elections/:id" element={<ElectionDetail />} />
              <Route path="/group/results" element={<PlaceholderPage title="Results" />} />
              <Route path="/group/billing" element={<PlaceholderPage title="Billing & Subscription" />} />
              <Route path="/group/audit" element={<PlaceholderPage title="Audit Logs" />} />
              <Route path="/group/settings" element={<PlaceholderPage title="Group Settings" />} />
            </Route>

            {/* Member */}
            <Route element={
              <ProtectedRoute requiredRole="member">
                <DashboardLayout role="member" />
              </ProtectedRoute>
            }>
              <Route path="/member" element={<MemberDashboard />} />
              <Route path="/member/nominations" element={<MemberNominations />} />
              <Route path="/member/vote" element={<MemberVotePage />} />
              <Route path="/member/results" element={<MemberResults />} />
              <Route path="/member/profile" element={<PlaceholderPage title="My Profile" />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
