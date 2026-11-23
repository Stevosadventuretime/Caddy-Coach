-- My Golf Brain (golfbrain.js) is backed up with the golfer's other data, as a new kind of row in user_backup.
alter table public.user_backup drop constraint if exists user_backup_kind_check;
alter table public.user_backup add constraint user_backup_kind_check check (kind in ('round', 'analysis', 'course', 'practice', 'brain'));
