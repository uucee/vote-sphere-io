DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;
CREATE POLICY "Invitees can view their own invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Signed-in users can read platform settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND key NOT ILIKE '%secret%' AND key NOT ILIKE '%key%');

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs for their groups" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'global_admin')
      OR (group_id IS NOT NULL AND (public.is_group_admin(auth.uid(), group_id) OR public.is_group_member(auth.uid(), group_id)))
    )
  );