-- C1: only signed-in golfers can add shared course data, each row records the account that added it,
-- and the app owner can hide a bad row (set hidden = true in the Supabase table editor).
-- Rows added before this change keep working: they have no owner and are counted by phone, as before.

-- hole_maps: record the account, allow hiding
alter table public.hole_maps add column if not exists owner uuid default auth.uid();
alter table public.hole_maps add column if not exists hidden boolean not null default false;
create index if not exists hole_maps_owner_created on public.hole_maps (owner, created_at desc);

drop policy if exists holes_write on public.hole_maps;
drop policy if exists holes_read on public.hole_maps;
create policy holes_read on public.hole_maps for select to anon, authenticated using (not hidden);
create policy holes_write on public.hole_maps for insert to authenticated with check (
  owner = auth.uid() and not hidden   -- values are already checked by the table's own constraints
);

-- course_cards: allow hiding; signed-out visitors may only send feedback
alter table public.course_cards add column if not exists hidden boolean not null default false;
create index if not exists course_cards_owner_created on public.course_cards (owner, created_at desc);

drop policy if exists cards_write_anon on public.course_cards;
create policy cards_write_anon on public.course_cards for insert to anon with check (
  owner is null and not hidden
  and split_part(course_key, '~', 1) = 'fb'
);

drop policy if exists cards_write on public.course_cards;
create policy cards_write on public.course_cards for insert to authenticated with check (
  owner = auth.uid() and not hidden
  and case split_part(course_key, '~', 1)
    when 'bag'  then split_part(course_key, '~', 2) = my_username()
    when 'hcp'  then split_part(course_key, '~', 2) = my_username()
    when 'lb'   then (card ->> 'u') = my_username()
    when 'lbh'  then (card ->> 'u') = my_username()
    when 'grp'  then (card ->> 'u') = my_username()
    when 'comp' then (card ->> 'by') = my_username()
    else true
  end
);

drop policy if exists cards_read on public.course_cards;
create policy cards_read on public.course_cards for select to authenticated using (
  not hidden and (
    split_part(course_key, '~', 1) <> all (array['bag','hcp','fb'])
    or owner = auth.uid()
    or (owner is null and split_part(course_key, '~', 1) = any (array['bag','hcp'])
        and split_part(course_key, '~', 2) = my_username())
  )
);
drop policy if exists cards_read_anon on public.course_cards;
create policy cards_read_anon on public.course_cards for select to anon using (
  not hidden and split_part(course_key, '~', 1) <> all (array['bag','hcp','fb'])
);

-- a simple brake on floods: per account, at most 300 hole rows and 60 cards an hour
create or replace function public.cc_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return new; end if;   -- server-side tools (no signed-in user) aren't limited
  if tg_table_name = 'hole_maps' then
    select count(*) into n from public.hole_maps where owner = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 300 then raise exception 'Too many course map updates in the last hour' using errcode = '22023'; end if;
  else
    select count(*) into n from public.course_cards where owner = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 60 then raise exception 'Too many updates in the last hour' using errcode = '22023'; end if;
  end if;
  return new;
end $$;
revoke all on function public.cc_rate_limit() from public, anon, authenticated;

drop trigger if exists hole_maps_rate on public.hole_maps;
create trigger hole_maps_rate before insert on public.hole_maps for each row execute function public.cc_rate_limit();
drop trigger if exists course_cards_rate on public.course_cards;
create trigger course_cards_rate before insert on public.course_cards for each row execute function public.cc_rate_limit();
