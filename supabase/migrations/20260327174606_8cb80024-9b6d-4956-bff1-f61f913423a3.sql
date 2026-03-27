
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('global_admin', 'group_admin', 'member');
CREATE TYPE public.group_status AS ENUM ('pending_payment', 'active', 'suspended', 'closed', 'terminated');
CREATE TYPE public.member_status AS ENUM ('invited', 'active', 'inactive', 'suspended');
CREATE TYPE public.election_status AS ENUM (
  'draft', 'nominations_open', 'nominations_closed', 'candidate_review',
  'candidate_acceptance', 'ready_for_voting', 'voting_open', 'voting_closed',
  'result_review', 'published', 'cancelled'
);
CREATE TYPE public.candidate_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'qualified');
CREATE TYPE public.subscription_status AS ENUM ('pending', 'active', 'past_due', 'expired', 'cancelled');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- ============================================================
-- UTILITY: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. USER ROLES (separate table per security guidelines)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. SECURITY DEFINER helper functions (avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================================
-- 4. SUBSCRIPTION PLANS (global admin managed)
-- ============================================================
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('daily', 'monthly')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. GROUPS (tenants)
-- ============================================================
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  logo_url TEXT,
  status group_status NOT NULL DEFAULT 'pending_payment',
  registration_fee_paid BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_groups_status ON public.groups(status);

-- ============================================================
-- 6. GROUP SETTINGS
-- ============================================================
CREATE TABLE public.group_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL UNIQUE REFERENCES public.groups(id) ON DELETE CASCADE,
  allow_vote_editing BOOLEAN NOT NULL DEFAULT false,
  require_result_review BOOLEAN NOT NULL DEFAULT true,
  election_timezone TEXT NOT NULL DEFAULT 'UTC',
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_group_settings_updated_at BEFORE UPDATE ON public.group_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. GROUP ADMINS
-- ============================================================
CREATE TABLE public.group_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_group_admins_group ON public.group_admins(group_id);
CREATE INDEX idx_group_admins_user ON public.group_admins(user_id);

-- ============================================================
-- 8. MEMBERS
-- ============================================================
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  status member_status NOT NULL DEFAULT 'invited',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, email)
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_members_group ON public.members(group_id);
CREATE INDEX idx_members_user ON public.members(user_id);

-- Forward-declare is_group_admin and is_group_member now that tables exist
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_admins
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = _user_id AND group_id = _group_id AND status = 'active'
  )
$$;

-- ============================================================
-- 9. INVITATIONS
-- ============================================================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invitations_group ON public.invitations(group_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);

-- ============================================================
-- 10. VOTER CODES
-- ============================================================
CREATE TABLE public.voter_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.voter_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_voter_codes_member ON public.voter_codes(member_id);

-- ============================================================
-- 11. SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'pending',
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_subscriptions_group ON public.subscriptions(group_id);

-- ============================================================
-- 12. PAYMENT TRANSACTIONS
-- ============================================================
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  type TEXT NOT NULL CHECK (type IN ('registration_fee', 'subscription', 'renewal')),
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payment_transactions_group ON public.payment_transactions(group_id);

-- ============================================================
-- 13. ELECTION CYCLES
-- ============================================================
CREATE TABLE public.election_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status election_status NOT NULL DEFAULT 'draft',
  is_adhoc BOOLEAN NOT NULL DEFAULT false,
  allow_vote_editing BOOLEAN,
  nomination_start TIMESTAMPTZ,
  nomination_end TIMESTAMPTZ,
  voting_start TIMESTAMPTZ,
  voting_end TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.election_cycles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_election_cycles_updated_at BEFORE UPDATE ON public.election_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_election_cycles_group ON public.election_cycles(group_id);
CREATE INDEX idx_election_cycles_status ON public.election_cycles(status);

-- ============================================================
-- 14. POSITIONS
-- ============================================================
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  election_cycle_id UUID NOT NULL REFERENCES public.election_cycles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  max_candidates INTEGER NOT NULL DEFAULT 5,
  max_winners INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_positions_election ON public.positions(election_cycle_id);

-- ============================================================
-- 15. NOMINATIONS
-- ============================================================
CREATE TABLE public.nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  nominee_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  nominated_by_member_id UUID NOT NULL REFERENCES public.members(id),
  is_valid BOOLEAN NOT NULL DEFAULT true,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nominations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nominations_position ON public.nominations(position_id);
CREATE INDEX idx_nominations_nominee ON public.nominations(nominee_member_id);

-- ============================================================
-- 16. CANDIDATE SELECTIONS
-- ============================================================
CREATE TABLE public.candidate_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  nomination_count INTEGER NOT NULL DEFAULT 0,
  status candidate_status NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (position_id, member_id)
);
ALTER TABLE public.candidate_selections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_candidate_selections_updated_at BEFORE UPDATE ON public.candidate_selections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_candidate_selections_position ON public.candidate_selections(position_id);

-- ============================================================
-- 17. VOTES
-- ============================================================
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  election_cycle_id UUID NOT NULL REFERENCES public.election_cycles(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidate_selections(id) ON DELETE CASCADE,
  is_latest BOOLEAN NOT NULL DEFAULT true,
  cast_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_votes_position ON public.votes(position_id);
CREATE INDEX idx_votes_member ON public.votes(member_id);
CREATE INDEX idx_votes_latest ON public.votes(position_id, member_id) WHERE is_latest = true;

-- ============================================================
-- 18. RESULT SUMMARIES
-- ============================================================
CREATE TABLE public.result_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  election_cycle_id UUID NOT NULL REFERENCES public.election_cycles(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidate_selections(id),
  vote_count INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.result_summaries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_result_summaries_election ON public.result_summaries(election_cycle_id);

-- ============================================================
-- 19. RESULT PUBLICATIONS
-- ============================================================
CREATE TABLE public.result_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  election_cycle_id UUID NOT NULL REFERENCES public.election_cycles(id) ON DELETE CASCADE,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ
);
ALTER TABLE public.result_publications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 20. AUDIT LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_group ON public.audit_logs(group_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- 21. NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id);

-- ============================================================
-- 22. PLATFORM SETTINGS (global admin)
-- ============================================================
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Global admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'global_admin'));

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Global admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));

-- SUBSCRIPTION PLANS (public read, admin write)
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);
CREATE POLICY "Global admins manage plans" ON public.subscription_plans
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));

-- GROUPS
CREATE POLICY "Global admins can manage all groups" ON public.groups
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));
CREATE POLICY "Group admins can view own group" ON public.groups
  FOR SELECT USING (public.is_group_admin(auth.uid(), id));
CREATE POLICY "Members can view own group" ON public.groups
  FOR SELECT USING (public.is_group_member(auth.uid(), id));
CREATE POLICY "Authenticated users can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- GROUP SETTINGS
CREATE POLICY "Group admins can manage settings" ON public.group_settings
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Global admins can view group settings" ON public.group_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'global_admin'));

-- GROUP ADMINS
CREATE POLICY "Group admins can view own group admins" ON public.group_admins
  FOR SELECT USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Global admins can manage group admins" ON public.group_admins
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));
CREATE POLICY "Primary admin can add admins" ON public.group_admins
  FOR INSERT WITH CHECK (public.is_group_admin(auth.uid(), group_id));

-- MEMBERS
CREATE POLICY "Group admins can manage members" ON public.members
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view own group members" ON public.members
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Global admins can view all members" ON public.members
  FOR SELECT USING (public.has_role(auth.uid(), 'global_admin'));

-- INVITATIONS
CREATE POLICY "Group admins can manage invitations" ON public.invitations
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Anyone can view invitation by token" ON public.invitations
  FOR SELECT USING (true);

-- VOTER CODES
CREATE POLICY "Members can view own voter code" ON public.voter_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "Group admins can manage voter codes" ON public.voter_codes
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));

-- SUBSCRIPTIONS
CREATE POLICY "Group admins can view own subscription" ON public.subscriptions
  FOR SELECT USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Global admins can manage subscriptions" ON public.subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));

-- PAYMENT TRANSACTIONS
CREATE POLICY "Group admins can view own payments" ON public.payment_transactions
  FOR SELECT USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Global admins can manage payments" ON public.payment_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));

-- ELECTION CYCLES
CREATE POLICY "Group admins can manage elections" ON public.election_cycles
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view elections" ON public.election_cycles
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Global admins can view all elections" ON public.election_cycles
  FOR SELECT USING (public.has_role(auth.uid(), 'global_admin'));

-- POSITIONS
CREATE POLICY "Group admins can manage positions" ON public.positions
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view positions" ON public.positions
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));

-- NOMINATIONS
CREATE POLICY "Group admins can manage nominations" ON public.nominations
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can create nominations" ON public.nominations
  FOR INSERT WITH CHECK (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Members can view nominations" ON public.nominations
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));

-- CANDIDATE SELECTIONS
CREATE POLICY "Group admins can manage candidates" ON public.candidate_selections
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view candidates" ON public.candidate_selections
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Candidates can update own status" ON public.candidate_selections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );

-- VOTES
CREATE POLICY "Members can cast votes" ON public.votes
  FOR INSERT WITH CHECK (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Members can view own votes" ON public.votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "Group admins can view vote counts" ON public.votes
  FOR SELECT USING (public.is_group_admin(auth.uid(), group_id));

-- RESULT SUMMARIES
CREATE POLICY "Group admins can manage results" ON public.result_summaries
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view published results" ON public.result_summaries
  FOR SELECT USING (
    public.is_group_member(auth.uid(), group_id) AND
    EXISTS (
      SELECT 1 FROM public.election_cycles ec
      WHERE ec.id = election_cycle_id AND ec.status = 'published'
    )
  );

-- RESULT PUBLICATIONS
CREATE POLICY "Group admins can manage publications" ON public.result_publications
  FOR ALL USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view publications" ON public.result_publications
  FOR SELECT USING (public.is_group_member(auth.uid(), group_id));

-- AUDIT LOGS
CREATE POLICY "Group admins can view own audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Global admins can view all audit logs" ON public.audit_logs
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- PLATFORM SETTINGS
CREATE POLICY "Anyone can read platform settings" ON public.platform_settings
  FOR SELECT USING (true);
CREATE POLICY "Global admins can manage platform settings" ON public.platform_settings
  FOR ALL USING (public.has_role(auth.uid(), 'global_admin'));

-- ============================================================
-- SEED: Default platform settings
-- ============================================================
INSERT INTO public.platform_settings (key, value) VALUES
  ('registration_fee', '{"amount_cents": 5000, "currency": "usd"}'::jsonb),
  ('default_plans', '{"daily_cents": 200, "monthly_cents": 2999}'::jsonb);

-- ============================================================
-- SEED: Default subscription plans
-- ============================================================
INSERT INTO public.subscription_plans (name, interval, price_cents, currency) VALUES
  ('Daily Plan', 'daily', 200, 'usd'),
  ('Monthly Plan', 'monthly', 2999, 'usd');
