-- Friends and private competitions (friends.js). Profiles stay private: friends only ever see a display name
-- (first name + initial) and the summary card each golfer chooses to share by adding a friend or joining a competition.

-- ---------- friend links ----------
create table if not exists public.friend_links (
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
alter table public.friend_links enable row level security;
drop policy if exists fl_read on public.friend_links;
create policy fl_read on public.friend_links for select to authenticated using (auth.uid() in (from_user, to_user));
drop policy if exists fl_accept on public.friend_links;
create policy fl_accept on public.friend_links for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid() and status = 'accepted');
drop policy if exists fl_remove on public.friend_links;
create policy fl_remove on public.friend_links for delete to authenticated using (auth.uid() in (from_user, to_user));
-- requests are only made through cc_friend_request (no direct insert)

-- ---------- private competitions ----------
create table if not exists public.friend_comps (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  owner      uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(name) between 1 and 60),
  format     text not null check (format in ('stableford', 'gross', 'putts', 'drive', 'improved')),
  starts     date not null,
  ends       date not null check (ends >= starts and ends - starts <= 366),
  created_at timestamptz not null default now()
);
create table if not exists public.friend_comp_members (
  comp_id   uuid not null references public.friend_comps(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (comp_id, user_id)
);
alter table public.friend_comps enable row level security;
alter table public.friend_comp_members enable row level security;
create or replace function public.cc_is_comp_member(c uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friend_comp_members m where m.comp_id = c and m.user_id = auth.uid())
$$;
drop policy if exists fc_read on public.friend_comps;
create policy fc_read on public.friend_comps for select to authenticated using (public.cc_is_comp_member(id));
drop policy if exists fc_make on public.friend_comps;   -- competitions are only made through cc_comp_make
drop policy if exists fc_drop on public.friend_comps;
create policy fc_drop on public.friend_comps for delete to authenticated using (owner = auth.uid());
drop policy if exists fcm_read on public.friend_comp_members;
create policy fcm_read on public.friend_comp_members for select to authenticated using (public.cc_is_comp_member(comp_id));
drop policy if exists fcm_leave on public.friend_comp_members;
create policy fcm_leave on public.friend_comp_members for delete to authenticated using (user_id = auth.uid());
-- joining (and the owner's own membership) only through cc_comp_make / cc_comp_join

-- ---------- the card each golfer shares ----------
create table if not exists public.friend_cards (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  card       jsonb not null,
  updated_at timestamptz not null default now(),
  check (pg_column_size(card) < 16000)
);
alter table public.friend_cards enable row level security;
create or replace function public.cc_can_see_card(u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select u = auth.uid()
    or exists (select 1 from public.friend_links l where l.status = 'accepted' and ((l.from_user = auth.uid() and l.to_user = u) or (l.to_user = auth.uid() and l.from_user = u)))
    or exists (select 1 from public.friend_comp_members a join public.friend_comp_members b on a.comp_id = b.comp_id where a.user_id = auth.uid() and b.user_id = u)
$$;
drop policy if exists fcard_read on public.friend_cards;
create policy fcard_read on public.friend_cards for select to authenticated using (public.cc_can_see_card(user_id));
drop policy if exists fcard_write on public.friend_cards;
create policy fcard_write on public.friend_cards for insert to authenticated with check (user_id = auth.uid());
drop policy if exists fcard_update on public.friend_cards;
create policy fcard_update on public.friend_cards for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- display name only: first name and the first letter of the last name, never the rest of the profile
create or replace function public.cc_display_name(u uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(left(p.last_name, 1), '')), ''), p.username)
  from public.profiles p where p.auth_id = u limit 1
$$;
revoke all on function public.cc_display_name(uuid) from public, anon, authenticated;

-- ---------- functions the app calls ----------
create or replace function public.cc_friend_request(uname text) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); them uuid;
begin
  if me is null then return 'signin'; end if;
  select p.auth_id into them from public.profiles p where lower(p.username) = lower(trim(uname)) limit 1;
  if them is null then return 'notfound'; end if;
  if them = me then return 'self'; end if;
  if exists (select 1 from public.friend_links where from_user = me and to_user = them) then return 'already'; end if;
  if exists (select 1 from public.friend_links where from_user = them and to_user = me) then
    update public.friend_links set status = 'accepted' where from_user = them and to_user = me; return 'accepted';
  end if;
  if (select count(*) from public.friend_links where from_user = me and created_at > now() - interval '1 day') >= 30 then return 'slow'; end if;
  insert into public.friend_links (from_user, to_user) values (me, them); return 'sent';
end $$;

create or replace function public.cc_friends() returns table (user_id uuid, name text, username text, status text, incoming boolean, card jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.u, public.cc_display_name(o.u), (select p.username from public.profiles p where p.auth_id = o.u limit 1), l.status, l.to_user = auth.uid(),
         case when l.status = 'accepted' then c.card end, case when l.status = 'accepted' then c.updated_at end
  from public.friend_links l
  cross join lateral (select case when l.from_user = auth.uid() then l.to_user else l.from_user end as u) o
  left join public.friend_cards c on c.user_id = o.u
  where auth.uid() in (l.from_user, l.to_user)
$$;

create or replace function public.cc_comp_make(nm text, fmt text, s date, e date) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c text; i int := 0; cid uuid;
begin
  if me is null then return null; end if;
  if (select count(*) from public.friend_comps where owner = me and created_at > now() - interval '1 day') >= 10 then return null; end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)); i := i + 1;   -- 6 hex characters, easy to read out
    exit when not exists (select 1 from public.friend_comps where code = c) or i > 5;
  end loop;
  insert into public.friend_comps (code, owner, name, format, starts, ends) values (c, me, left(nm, 60), fmt, s, e) returning id into cid;
  insert into public.friend_comp_members (comp_id, user_id) values (cid, me);
  return c;
end $$;

create or replace function public.cc_comp_join(cd text) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then return null; end if;
  select id into cid from public.friend_comps where code = upper(trim(cd)) limit 1;
  if cid is null then return null; end if;
  if (select count(*) from public.friend_comp_members where comp_id = cid) >= 50 then return null; end if;
  insert into public.friend_comp_members (comp_id, user_id) values (cid, me) on conflict do nothing;
  return cid;
end $$;

create or replace function public.cc_comps() returns table (id uuid, code text, name text, format text, starts date, ends date, mine boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.name, c.format, c.starts, c.ends, c.owner = auth.uid()
  from public.friend_comps c join public.friend_comp_members m on m.comp_id = c.id and m.user_id = auth.uid()
  order by c.ends desc
$$;

create or replace function public.cc_comp_board(cid uuid) returns table (user_id uuid, name text, card jsonb)
language sql stable security definer set search_path = public as $$
  select m.user_id, public.cc_display_name(m.user_id), c.card
  from public.friend_comp_members m left join public.friend_cards c on c.user_id = m.user_id
  where m.comp_id = cid and public.cc_is_comp_member(cid)
$$;

do $$ declare f text; begin
  foreach f in array array['cc_friend_request(text)', 'cc_friends()', 'cc_comp_make(text,text,date,date)', 'cc_comp_join(text)', 'cc_comps()', 'cc_comp_board(uuid)', 'cc_is_comp_member(uuid)', 'cc_can_see_card(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
