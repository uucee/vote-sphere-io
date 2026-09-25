-- =====================================================================
-- VoteWell Secure: election integrity hardening
-- Apply verbatim as ONE migration. Do not edit, reorder or split.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Clean up existing data so the new constraints can be created
-- ---------------------------------------------------------------------
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY position_id, member_id
                                ORDER BY cast_at DESC, id DESC) AS rn
  FROM public.votes WHERE is_latest
)
UPDATE public.votes v SET is_latest = false
FROM ranked r WHERE v.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY position_id, nominated_by_member_id, nominee_member_id
                                ORDER BY created_at, id) AS rn
  FROM public.nominations WHERE is_valid
)
UPDATE public.nominations n SET is_valid = false, cancelled_at = now()
FROM ranked r WHERE n.id = r.id AND r.rn > 1;

-- One latest vote per member per position
CREATE UNIQUE INDEX uq_votes_one_latest
  ON public.votes (position_id, member_id) WHERE is_latest;
-- A member can nominate the same person for the same position only once
CREATE UNIQUE INDEX uq_nominations_once
  ON public.nominations (position_id, nominated_by_member_id, nominee_member_id) WHERE is_valid;
-- A user can hold only one membership record per group (prevents double voting)
CREATE UNIQUE INDEX uq_members_group_user
  ON public.members (group_id, user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 1. VOTES: no direct table access at all. Everything goes through functions.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can cast votes" ON public.votes;
DROP POLICY IF EXISTS "Members can view own votes" ON public.votes;
DROP POLICY IF EXISTS "Group admins can view vote counts" ON public.votes;
REVOKE ALL ON public.votes FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. NOMINATIONS: read-only for clients; inserts via submit_nomination()
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Group admins can manage nominations" ON public.nominations;
DROP POLICY IF EXISTS "Members can create nominations" ON public.nominations;
DROP POLICY IF EXISTS "Members can view nominations" ON public.nominations;

CREATE POLICY "Group admins can view nominations" ON public.nominations
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Members can view nominations they made" ON public.nominations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m
                 WHERE m.id = nominated_by_member_id AND m.user_id = auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.nominations FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. CANDIDATE SELECTIONS: read-only for clients; writes via functions
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Group admins can manage candidates" ON public.candidate_selections;
DROP POLICY IF EXISTS "Candidates can update own status" ON public.candidate_selections;
-- "Members can view candidates" is kept unchanged.
CREATE POLICY "Group admins can view candidates" ON public.candidate_selections
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
REVOKE INSERT, UPDATE, DELETE ON public.candidate_selections FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. ELECTIONS: admins may create/edit/delete only while in draft.
--    Status changes happen only through advance_election().
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Group admins can manage elections" ON public.election_cycles;

CREATE POLICY "Group admins can view elections" ON public.election_cycles
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Group admins can create draft elections" ON public.election_cycles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(auth.uid(), group_id) AND status = 'draft');
CREATE POLICY "Group admins can edit draft elections" ON public.election_cycles
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id) AND status = 'draft')
  WITH CHECK (public.is_group_admin(auth.uid(), group_id) AND status = 'draft');
CREATE POLICY "Group admins can delete draft elections" ON public.election_cycles
  FOR DELETE TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id) AND status = 'draft');

-- ---------------------------------------------------------------------
-- 5. POSITIONS: admins may change positions only while the election is draft
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_draft_election_of_group(_election_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.election_cycles
                 WHERE id = _election_id AND group_id = _group_id AND status = 'draft')
$$;

DROP POLICY IF EXISTS "Group admins can manage positions" ON public.positions;

CREATE POLICY "Group admins can view positions" ON public.positions
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
CREATE POLICY "Group admins can add positions to draft elections" ON public.positions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(auth.uid(), group_id)
              AND public.is_draft_election_of_group(election_cycle_id, group_id));
CREATE POLICY "Group admins can edit positions in draft elections" ON public.positions
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id)
         AND public.is_draft_election_of_group(election_cycle_id, group_id))
  WITH CHECK (public.is_group_admin(auth.uid(), group_id)
              AND public.is_draft_election_of_group(election_cycle_id, group_id));
CREATE POLICY "Group admins can delete positions in draft elections" ON public.positions
  FOR DELETE TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id)
         AND public.is_draft_election_of_group(election_cycle_id, group_id));

-- ---------------------------------------------------------------------
-- 6. RESULTS: read-only for clients; generated only by advance_election()
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Group admins can manage results" ON public.result_summaries;
CREATE POLICY "Group admins can view results" ON public.result_summaries
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
REVOKE INSERT, UPDATE, DELETE ON public.result_summaries FROM anon, authenticated;

DROP POLICY IF EXISTS "Group admins can manage publications" ON public.result_publications;
CREATE POLICY "Group admins can view publications" ON public.result_publications
  FOR SELECT TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));
REVOKE INSERT, UPDATE, DELETE ON public.result_publications FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. GROUPS: organisations are created only through create_organisation()
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

-- Whether members may change a vote in this election.
-- Election setting wins; otherwise group setting; otherwise NOT allowed.
CREATE OR REPLACE FUNCTION public.vote_editing_allowed(p_election_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(e.allow_vote_editing, gs.allow_vote_editing, false)
  FROM public.election_cycles e
  LEFT JOIN public.group_settings gs ON gs.group_id = e.group_id
  WHERE e.id = p_election_id
    AND (public.is_group_member(auth.uid(), e.group_id)
         OR public.is_group_admin(auth.uid(), e.group_id))
$$;

-- Cast or change a vote. The voter is always derived from the session.
CREATE OR REPLACE FUNCTION public.cast_vote(p_position_id uuid, p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_pos       public.positions%ROWTYPE;
  v_el        public.election_cycles%ROWTYPE;
  v_member_id uuid;
  v_existing  public.votes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_pos FROM public.positions WHERE id = p_position_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSITION_NOT_FOUND'; END IF;

  -- Share-lock the election so it cannot be closed part-way through this vote
  SELECT * INTO v_el FROM public.election_cycles WHERE id = v_pos.election_cycle_id FOR SHARE;
  IF v_el.status <> 'voting_open'
     OR (v_el.voting_start IS NOT NULL AND now() < v_el.voting_start)
     OR (v_el.voting_end   IS NOT NULL AND now() > v_el.voting_end) THEN
    RAISE EXCEPTION 'VOTING_CLOSED';
  END IF;

  -- Lock the voter's membership row: serialises concurrent votes by the same person
  SELECT id INTO v_member_id FROM public.members
   WHERE group_id = v_pos.group_id AND user_id = v_uid AND status = 'active'
   FOR UPDATE;
  IF v_member_id IS NULL THEN RAISE EXCEPTION 'NOT_AN_ELIGIBLE_MEMBER'; END IF;

  PERFORM 1 FROM public.candidate_selections
   WHERE id = p_candidate_id AND position_id = p_position_id
     AND status IN ('accepted', 'qualified');
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_CANDIDATE'; END IF;

  SELECT * INTO v_existing FROM public.votes
   WHERE position_id = p_position_id AND member_id = v_member_id AND is_latest;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.candidate_id = p_candidate_id THEN RETURN; END IF;
    IF NOT public.vote_editing_allowed(v_el.id) THEN RAISE EXCEPTION 'VOTE_ALREADY_CAST'; END IF;
    UPDATE public.votes SET is_latest = false WHERE id = v_existing.id;
  END IF;

  INSERT INTO public.votes (group_id, election_cycle_id, position_id, member_id, candidate_id, is_latest)
  VALUES (v_pos.group_id, v_el.id, p_position_id, v_member_id, p_candidate_id, true);

  -- Audit records THAT a vote happened, never WHO it was for
  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_pos.group_id, v_uid,
          CASE WHEN v_existing.id IS NULL THEN 'vote_cast' ELSE 'vote_changed' END,
          'position', p_position_id, '{}'::jsonb);
END;
$$;

-- The caller's own current selections for an election
CREATE OR REPLACE FUNCTION public.get_my_ballot(p_election_id uuid)
RETURNS TABLE (position_id uuid, candidate_id uuid, cast_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.position_id, v.candidate_id, v.cast_at
  FROM public.votes v
  JOIN public.members m ON m.id = v.member_id
  WHERE v.election_cycle_id = p_election_id AND v.is_latest AND m.user_id = auth.uid()
$$;

-- Admin-only turnout: how many have voted, never for whom
CREATE OR REPLACE FUNCTION public.get_turnout(p_election_id uuid)
RETURNS TABLE (position_id uuid, voters bigint, eligible bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id,
         (SELECT count(*) FROM public.votes v WHERE v.position_id = p.id AND v.is_latest),
         (SELECT count(*) FROM public.members m WHERE m.group_id = p.group_id AND m.status = 'active')
  FROM public.positions p
  JOIN public.election_cycles e ON e.id = p.election_cycle_id
  WHERE e.id = p_election_id AND p.is_active
    AND public.is_group_admin(auth.uid(), e.group_id)
$$;

-- Submit a nomination. The nominator is always derived from the session.
CREATE OR REPLACE FUNCTION public.submit_nomination(p_position_id uuid, p_nominee_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_pos       public.positions%ROWTYPE;
  v_el        public.election_cycles%ROWTYPE;
  v_nominator uuid;
  v_id        uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_pos FROM public.positions WHERE id = p_position_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'POSITION_NOT_FOUND'; END IF;

  SELECT * INTO v_el FROM public.election_cycles WHERE id = v_pos.election_cycle_id FOR SHARE;
  IF v_el.status <> 'nominations_open'
     OR (v_el.nomination_start IS NOT NULL AND now() < v_el.nomination_start)
     OR (v_el.nomination_end   IS NOT NULL AND now() > v_el.nomination_end) THEN
    RAISE EXCEPTION 'NOMINATIONS_CLOSED';
  END IF;

  SELECT id INTO v_nominator FROM public.members
   WHERE group_id = v_pos.group_id AND user_id = v_uid AND status = 'active';
  IF v_nominator IS NULL THEN RAISE EXCEPTION 'NOT_AN_ELIGIBLE_MEMBER'; END IF;

  PERFORM 1 FROM public.members
   WHERE id = p_nominee_member_id AND group_id = v_pos.group_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_NOMINEE'; END IF;

  BEGIN
    INSERT INTO public.nominations (group_id, position_id, nominee_member_id, nominated_by_member_id)
    VALUES (v_pos.group_id, p_position_id, p_nominee_member_id, v_nominator)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_NOMINATED';
  END;

  RETURN v_id;
END;
$$;

-- A shortlisted candidate accepts or declines their own candidacy
CREATE OR REPLACE FUNCTION public.respond_to_candidacy(p_candidate_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cs     public.candidate_selections%ROWTYPE;
  v_status public.election_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT cs.* INTO v_cs
  FROM public.candidate_selections cs
  JOIN public.members m ON m.id = cs.member_id
  WHERE cs.id = p_candidate_id AND m.user_id = auth.uid() AND m.status = 'active'
  FOR UPDATE OF cs;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDACY_NOT_FOUND'; END IF;

  SELECT e.status INTO v_status
  FROM public.positions p JOIN public.election_cycles e ON e.id = p.election_cycle_id
  WHERE p.id = v_cs.position_id;
  IF v_status <> 'candidate_acceptance' THEN RAISE EXCEPTION 'ACCEPTANCE_CLOSED'; END IF;
  IF v_cs.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_RESPONDED'; END IF;

  UPDATE public.candidate_selections
     SET status = CASE WHEN p_accept THEN 'accepted'::public.candidate_status
                       ELSE 'rejected'::public.candidate_status END,
         responded_at = now()
   WHERE id = p_candidate_id;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_cs.group_id, auth.uid(),
          CASE WHEN p_accept THEN 'candidacy_accepted' ELSE 'candidacy_declined' END,
          'candidate_selection', p_candidate_id, '{}'::jsonb);
END;
$$;

-- Move an election one step along its lifecycle, atomically.
-- p_expected_status guards against double-clicks and stale screens.
CREATE OR REPLACE FUNCTION public.advance_election(p_election_id uuid, p_expected_status public.election_status)
RETURNS public.election_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_el   public.election_cycles%ROWTYPE;
  v_next public.election_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_el FROM public.election_cycles WHERE id = p_election_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_admin(auth.uid(), v_el.group_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORISED';
  END IF;
  IF v_el.status <> p_expected_status THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;

  v_next := CASE v_el.status
    WHEN 'draft'                THEN 'nominations_open'::public.election_status
    WHEN 'nominations_open'     THEN 'nominations_closed'::public.election_status
    WHEN 'nominations_closed'   THEN 'candidate_review'::public.election_status
    WHEN 'candidate_review'     THEN 'candidate_acceptance'::public.election_status
    WHEN 'candidate_acceptance' THEN 'ready_for_voting'::public.election_status
    WHEN 'ready_for_voting'     THEN 'voting_open'::public.election_status
    WHEN 'voting_open'          THEN 'voting_closed'::public.election_status
    WHEN 'voting_closed'        THEN 'result_review'::public.election_status
    WHEN 'result_review'        THEN 'published'::public.election_status
    ELSE NULL
  END;
  IF v_next IS NULL THEN RAISE EXCEPTION 'NO_FURTHER_STEP'; END IF;

  -- draft -> nominations_open: must have at least one active position
  IF v_next = 'nominations_open' AND NOT EXISTS (
       SELECT 1 FROM public.positions WHERE election_cycle_id = v_el.id AND is_active) THEN
    RAISE EXCEPTION 'NO_POSITIONS';
  END IF;

  -- candidate_review -> candidate_acceptance: shortlist the top N nominees per position.
  -- Ties at the cut-off are ALL included (RANK), so a shortlist can exceed max_candidates.
  IF v_next = 'candidate_acceptance' THEN
    INSERT INTO public.candidate_selections (group_id, position_id, member_id, nomination_count, status)
    SELECT v_el.group_id, r.position_id, r.nominee_member_id, r.cnt, 'pending'
    FROM (
      SELECT n.position_id, n.nominee_member_id, p.max_candidates,
             count(*)::int AS cnt,
             RANK() OVER (PARTITION BY n.position_id ORDER BY count(*) DESC) AS rnk
      FROM public.nominations n
      JOIN public.positions p ON p.id = n.position_id
      JOIN public.members m   ON m.id = n.nominee_member_id AND m.status = 'active'
      WHERE p.election_cycle_id = v_el.id AND p.is_active AND n.is_valid
      GROUP BY n.position_id, n.nominee_member_id, p.max_candidates
    ) r
    WHERE r.rnk <= r.max_candidates
    ON CONFLICT (position_id, member_id)
      DO UPDATE SET nomination_count = EXCLUDED.nomination_count;
  END IF;

  -- candidate_acceptance -> ready_for_voting: every active position needs an accepted candidate
  IF v_next = 'ready_for_voting' AND EXISTS (
       SELECT 1 FROM public.positions p
       WHERE p.election_cycle_id = v_el.id AND p.is_active
         AND NOT EXISTS (SELECT 1 FROM public.candidate_selections cs
                         WHERE cs.position_id = p.id AND cs.status IN ('accepted', 'qualified'))) THEN
    RAISE EXCEPTION 'POSITION_WITHOUT_CANDIDATES';
  END IF;

  -- voting_closed -> result_review: count latest votes into result_summaries.
  -- Ties at the winning cut-off mark ALL tied candidates as winners; the UI must flag this.
  IF v_next = 'result_review' THEN
    DELETE FROM public.result_summaries WHERE election_cycle_id = v_el.id;
    INSERT INTO public.result_summaries
      (group_id, election_cycle_id, position_id, candidate_id, vote_count, rank, is_winner)
    SELECT v_el.group_id, v_el.id, t.position_id, t.candidate_id, t.vote_count, t.rnk,
           (t.rnk <= t.max_winners AND t.vote_count > 0)
    FROM (
      SELECT cs.position_id, cs.id AS candidate_id, p.max_winners,
             count(v.id)::int AS vote_count,
             RANK() OVER (PARTITION BY cs.position_id ORDER BY count(v.id) DESC)::int AS rnk
      FROM public.candidate_selections cs
      JOIN public.positions p ON p.id = cs.position_id
      LEFT JOIN public.votes v ON v.candidate_id = cs.id AND v.is_latest
      WHERE p.election_cycle_id = v_el.id AND p.is_active
        AND cs.status IN ('accepted', 'qualified')
      GROUP BY cs.position_id, cs.id, p.max_winners
    ) t;
  END IF;

  -- result_review -> published: record the publication
  IF v_next = 'published' THEN
    INSERT INTO public.result_publications (group_id, election_cycle_id, published_by)
    VALUES (v_el.group_id, v_el.id, auth.uid());
  END IF;

  UPDATE public.election_cycles SET status = v_next WHERE id = v_el.id;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_el.group_id, auth.uid(), 'election_status_changed', 'election_cycle', v_el.id,
          jsonb_build_object('from', v_el.status, 'to', v_next));

  RETURN v_next;
END;
$$;

-- Create the organisation a user registered for, once their email is confirmed.
-- Organisation name comes from sign-up metadata (org_name). Idempotent.
CREATE OR REPLACE FUNCTION public.create_organisation()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_confirmed timestamptz;
  v_meta      jsonb;
  v_name      text;
  v_group_id  uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT email_confirmed_at, raw_user_meta_data INTO v_confirmed, v_meta
  FROM auth.users WHERE id = v_uid;
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'EMAIL_NOT_CONFIRMED'; END IF;

  SELECT group_id INTO v_group_id FROM public.group_admins
   WHERE user_id = v_uid AND is_primary LIMIT 1;
  IF v_group_id IS NOT NULL THEN RETURN v_group_id; END IF;

  v_name := nullif(trim(v_meta ->> 'org_name'), '');
  IF v_name IS NULL THEN RAISE EXCEPTION 'NO_PENDING_ORGANISATION'; END IF;

  INSERT INTO public.groups (name, created_by) VALUES (left(v_name, 200), v_uid)
  RETURNING id INTO v_group_id;
  INSERT INTO public.group_admins (group_id, user_id, is_primary) VALUES (v_group_id, v_uid, true);
  INSERT INTO public.group_settings (group_id) VALUES (v_group_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'group_admin')
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_logs (group_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_group_id, v_uid, 'organisation_created', 'group', v_group_id, '{}'::jsonb);

  RETURN v_group_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 8. Function permissions: signed-in users only
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.is_draft_election_of_group(uuid, uuid),
  public.vote_editing_allowed(uuid),
  public.cast_vote(uuid, uuid),
  public.get_my_ballot(uuid),
  public.get_turnout(uuid),
  public.submit_nomination(uuid, uuid),
  public.respond_to_candidacy(uuid, boolean),
  public.advance_election(uuid, public.election_status),
  public.create_organisation()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.is_draft_election_of_group(uuid, uuid),
  public.vote_editing_allowed(uuid),
  public.cast_vote(uuid, uuid),
  public.get_my_ballot(uuid),
  public.get_turnout(uuid),
  public.submit_nomination(uuid, uuid),
  public.respond_to_candidacy(uuid, boolean),
  public.advance_election(uuid, public.election_status),
  public.create_organisation()
TO authenticated;