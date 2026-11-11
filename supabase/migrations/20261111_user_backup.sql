-- Step 5: a private copy of each golfer's rounds and swing results in their account, so a new phone or a cleared
-- browser doesn't lose them. Each row belongs to one signed-in golfer and only they can read or change it.
create table if not exists public.user_backup (
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,   -- deleting the account deletes the backup
  kind       text not null check (kind in ('round', 'analysis', 'course')),
  item_id    text not null check (length(item_id) between 1 and 120),
  data       jsonb,                                              -- null once deleted (kept so other phones learn of the delete)
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner, kind, item_id),
  constraint user_backup_size check (data is null or octet_length(data::text) < 600000)
);
create index if not exists user_backup_owner_updated on public.user_backup (owner, updated_at);
alter table public.user_backup enable row level security;
create policy backup_read on public.user_backup for select to authenticated using (owner = auth.uid());
create policy backup_insert on public.user_backup for insert to authenticated with check (owner = auth.uid());
create policy backup_update on public.user_backup for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy backup_delete on public.user_backup for delete to authenticated using (owner = auth.uid());
-- the server keeps updated_at honest (it decides which copy is newer when two phones sync)
create or replace function public.user_backup_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
revoke execute on function public.user_backup_touch() from public, anon, authenticated;
create trigger user_backup_touch before insert or update on public.user_backup for each row execute function public.user_backup_touch();
