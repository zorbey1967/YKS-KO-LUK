-- İzole PG. Production’da çalıştırılmaz.
-- Önkoşul: 029 + 030. Canlı URL yok.
--   psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/030_security_pg.sql
-- protect_plan: to_regprocedure + pg_proc; 'public.protect_plan()'::regproc kullanma.

begin;

do $$
declare
  plan_oid oid;
  trial_oid oid;
  week_oid oid;
  src text;
  student_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14';
  started timestamptz;
  ended timestamptz;
  plan_got text;
  days numeric;
begin
  select p.oid into plan_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'protect_plan' and p.pronargs = 0;
  if plan_oid is null then
    plan_oid := to_regprocedure('public.protect_plan()');
  end if;
  if plan_oid is null then
    raise exception '030 yok: public.protect_plan()';
  end if;
  src := pg_get_functiondef(plan_oid);
  if src ~ 'yks.internal' or src ~ 'set_config' then
    raise exception 'protect_plan GUC içermemeli';
  end if;
  if src !~ 'current_user' then
    raise exception 'protect_plan current_user kilidi yok';
  end if;

  select p.oid into trial_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_top_plan_trial' and p.pronargs = 0;
  if trial_oid is null then
    trial_oid := to_regprocedure('public.start_top_plan_trial()');
  end if;
  if trial_oid is null then
    raise exception '030 yok: start_top_plan_trial()';
  end if;
  src := pg_get_functiondef(trial_oid);
  if src ~ 'yks.internal' then
    raise exception 'trial GUC kullanmamalı';
  end if;
  if src !~ '14 days' then
    raise exception 'deneme 14 gün olmalı';
  end if;

  week_oid := to_regprocedure('public.upsert_student_week_plan(uuid, jsonb, numeric, text, text)');
  if week_oid is not null then
    src := pg_get_functiondef(week_oid);
    if src ~ 'tamamlandi' then
      raise exception 'haftalık program geçmiş randevuya dayanmamalı';
    end if;
  end if;

  insert into auth.users (id) values (student_id) on conflict (id) do nothing;
  insert into public.profiles (id, role, account_status, plan)
    values (student_id, 'student', 'active', 'Ücretsiz')
    on conflict (id) do update
      set role = 'student', account_status = 'active', plan = 'Ücretsiz',
          trial_started_at = null, trial_ends_at = null, subscription_status = null;

  perform set_config('request.jwt.claim.sub', student_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', student_id::text)::text, true);
  perform public.start_top_plan_trial();
  select trial_started_at, trial_ends_at into started, ended
    from public.profiles where id = student_id;
  perform public.start_top_plan_trial();
  if (select trial_started_at from public.profiles where id = student_id) is distinct from started then
    raise exception 'deneme ikinci kez yazılmamalı';
  end if;
  if started is null or ended is null then
    raise exception 'deneme zaman damgası yok';
  end if;
  days := extract(epoch from (ended - started)) / 86400.0;
  if days < 13.9 or days > 14.1 then
    raise exception 'deneme tam 14 gün olmalı, got %', days;
  end if;

  grant update on table public.profiles to authenticated;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', student_id::text, true);
  update public.profiles set plan = 'premium', role = 'admin' where id = student_id;
  reset role;
  select plan into plan_got from public.profiles where id = student_id;
  if plan_got is not distinct from 'premium' then
    raise exception 'authenticated sahte Premium yazamamalı';
  end if;
  if exists (select 1 from public.profiles where id = student_id and role = 'admin') then
    raise exception 'authenticated kendini admin yapamamalı';
  end if;
end
$$;

rollback;
