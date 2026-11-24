-- In-app feedback from golfers, and which poster or link brought them in.
-- Anyone using the app can send feedback (signed in or not); only the app owner can read it.
-- No usage code, username or device id is stored with feedback. A way to reply is only kept if the golfer types one.
create table if not exists public.feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  rating smallint check (rating is null or rating between 1 and 5),
  body text check (body is null or char_length(body) <= 1000),
  source text check (source is null or char_length(source) <= 24),     -- where it was sent from: menu, after_swing, after_round
  arrived text check (arrived is null or char_length(arrived) <= 24),  -- which poster/link brought them (e.g. poster-simclub)
  device text check (device is null or char_length(device) <= 24),     -- iPhone / Android / Computer, and whether installed
  app_ver text check (app_ver is null or char_length(app_ver) <= 24),
  contact text check (contact is null or char_length(contact) <= 120),
  constraint feedback_not_empty check (rating is not null or char_length(coalesce(body, '')) > 0)
);
alter table public.feedback enable row level security;
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to anon, authenticated with check (created_at > now() - interval '5 minutes');
revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;
grant usage on sequence public.feedback_id_seq to anon, authenticated;

create or replace function public.cc_feedback_list(n int default 50) returns jsonb
  language plpgsql stable security definer set search_path = public
  as $$ begin
    if not public.is_app_owner() then raise exception 'only the app owner can see this'; end if;
    return coalesce((select jsonb_agg(f order by f.created_at desc) from (
      select id, created_at, rating, body, source, arrived, device, app_ver, contact
      from public.feedback order by created_at desc limit least(greatest(n, 1), 200)) f), '[]'::jsonb);
  end $$;
revoke all on function public.cc_feedback_list(int) from public, anon;
grant execute on function public.cc_feedback_list(int) to authenticated;

-- usage counts: 'arrive' (first visit, detail = which poster/link) and 'feedback'
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check check (kind in
  ('open', 'round', 'swing', 'trace', 'pin', 'practice', 'group', 'coach', 'coach_q', 'progress', 'report', 'friends', 'badge', 'gate', 'arrive', 'feedback'));

-- owner: how many golfers each poster or link brought in (last 90 days)
create or replace function public.cc_arrivals() returns jsonb
  language plpgsql stable security definer set search_path = public
  as $$ begin
    if not public.is_app_owner() then raise exception 'only the app owner can see this'; end if;
    return coalesce((select jsonb_object_agg(detail, n) from (
      select detail, count(distinct uhash) as n from public.usage_events
      where kind = 'arrive' and detail is not null and day > current_date - 90 group by detail) a), '{}'::jsonb);
  end $$;
revoke all on function public.cc_arrivals() from public, anon;
grant execute on function public.cc_arrivals() to authenticated;
