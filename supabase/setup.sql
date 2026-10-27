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

-- ============================================================================================
-- 9. Live pins, club admins and branding, usage counts, the Plus tier and coach accounts.

-- ---- weather cache (only the cc-weather server function reads or writes it) ----
create table if not exists public.weather_cache (
  key text primary key,
  data jsonb not null,
  at timestamptz not null default now()
);
alter table public.weather_cache enable row level security;

-- ---- app owners (can see usage numbers and appoint club admins) ----
create table if not exists public.app_owners (username text primary key);
alter table public.app_owners enable row level security;
insert into public.app_owners (username) values ('stevosadventuretime') on conflict do nothing;
create or replace function public.is_app_owner() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.app_owners where username = public.my_username()) $$;
grant execute on function public.is_app_owner() to anon, authenticated;

-- ---- clubs: branding, and who runs the club in Caddy Coach ----
create table if not exists public.club_admins (
  club_key text not null check (char_length(club_key) between 2 and 120),
  username text not null,
  added_at timestamptz not null default now(),
  primary key (club_key, username)
);
alter table public.club_admins enable row level security;
drop policy if exists club_admins_read on public.club_admins;
create policy club_admins_read on public.club_admins for select using (true);

create or replace function public.is_club_admin(k text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.club_admins where club_key = k and username = public.my_username()) $$;
grant execute on function public.is_club_admin(text) to anon, authenticated;

create table if not exists public.clubs (
  club_key text primary key check (char_length(club_key) between 2 and 120),
  name text check (char_length(name) <= 120),
  colour text check (colour is null or colour ~ '^#[0-9a-fA-F]{6}$'),
  welcome text check (char_length(welcome) <= 400),
  logo text check (logo is null or (logo like 'data:image/%' and char_length(logo) < 60000)),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.clubs enable row level security;
drop policy if exists clubs_read on public.clubs;
drop policy if exists clubs_insert on public.clubs;
drop policy if exists clubs_update on public.clubs;
create policy clubs_read on public.clubs for select using (true);
create policy clubs_insert on public.clubs for insert to authenticated with check (public.is_club_admin(club_key));
create policy clubs_update on public.clubs for update to authenticated using (public.is_club_admin(club_key)) with check (public.is_club_admin(club_key));

-- the app owner appoints or removes a club admin
create or replace function public.cc_set_club_admin(k text, u text, make boolean) returns void
  language plpgsql security definer set search_path = public
  as $$ begin
    if not public.is_app_owner() then raise exception 'only the app owner can do this'; end if;
    if make then insert into public.club_admins (club_key, username) values (k, lower(u)) on conflict do nothing;
    else delete from public.club_admins where club_key = k and username = lower(u); end if;
  end $$;
revoke all on function public.cc_set_club_admin(text, text, boolean) from public, anon;
grant execute on function public.cc_set_club_admin(text, text, boolean) to authenticated;

-- ---- live pin positions: golfers mark the hole, a club can publish its pin sheet ----
create table if not exists public.pins (
  id bigint generated always as identity primary key,
  course_key text not null check (char_length(course_key) between 2 and 120),
  hole smallint not null check (hole between 1 and 36),
  day date not null default ((now() at time zone 'Europe/London')::date),
  lat double precision not null check (lat between 49.8 and 60.9),
  lon double precision not null check (lon between -8.7 and 1.8),
  source text not null check (source in ('player', 'club')),
  username text not null,
  owner uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists pins_course_day on public.pins (course_key, day);
alter table public.pins enable row level security;
drop policy if exists pins_read on public.pins;
drop policy if exists pins_insert on public.pins;
drop policy if exists pins_delete on public.pins;
create policy pins_read on public.pins for select using (true);
create policy pins_insert on public.pins for insert to authenticated with check (
  owner = auth.uid() and username = public.my_username()
  and day between ((now() at time zone 'Europe/London')::date - 1) and ((now() at time zone 'Europe/London')::date + 1)
  and (source = 'player' or public.is_club_admin(course_key))
);
create policy pins_delete on public.pins for delete to authenticated using (owner = auth.uid());

-- ---- usage counts: anonymous (a one-way code per golfer, never the username) ----
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  day date not null default current_date,
  kind text not null check (kind in ('open', 'round', 'swing', 'trace', 'pin', 'practice', 'group', 'coach')),
  uhash text not null check (char_length(uhash) between 8 and 64),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_day on public.usage_events (day);
alter table public.usage_events enable row level security;
drop policy if exists usage_insert on public.usage_events;
create policy usage_insert on public.usage_events for insert to anon, authenticated with check (day = current_date);

create or replace function public.cc_usage_summary() returns jsonb
  language plpgsql stable security definer set search_path = public
  as $$ declare out jsonb; begin
    if not public.is_app_owner() then raise exception 'only the app owner can see this'; end if;
    with weeks as (
      select date_trunc('week', day)::date as wk, count(distinct uhash) as golfers
      from public.usage_events where day > current_date - 63 group by 1 order by 1),
    kinds as (
      select kind, count(*) as n from public.usage_events where day > current_date - 30 group by kind),
    firsts as (select uhash, min(day) as first_day from public.usage_events group by uhash),
    cohort as (select uhash from firsts where first_day between current_date - 56 and current_date - 28),
    back as (select count(distinct c.uhash) as n from cohort c join public.usage_events e on e.uhash = c.uhash and e.day > current_date - 28)
    select jsonb_build_object(
      'weeks', coalesce((select jsonb_agg(jsonb_build_object('wk', wk, 'golfers', golfers)) from weeks), '[]'::jsonb),
      'kinds', coalesce((select jsonb_object_agg(kind, n) from kinds), '{}'::jsonb),
      'golfers_total', (select count(*) from firsts),
      'golfers_7d', (select count(distinct uhash) from public.usage_events where day > current_date - 7),
      'cohort', (select count(*) from cohort),
      'cohort_back', (select n from back),
      'profiles', (select count(*) from public.profiles),
      'with_password', (select count(*) from public.profiles where auth_id is not null)
    ) into out;
    return out; end $$;
revoke all on function public.cc_usage_summary() from public, anon;
grant execute on function public.cc_usage_summary() to authenticated;

-- ---- Caddy Coach Plus: written only by the cc-stripe-webhook server function ----
create table if not exists public.entitlements (
  auth_id uuid primary key references auth.users (id) on delete cascade,
  plan text,
  status text,
  current_period_end timestamptz,
  stripe_customer text unique,
  stripe_subscription text,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists entitlements_read_own on public.entitlements;
create policy entitlements_read_own on public.entitlements for select to authenticated using (auth_id = auth.uid());

-- ---- coach accounts ----
create table if not exists public.coach_profiles (
  username text primary key,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  owner uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.coach_profiles enable row level security;
drop policy if exists coach_read on public.coach_profiles;
drop policy if exists coach_insert on public.coach_profiles;
drop policy if exists coach_delete on public.coach_profiles;
create policy coach_read on public.coach_profiles for select using (true);
create policy coach_insert on public.coach_profiles for insert to authenticated with check (owner = auth.uid() and username = public.my_username());
create policy coach_delete on public.coach_profiles for delete to authenticated using (owner = auth.uid());

create table if not exists public.coach_links (
  coach text not null references public.coach_profiles (username) on delete cascade,
  student text not null,
  created_at timestamptz not null default now(),
  primary key (coach, student)
);
alter table public.coach_links enable row level security;
drop policy if exists links_read on public.coach_links;
drop policy if exists links_insert on public.coach_links;
drop policy if exists links_delete on public.coach_links;
create policy links_read on public.coach_links for select to authenticated using (coach = public.my_username() or student = public.my_username());
create policy links_insert on public.coach_links for insert to authenticated with check (student = public.my_username() and coach <> student);
create policy links_delete on public.coach_links for delete to authenticated using (coach = public.my_username() or student = public.my_username());

create table if not exists public.shared_swings (
  id bigint generated always as identity primary key,
  student text not null,
  coach text not null,
  swing jsonb not null check (jsonb_typeof(swing) = 'object' and pg_column_size(swing) < 600000),
  created_at timestamptz not null default now()
);
create index if not exists shared_swings_coach on public.shared_swings (coach, created_at desc);
create index if not exists shared_swings_student on public.shared_swings (student, created_at desc);
alter table public.shared_swings enable row level security;
drop policy if exists ss_read on public.shared_swings;
drop policy if exists ss_insert on public.shared_swings;
drop policy if exists ss_delete on public.shared_swings;
create policy ss_read on public.shared_swings for select to authenticated using (coach = public.my_username() or student = public.my_username());
create policy ss_insert on public.shared_swings for insert to authenticated with check (
  student = public.my_username() and exists (select 1 from public.coach_links l where l.coach = shared_swings.coach and l.student = shared_swings.student));
create policy ss_delete on public.shared_swings for delete to authenticated using (student = public.my_username());

create table if not exists public.swing_notes (
  id bigint generated always as identity primary key,
  swing_id bigint not null references public.shared_swings (id) on delete cascade,
  coach text not null,
  note text not null check (char_length(note) between 1 and 2000),
  drill text check (char_length(drill) <= 120),
  created_at timestamptz not null default now()
);
alter table public.swing_notes enable row level security;
drop policy if exists notes_read on public.swing_notes;
drop policy if exists notes_insert on public.swing_notes;
create policy notes_read on public.swing_notes for select to authenticated using (
  exists (select 1 from public.shared_swings s where s.id = swing_id and (s.coach = public.my_username() or s.student = public.my_username())));
create policy notes_insert on public.swing_notes for insert to authenticated with check (
  coach = public.my_username() and exists (select 1 from public.shared_swings s where s.id = swing_id and s.coach = public.my_username()));

grant select on public.club_admins, public.clubs, public.pins, public.coach_profiles to anon, authenticated;
grant insert, update on public.clubs to authenticated;
grant insert, delete on public.pins to authenticated;
grant insert on public.usage_events to anon, authenticated;
grant select on public.entitlements to authenticated;
grant insert, delete on public.coach_profiles to authenticated;
grant select, insert, delete on public.coach_links, public.shared_swings to authenticated;
grant select, insert on public.swing_notes to authenticated;

-- ---- "Delete my account" also removes the new data ----
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = public, auth
  as $$
  declare u text;
  begin
    if auth.uid() is null then raise exception 'not logged in'; end if;
    select username into u from public.profiles where auth_id = auth.uid();
    delete from public.course_cards where owner = auth.uid();
    delete from public.pins where owner = auth.uid();
    if u is not null then
      delete from public.course_cards where split_part(course_key,'~',1) in ('bag','hcp') and split_part(course_key,'~',2) = u;
      delete from public.course_cards where split_part(course_key,'~',1) in ('lb','lbh','grp') and card->>'u' = u;
      delete from public.shared_swings where student = u or coach = u;
      delete from public.coach_links where student = u or coach = u;
      delete from public.coach_profiles where username = u;
      delete from public.club_admins where username = u;
    end if;
    delete from public.profiles where auth_id = auth.uid();
    delete from auth.users where id = auth.uid();
  end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 10. (Applied 26 Oct.) Rows in the new tables belong to a golfer: when their profile or login is deleted,
--     these go with it automatically, so "Delete my account" removes them too.
alter table public.pins add constraint pins_owner_fk foreign key (owner) references auth.users (id) on delete cascade;
alter table public.coach_profiles add constraint coach_profiles_user_fk foreign key (username) references public.profiles (username) on delete cascade;
alter table public.coach_links add constraint coach_links_student_fk foreign key (student) references public.profiles (username) on delete cascade;
alter table public.shared_swings add constraint shared_swings_student_fk foreign key (student) references public.profiles (username) on delete cascade;
alter table public.shared_swings add constraint shared_swings_coach_fk foreign key (coach) references public.profiles (username) on delete cascade;
alter table public.club_admins add constraint club_admins_user_fk foreign key (username) references public.profiles (username) on delete cascade;
