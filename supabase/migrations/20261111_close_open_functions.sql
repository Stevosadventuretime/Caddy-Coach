-- Step 8: close the four database helper functions that anyone could call without signing in.
-- Nothing a signed-out visitor sees changes: course data stays readable and the scorecard rules behave the same.

-- 1. rls_auto_enable runs on its own when a table is created; nobody needs to call it.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. my_username / is_app_owner / is_club_admin: signed-in users only (the app only calls them when signed in).
revoke execute on function public.my_username() from public, anon;
revoke execute on function public.is_app_owner() from public, anon;
revoke execute on function public.is_club_admin(text) from public, anon;
grant execute on function public.my_username() to authenticated, service_role;
grant execute on function public.is_app_owner() to authenticated, service_role;
grant execute on function public.is_club_admin(text) to authenticated, service_role;

-- 3. course_cards' two rules applied to everyone and called my_username(), which a signed-out visitor can no longer run.
-- Split each into a signed-in rule (exactly as before) and a signed-out rule that gives the same answer without it.
drop policy if exists cards_read on public.course_cards;
drop policy if exists cards_write on public.course_cards;
create policy cards_read on public.course_cards for select to authenticated using (
  (split_part(course_key, '~', 1) <> all (array['bag', 'hcp', 'fb'])) or (owner = auth.uid())
  or ((owner is null) and (split_part(course_key, '~', 1) = any (array['bag', 'hcp'])) and (split_part(course_key, '~', 2) = public.my_username())));
create policy cards_read_anon on public.course_cards for select to anon using (
  split_part(course_key, '~', 1) <> all (array['bag', 'hcp', 'fb']));
create policy cards_write on public.course_cards for insert to authenticated with check (
  ((owner is null) or (owner = auth.uid())) and
  case split_part(course_key, '~', 1)
    when 'bag' then split_part(course_key, '~', 2) = public.my_username()
    when 'hcp' then split_part(course_key, '~', 2) = public.my_username()
    when 'lb' then (card ->> 'u') = public.my_username()
    when 'lbh' then (card ->> 'u') = public.my_username()
    when 'grp' then (card ->> 'u') = public.my_username()
    when 'comp' then (card ->> 'by') = public.my_username()
    else true end);
create policy cards_write_anon on public.course_cards for insert to anon with check (
  owner is null and split_part(course_key, '~', 1) <> all (array['bag', 'hcp', 'lb', 'lbh', 'grp', 'comp']));
