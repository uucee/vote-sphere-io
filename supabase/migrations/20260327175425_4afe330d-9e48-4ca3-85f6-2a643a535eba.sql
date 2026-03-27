
-- Allow the handle_new_user trigger to insert profiles (runs as SECURITY DEFINER, but also allow direct inserts)
CREATE POLICY "Allow insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
