-- C2: a golfer's profile (name, photo, home course and its location) is readable only by that golfer and the app owner.
-- Everyone else can only ask whether a username exists and whether it has a login (for sign-up and log-in).

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (auth_id = auth.uid() or public.is_app_owner());

create or replace function public.cc_profile_exists(u text)
returns table (username text, has_login boolean)
language sql stable security definer set search_path = public as $$
  select p.username, p.auth_id is not null from public.profiles p where p.username = lower(trim(u)) limit 1
$$;
revoke all on function public.cc_profile_exists(text) from public;
grant execute on function public.cc_profile_exists(text) to anon, authenticated, service_role;
