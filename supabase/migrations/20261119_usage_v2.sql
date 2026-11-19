-- Retention and feature use for the app owner (still anonymous: one-way codes, opt-in, no names).
-- New kinds for the coach, progress, round reports, friends, badges and plan gates; a short detail (e.g. which gate).
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check check (kind in
  ('open', 'round', 'swing', 'trace', 'pin', 'practice', 'group', 'coach', 'coach_q', 'progress', 'report', 'friends', 'badge', 'gate'));
alter table public.usage_events add column if not exists detail text check (detail is null or char_length(detail) <= 24);

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
    back as (select count(distinct c.uhash) as n from cohort c join public.usage_events e on e.uhash = c.uhash and e.day > current_date - 28),
    -- came back within 1, 7 and 30 days of their first day (only golfers who started long enough ago to count)
    ret as (
      select n, count(*) filter (where f.first_day <= current_date - n) as eligible,
             count(*) filter (where f.first_day <= current_date - n and exists (
               select 1 from public.usage_events e where e.uhash = f.uhash and e.day > f.first_day and e.day <= f.first_day + n)) as came_back
      from firsts f cross join (values (1), (7), (30)) v(n) group by n),
    gates as (
      select detail, count(*) as n from public.usage_events where kind = 'gate' and day > current_date - 30 and detail is not null group by detail)
    select jsonb_build_object(
      'weeks', coalesce((select jsonb_agg(jsonb_build_object('wk', wk, 'golfers', golfers)) from weeks), '[]'::jsonb),
      'kinds', coalesce((select jsonb_object_agg(kind, n) from kinds), '{}'::jsonb),
      'golfers_total', (select count(*) from firsts),
      'golfers_7d', (select count(distinct uhash) from public.usage_events where day > current_date - 7),
      'cohort', (select count(*) from cohort),
      'cohort_back', (select n from back),
      'retention', coalesce((select jsonb_object_agg('d' || n, jsonb_build_object('eligible', eligible, 'back', came_back)) from ret), '{}'::jsonb),
      'gates', coalesce((select jsonb_object_agg(detail, n) from gates), '{}'::jsonb),
      'profiles', (select count(*) from public.profiles),
      'with_password', (select count(*) from public.profiles where auth_id is not null)
    ) into out;
    return out; end $$;
revoke all on function public.cc_usage_summary() from public, anon;
grant execute on function public.cc_usage_summary() to authenticated;
