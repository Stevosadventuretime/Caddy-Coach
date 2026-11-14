-- Practice coaching (drill test scores, the step each drill is at, the two-week focus) is backed up with the rest of
-- a golfer's data, as kind 'practice'. Only the allowed kinds change; the row rules, sizes and policies stay the same.
alter table public.user_backup drop constraint if exists user_backup_kind_check;
alter table public.user_backup add constraint user_backup_kind_check check (kind in ('round', 'analysis', 'course', 'practice'));
