-- =====================================================================
-- VoteWell Secure: member management, tie resolution, audit log hardening
-- Apply verbatim as ONE migration. Do not edit, reorder or split.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MEMBERS and INVITATIONS: read-only for clients; all writes via functions
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Group admins can manage members" ON public.members;
CREATE POLICY "Group admins can view members" ON public.members
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
REVOKE INSERT, UPDATE, DELETE ON public.members FROM anon, authenticated;

DROP POLICY IF EXISTS "Group admins can manage invitations" ON public.invitations;
CREATE POLICY "Group admins can view invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
REVOKE INSERT, UPDATE, DELETE ON public.invitations FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. AUDIT LOGS: append-only, written only by database functions
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own audit logs for their groups" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Global admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Global admins can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'global_admin'));
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. TIE RESOLUTIONS: record of how a tie at the winning cut-off was settled
-- ---------------------------------------------------------------------
CREATE TABLE public.tie_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  election_cycle_id UUID NOT NULL REFERENCES public.election_cycles(id) ON DELETE CASCADE,
  position_id UUID NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,
  chosen_candidate_ids UUID[] NOT NULL,
  reason TEXT NOT NULL,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tie_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group admins can view tie resolutions" ON public.tie_resolutions
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view published tie resolutions" ON public.tie_resolutions
  FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id) AND EXISTS (
    SELECT 1 FROM public.election_cycles ec
    WHERE ec.id = election_cycle_id AND ec.status = 'published'));
REVOKE ALL ON public.tie_resolutions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.tie_resolutions FROM authenticated;
GRANT SELECT ON public.tie_resolutions TO authenticated;

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

-- True while any election in the group is open for voting (electorate is frozen)
CREATE OR REPLACE FUNCTION public.group_voting_in_progress(_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.election_cycles
                 WHERE group_id = _group_id AND status = 'voting_open')
$$;

-- Admin invites one or more people by email.
-- p_entries: JSON array of objects {"email": "...", "full_name": "..."} (full_name optional), max 500.
CREATE OR REPLACE FUNCTION public.invite_members(p_group_id uuid, p_entries jsonb)
RETURNS TABLE (email text, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid     uuid := auth.uid();
  v_entry   jsonb;
  v_email   text;
  v_name    text;
  v_member  public.members%ROWTYPE;
  v_invited int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_group_admin(v_uid, p_group_id) THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  IF public.group_voting_in_progress(p_group_id) THEN RAISE EXCEPTION 'MEMBERSHIP_LOCKED_DURING_VOTING'; END IF;
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN RAISE EXCEPTION 'NO_ENTRIES'; END IF;
  IF jsonb_array_length(p_entries) > 500 THEN RAISE EXCEPTION 'TOO_MANY_ENTRIES'; END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_email := lower(trim(coalesce(v_entry ->> 'email', '')));
    v_name  := nullif(left(trim(coalesce(v_entry ->> 'full_name', '')), 200), '');

    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 320 THEN
      email := v_email; outcome := 'invalid_email'; RETURN NEXT; CONTINUE;
    END IF;

    SELECT * INTO v_member FROM public.members m
     WHERE m.group_id = p_group_id AND lower(m.email) = v_email
     FOR UPDATE;

    IF v_member.id IS NOT NULL AND v_member.status IN ('active', 'suspended') THEN
      email := v_email; outcome := 'already_member'; RETURN NEXT; CONTINUE;
    END IF;
    IF v_member.id IS NOT NULL AND v_member.status = 'inactive' THEN
      email := v_email; outcome := 'previously_removed'; RETURN NEXT; CONTINUE;
    END IF;
    IF v_member.id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.invitations i
          WHERE i.group_id = p_group_id AND lower(i.email) = v_email
            AND i.status = 'pending' AND i.expires_at > now()) THEN
      email := v_email; outcome := 'already_invited'; RETURN NEXT; CONTINUE;
    END IF;

    IF v_member.id IS NULL THEN
      INSERT INTO public.members (group_id, email, full_name, status, created_by)
      VALUES (p_group_id, v_email, v_name, 'invited', v_uid);
    END IF;

    -- Supersede any stale invitation for this email, then issue a fresh one
    UPDATE public.invitations i SET status = 'cancelled'
     WHERE i.group_id = p_group_id AND lower(i.email) = v_email AND i.status = 'pending';
    INSERT INTO public.invitations (group_id, email, role, invited_by)
    VALUES (p_group_id, v_email, 'member', v_uid);

    v_invited := v_invited + 1;
    email := v_email; outcome := 'invited'; RETURN NEXT;
  END LOOP;

  IF v_invited > 0 THEN
    INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
    VALUES (p_group_id, v_uid, 'members_invited', 'group', p_group_id,
            jsonb_build_object('count', v_invited));
  END IF;
END;
$$;

-- Admin issues a fresh link for a pending or expired invitation (new token, new 7-day expiry)
CREATE OR REPLACE FUNCTION public.resend_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_admin(v_uid, v_inv.group_id) THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  IF v_inv.status NOT IN ('pending', 'expired') THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING'; END IF;
  IF public.group_voting_in_progress(v_inv.group_id) THEN RAISE EXCEPTION 'MEMBERSHIP_LOCKED_DURING_VOTING'; END IF;

  UPDATE public.invitations
     SET token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
         status = 'pending',
         expires_at = now() + INTERVAL '7 days'
   WHERE id = p_invitation_id;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_inv.group_id, v_uid, 'invitation_resent', 'invitation', p_invitation_id,
          jsonb_build_object('email', v_inv.email));
END;
$$;

-- Admin cancels a pending invitation. A member record that never joined is removed.
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_admin(v_uid, v_inv.group_id) THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  IF v_inv.status NOT IN ('pending', 'expired') THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING'; END IF;

  UPDATE public.invitations SET status = 'cancelled' WHERE id = p_invitation_id;
  DELETE FROM public.members
   WHERE group_id = v_inv.group_id AND lower(email) = lower(v_inv.email)
     AND status = 'invited' AND user_id IS NULL;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_inv.group_id, v_uid, 'invitation_revoked', 'invitation', p_invitation_id,
          jsonb_build_object('email', v_inv.email));
END;
$$;

-- Public preview for the invitation landing page (works before sign-in).
-- Reveals only the organisation name, a masked email and whether the link is usable.
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token text)
RETURNS TABLE (group_name text, email_hint text, usable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.name,
         left(split_part(i.email, '@', 1), 1) || '***@' || split_part(i.email, '@', 2),
         (i.status = 'pending' AND i.expires_at > now())
  FROM public.invitations i
  JOIN public.groups g ON g.id = i.group_id
  WHERE i.token = p_token
$$;

-- The signed-in, email-confirmed invitee accepts. Links their account and grants the member role.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_inv       public.invitations%ROWTYPE;
  v_member    public.members%ROWTYPE;
  v_name      text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT u.email, u.email_confirmed_at INTO v_email, v_confirmed FROM auth.users u WHERE u.id = v_uid;
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'EMAIL_NOT_CONFIRMED'; END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH'; END IF;

  -- Idempotent: already accepted by this same user
  IF v_inv.status = 'accepted' AND EXISTS (
       SELECT 1 FROM public.members m
        WHERE m.group_id = v_inv.group_id AND m.user_id = v_uid) THEN
    RETURN v_inv.group_id;
  END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING'; END IF;
  IF v_inv.expires_at <= now() THEN RAISE EXCEPTION 'INVITATION_EXPIRED'; END IF;

  SELECT * INTO v_member FROM public.members m
   WHERE m.group_id = v_inv.group_id AND lower(m.email) = lower(v_inv.email)
   FOR UPDATE;
  IF v_member.id IS NULL OR v_member.status <> 'invited' THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM public.members m
              WHERE m.group_id = v_inv.group_id AND m.user_id = v_uid AND m.id <> v_member.id) THEN
    RAISE EXCEPTION 'ALREADY_A_MEMBER';
  END IF;

  SELECT nullif(trim(p.full_name), '') INTO v_name FROM public.profiles p WHERE p.id = v_uid;

  UPDATE public.members
     SET user_id = v_uid, status = 'active', full_name = coalesce(full_name, v_name)
   WHERE id = v_member.id;
  UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = v_inv.id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'member')
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_inv.group_id, v_uid, 'invitation_accepted', 'member', v_member.id, '{}'::jsonb);

  RETURN v_inv.group_id;
END;
$$;

-- Admin suspends, removes or reactivates a member who has joined.
CREATE OR REPLACE FUNCTION public.set_member_status(p_member_id uuid, p_status public.member_status)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_member public.members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_member FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_admin(v_uid, v_member.group_id) THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  IF p_status NOT IN ('active', 'suspended', 'inactive') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF v_member.user_id IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_JOINED'; END IF;
  IF public.group_voting_in_progress(v_member.group_id) THEN RAISE EXCEPTION 'MEMBERSHIP_LOCKED_DURING_VOTING'; END IF;
  IF v_member.status = p_status THEN RETURN; END IF;

  UPDATE public.members SET status = p_status WHERE id = p_member_id;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_member.group_id, v_uid, 'member_status_changed', 'member', p_member_id,
          jsonb_build_object('from', v_member.status, 'to', p_status));
END;
$$;

-- Admin corrects a member's display name (not while voting is open)
CREATE OR REPLACE FUNCTION public.update_member_name(p_member_id uuid, p_full_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_member public.members%ROWTYPE;
  v_name   text := nullif(left(trim(coalesce(p_full_name, '')), 200), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_member FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_admin(v_uid, v_member.group_id) THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;
  IF public.group_voting_in_progress(v_member.group_id) THEN RAISE EXCEPTION 'MEMBERSHIP_LOCKED_DURING_VOTING'; END IF;

  UPDATE public.members SET full_name = v_name WHERE id = p_member_id;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_member.group_id, v_uid, 'member_renamed', 'member', p_member_id,
          jsonb_build_object('from', v_member.full_name, 'to', v_name));
END;
$$;

-- Admin settles a tie at the winning cut-off during result review, with a recorded reason.
-- p_winner_candidate_ids: the tied candidates (candidate_selections ids) chosen to win.
CREATE OR REPLACE FUNCTION public.resolve_tie(p_position_id uuid, p_winner_candidate_ids uuid[], p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_pos     public.positions%ROWTYPE;
  v_el      public.election_cycles%ROWTYPE;
  v_winners int;
  v_cut     int;
  v_sure    int;
  v_needed  int;
  v_reason  text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_pos FROM public.positions WHERE id = p_position_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSITION_NOT_FOUND'; END IF;
  SELECT * INTO v_el FROM public.election_cycles WHERE id = v_pos.election_cycle_id FOR UPDATE;
  IF NOT public.is_group_admin(v_uid, v_el.group_id) THEN RAISE EXCEPTION 'NOT_AUTHORISED'; END IF;
  IF v_el.status <> 'result_review' THEN RAISE EXCEPTION 'RESULTS_NOT_IN_REVIEW'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;

  SELECT count(*), max(rank) INTO v_winners, v_cut
  FROM public.result_summaries WHERE position_id = p_position_id AND is_winner;
  IF v_winners <= v_pos.max_winners THEN RAISE EXCEPTION 'NO_TIE'; END IF;

  SELECT count(*) INTO v_sure
  FROM public.result_summaries WHERE position_id = p_position_id AND is_winner AND rank < v_cut;
  v_needed := v_pos.max_winners - v_sure;

  IF p_winner_candidate_ids IS NULL
     OR (SELECT count(DISTINCT c) FROM unnest(p_winner_candidate_ids) c) <> v_needed
     OR cardinality(p_winner_candidate_ids) <> v_needed
     OR EXISTS (SELECT 1 FROM unnest(p_winner_candidate_ids) c
                WHERE c NOT IN (SELECT rs.candidate_id FROM public.result_summaries rs
                                WHERE rs.position_id = p_position_id AND rs.is_winner AND rs.rank = v_cut)) THEN
    RAISE EXCEPTION 'INVALID_TIE_SELECTION';
  END IF;

  UPDATE public.result_summaries
     SET is_winner = (candidate_id = ANY (p_winner_candidate_ids))
   WHERE position_id = p_position_id AND is_winner AND rank = v_cut;

  INSERT INTO public.tie_resolutions (group_id, election_cycle_id, position_id, chosen_candidate_ids, reason, resolved_by)
  VALUES (v_el.group_id, v_el.id, p_position_id, p_winner_candidate_ids, left(v_reason, 1000), v_uid);

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_el.group_id, v_uid, 'tie_resolved', 'position', p_position_id,
          jsonb_build_object('chosen', p_winner_candidate_ids, 'reason', left(v_reason, 1000)));
END;
$$;

-- Publishing is refused while any position has more winners than seats (an unresolved tie)
CREATE OR REPLACE FUNCTION public.block_publish_with_unresolved_ties()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' AND EXISTS (
       SELECT 1 FROM public.positions p
       WHERE p.election_cycle_id = NEW.id AND p.is_active
         AND (SELECT count(*) FROM public.result_summaries rs
              WHERE rs.position_id = p.id AND rs.is_winner) > p.max_winners) THEN
    RAISE EXCEPTION 'UNRESOLVED_TIE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_publish_with_unresolved_ties
  BEFORE UPDATE OF status ON public.election_cycles
  FOR EACH ROW EXECUTE FUNCTION public.block_publish_with_unresolved_ties();

-- Admin audit log reader, with actor names and a total count for paging
CREATE OR REPLACE FUNCTION public.list_audit_logs(
  p_group_id uuid,
  p_action   text        DEFAULT NULL,
  p_from     timestamptz DEFAULT NULL,
  p_to       timestamptz DEFAULT NULL,
  p_limit    int         DEFAULT 50,
  p_offset   int         DEFAULT 0)
RETURNS TABLE (id uuid, created_at timestamptz, action text, entity_type text, entity_id uuid,
               details jsonb, actor_name text, actor_email text, total_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.created_at, a.action, a.entity_type, a.entity_id, a.details,
         pr.full_name, pr.email, count(*) OVER ()
  FROM public.audit_logs a
  LEFT JOIN public.profiles pr ON pr.id = a.user_id
  WHERE public.is_group_admin(auth.uid(), p_group_id)
    AND a.group_id = p_group_id
    AND (p_action IS NULL OR a.action = p_action)
    AND (p_from   IS NULL OR a.created_at >= p_from)
    AND (p_to     IS NULL OR a.created_at <  p_to)
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT  least(greatest(coalesce(p_limit, 50), 1), 200)
  OFFSET greatest(coalesce(p_offset, 0), 0)
$$;

-- ---------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.group_voting_in_progress(uuid),
  public.invite_members(uuid, jsonb),
  public.resend_invitation(uuid),
  public.revoke_invitation(uuid),
  public.get_invitation_preview(text),
  public.accept_invitation(text),
  public.set_member_status(uuid, public.member_status),
  public.update_member_name(uuid, text),
  public.resolve_tie(uuid, uuid[], text),
  public.list_audit_logs(uuid, text, timestamptz, timestamptz, int, int)
FROM PUBLIC, anon;

-- Trigger function: never callable directly by anyone
REVOKE EXECUTE ON FUNCTION public.block_publish_with_unresolved_ties() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.group_voting_in_progress(uuid),
  public.invite_members(uuid, jsonb),
  public.resend_invitation(uuid),
  public.revoke_invitation(uuid),
  public.get_invitation_preview(text),
  public.accept_invitation(text),
  public.set_member_status(uuid, public.member_status),
  public.update_member_name(uuid, text),
  public.resolve_tie(uuid, uuid[], text),
  public.list_audit_logs(uuid, text, timestamptz, timestamptz, int, int)
TO authenticated;

-- The invitation landing page must work before the invitee signs in
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon;