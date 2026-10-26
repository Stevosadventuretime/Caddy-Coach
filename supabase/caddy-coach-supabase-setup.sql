-- =====================================================================================================
-- Caddy Coach: proper logins and per-user permissions
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all of this > Run.
-- It is safe to run more than once.
--
-- BEFORE YOU RUN IT, change one setting:
--   Authentication > Sign In / Providers > Email: turn OFF "Confirm email".
--   (Caddy Coach logs people in with their username. Behind the scenes each account has an address like
--    owen_s@users.caddycoach.app that nobody reads, so a confirmation email would never arrive.)
-- Also in Authentication > Sign In / Providers > Email, set "Minimum password length" to 10.
-- =====================================================================================================

-- 1. Profiles belong to a login. A username can only exist once, whatever its capitals.
alter table public.profiles add column if not exists auth_id uuid unique references auth.users(id) on delete set null;
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

-- 2. Shared rows remember who wrote them.
alter table public.course_cards add column if not exists owner uuid default auth.uid();

-- 3. Whose username is this login? (used by the rules below)
create or replace function public.my_username() returns text
  language sql stable security definer set search_path = public
  as $$ select username from public.profiles where auth_id = auth.uid() $$;
grant execute on function public.my_username() to anon, authenticated;

-- 4. Start the rules afresh: remove every existing policy on these tables
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('profiles','course_cards','hole_maps') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
alter table public.profiles enable row level security;
alter table public.course_cards enable row level security;
alter table public.hole_maps enable row level security;

-- ---- profiles ----
-- anyone can look up a username (to see it's taken, and for names on leaderboards)
create policy profiles_read on public.profiles for select using (true);
-- you can only create a profile for your own login
create policy profiles_create on public.profiles for insert to authenticated with check (auth_id = auth.uid());
-- you can only change your own profile. A profile from the "every password is 1234" days (no login yet) can be
-- linked to a login once, when its owner chooses their new password. See step 7 to close this once everyone has moved over.
create policy profiles_update on public.profiles for update to authenticated
  using (auth_id = auth.uid() or auth_id is null) with check (auth_id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using (auth_id = auth.uid());

-- ---- course_cards (scorecards, your bag, your handicap record, leaderboards, competitions, group rounds, feedback) ----
-- personal rows (bag~you, hcp~you, fb~...) are only readable by the person who wrote them; everything else is shared
create policy cards_read on public.course_cards for select using (
  split_part(course_key, '~', 1) not in ('bag', 'hcp', 'fb')
  or owner = auth.uid()
  or (owner is null and split_part(course_key, '~', 1) in ('bag','hcp') and split_part(course_key, '~', 2) = public.my_username())
);
create policy cards_write on public.course_cards for insert with check (
  (owner is null or owner = auth.uid())
  and case split_part(course_key, '~', 1)
    when 'bag'  then auth.uid() is not null and split_part(course_key, '~', 2) = public.my_username()
    when 'hcp'  then auth.uid() is not null and split_part(course_key, '~', 2) = public.my_username()
    when 'lb'   then auth.uid() is not null and card->>'u' = public.my_username()
    when 'lbh'  then auth.uid() is not null and card->>'u' = public.my_username()
    when 'grp'  then auth.uid() is not null and card->>'u' = public.my_username()
    when 'comp' then auth.uid() is not null and card->>'by' = public.my_username()
    else true
  end
);
create policy cards_delete on public.course_cards for delete to authenticated using (owner = auth.uid());

-- ---- hole_maps (greens and tees mapped by golfers): shared, anyone may add, nobody may change or remove ----
create policy holes_read on public.hole_maps for select using (true);
create policy holes_write on public.hole_maps for insert with check (true);

-- 5. "Delete my account": removes the profile, the personal rows, leaderboard entries and the login itself
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = public, auth
  as $$
  declare u text;
  begin
    if auth.uid() is null then raise exception 'not logged in'; end if;
    select username into u from public.profiles where auth_id = auth.uid();
    delete from public.course_cards where owner = auth.uid();
    if u is not null then
      delete from public.course_cards where split_part(course_key,'~',1) in ('bag','hcp') and split_part(course_key,'~',2) = u;
      delete from public.course_cards where split_part(course_key,'~',1) in ('lb','lbh','grp') and card->>'u' = u;
    end if;
    delete from public.profiles where auth_id = auth.uid();
    delete from auth.users where id = auth.uid();
  end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 6. Make sure the app's roles can use the tables (normally already the case)
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;
grant select, insert, delete on public.course_cards to anon, authenticated;
grant select, insert on public.hole_maps to anon, authenticated;

-- 7. LATER: once every tester has chosen their own password (check: select username from profiles where auth_id is null),
--    run these two lines so an unclaimed profile can never be taken over:
--      drop policy profiles_update on public.profiles;
--      create policy profiles_update on public.profiles for update to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- 8. Emails for password resets (already applied to your project). The email behind a login, found by username or email.
--    Only the app's own server function (cc-auth) can call it, so golfers' emails are never readable from the app.
create or replace function public.cc_login_email(who text) returns text
  language sql stable security definer set search_path = public, auth
as $$
  select coalesce(
    (select u.email::text from auth.users u where position('@' in who) > 0 and lower(u.email) = lower(who) limit 1),
    (select u.email::text from auth.users u join public.profiles p on p.auth_id = u.id where position('@' in who) = 0 and lower(p.username) = lower(who) limit 1),
    (select u.email::text from auth.users u where position('@' in who) = 0
       and lower(u.raw_user_meta_data->>'username') = lower(who)
       and not exists (select 1 from public.profiles p where lower(p.username) = lower(who) and p.auth_id is not null)
     order by u.created_at limit 1))
$$;
revoke all on function public.cc_login_email(text) from public, anon, authenticated;
grant execute on function public.cc_login_email(text) to service_role;
