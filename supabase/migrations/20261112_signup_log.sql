-- A brake on new accounts (cc-auth and cc-signup): each new account is noted with a one-way code for the connection
-- it came from, kept for 2 days. Only the server functions (service role) can read or write it.
create table if not exists public.signup_log (
  id bigint generated always as identity primary key,
  ip_hash text not null check (char_length(ip_hash) between 8 and 64),
  created_at timestamptz not null default now()
);
create index if not exists signup_log_ip_created on public.signup_log (ip_hash, created_at desc);
create index if not exists signup_log_created on public.signup_log (created_at desc);
alter table public.signup_log enable row level security;
revoke all on public.signup_log from anon, authenticated;
