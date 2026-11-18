-- AI swing coach (edge function cc-coach): how many coaching answers each golfer (or, for guests, each connection,
-- kept only as a one-way code) has had today, so the free allowance holds and the Claude bill can't run away.
-- Only the edge function (service role) reads or writes it.
create table if not exists public.coach_usage (
  who  text not null,              -- 'u:<user id>' or 'g:<one-way code of the connection>'
  day  date not null default (now() at time zone 'utc')::date,
  kind text not null,              -- 'analysis' or 'chat'
  n    integer not null default 0,
  primary key (who, day, kind)
);
alter table public.coach_usage enable row level security;
-- no policies: the public app key can't see or change it
revoke all on public.coach_usage from anon, authenticated;
