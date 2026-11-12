-- H4: leaderboard (and competition) entries are scored by the server from the hole scores, not trusted from the phone.
-- Each entry must carry 18 holes as [par, stroke index, score], the course handicap (ch) and the playing handicap (ph,
-- 95% of ch). Points, net, gross and holes played are worked out here and overwrite what the phone sent.
-- The handicap itself still comes from the golfer's phone.

create or replace function public.cc_lb_verify() returns trigger
language plpgsql set search_path = public as $$
declare
  h jsonb := new.card -> 'holes';
  ch int; ph int; n int := 18; si_ok boolean := true; seen int[] := '{}';
  i int; par int; si int; sc int; rk int; st int; c int;
  pts int := 0; net int := 0; gross int := 0; thru int := 0;
  ord int[];
begin
  if split_part(new.course_key, '~', 1) <> 'lb' then return new; end if;
  if h is null or jsonb_typeof(h) <> 'array' or jsonb_array_length(h) <> 18 then
    raise exception 'A leaderboard entry needs all 18 holes' using errcode = '22023';
  end if;
  begin ch := (new.card ->> 'ch')::int; ph := (new.card ->> 'ph')::int;
  exception when others then raise exception 'Bad handicap on the entry' using errcode = '22023'; end;
  if ch is null or ph is null or ch < -10 or ch > 60 or ph <> floor(ch * 0.95 + 0.5) then
    raise exception 'The playing handicap must be 95%% of the course handicap' using errcode = '22023';
  end if;
  -- stroke index order (1 = hardest); if the indexes aren't a full, unique set, holes are taken in order
  for i in 0..17 loop
    si := nullif(h -> i ->> 1, '')::int;
    if si is null or si < 1 or si > 18 or si = any(seen) then si_ok := false; end if;
    seen := seen || coalesce(si, 0);
  end loop;
  select array_agg(r order by idx) into ord from (
    select idx, row_number() over (order by case when si_ok then (h -> idx ->> 1)::int else idx + 1 end) as r
    from generate_series(0, 17) idx) q;
  for i in 0..17 loop
    par := (h -> i ->> 0)::int; sc := nullif(h -> i ->> 2, '')::int;
    if par is null or par < 3 or par > 6 then raise exception 'Bad par on hole %', i + 1 using errcode = '22023'; end if;
    if sc is null then continue; end if;
    if sc < 1 or sc > 20 then raise exception 'Bad score on hole %', i + 1 using errcode = '22023'; end if;
    rk := ord[i + 1];
    if ph >= 0 then st := ph / n + case when rk <= ph % n then 1 else 0 end;
    else c := -ph; st := -(c / n + case when rk > n - c % n then 1 else 0 end); end if;
    thru := thru + 1; gross := gross + sc; net := net + sc - st;
    pts := pts + greatest(0, 2 + par + st - sc);
  end loop;
  if thru < 14 then raise exception 'A leaderboard entry needs at least 14 holes played' using errcode = '22023'; end if;
  new.card := new.card || jsonb_build_object('pts', pts, 'net', net, 'gross', gross, 'thru', thru, 'v', 2, 'checked', true);
  return new;
end $$;
revoke all on function public.cc_lb_verify() from public, anon, authenticated;

drop trigger if exists course_cards_lb_verify on public.course_cards;
create trigger course_cards_lb_verify before insert on public.course_cards
  for each row execute function public.cc_lb_verify();
