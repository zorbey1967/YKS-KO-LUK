-- Throwaway prova testi (062 tek hesap öğrenci + koç). ROLLBACK; veri kalıcı değil.
-- Önkoşul (scripts/run-pg-commercial.mjs): ... → 060 → 061 → 062; live010_seed (sahip admin a…01).
-- Sınar: öğrenci kendi koç başvurusunu onaylayamaz; yönetici onayı koç kaydını açar ama profil rolü
-- 'student' kalır; aynı hesap öğrenci tarafında normal deneme kurallarına tabidir.
begin;

do $$
begin
  if position('profiles' in pg_catalog.pg_get_functiondef('public.admin_set_coach_status(uuid,text)'::regprocedure)) > 0 then
    raise exception '062 yok: admin_set_coach_status profil rolünü değiştiriyor';
  end if;
end
$$;

select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('c6200000-0000-4000-8000-000000000001', 'cift62@example.com', now(), '{"name":"Çift Rol"}');
update public.profiles set role = 'student', account_status = 'active'
 where id = 'c6200000-0000-4000-8000-000000000001';
-- Başvuru, uygulamadaki gibi kullanıcının kendi oturumuyla (coaches tetikleyicisi user_id'yi oturumdan alır).
select set_config('request.jwt.claim.sub', 'c6200000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.coaches (id, user_id, name, email, status) values
 ('c6200000-0000-4000-8000-0000000000c1', 'c6200000-0000-4000-8000-000000000001', 'Çift Rol', 'cift62@example.com', 'pending');
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

-- 1) Öğrenci kendi başvurusunu onaylayamaz ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6200000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.admin_set_coach_status('c6200000-0000-4000-8000-0000000000c1', 'active');
    raise exception 'OGRENCI_ONAYLADI';
  exception when others then
    if sqlerrm not like '%yetkisiz%' then raise; end if;
  end;
end
$$;
reset role;

-- 2) Yönetici onaylar ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.admin_set_coach_status('c6200000-0000-4000-8000-0000000000c1', 'active');
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  r record;
begin
  select p.role, c.status into r
    from public.profiles p join public.coaches c on c.user_id = p.id
   where p.id = 'c6200000-0000-4000-8000-000000000001';
  if r.status <> 'active' then raise exception 'koç kaydı aktif olmalı: %', r.status; end if;
  if r.role <> 'student' then raise exception 'onay profil rolünü değiştirmemeli: %', r.role; end if;
  if pg_catalog.to_regprocedure('public.is_active_coach(uuid)') is not null
     and not public.is_active_coach('c6200000-0000-4000-8000-0000000000c1') then
    raise exception 'is_active_coach onaylı kaydı görmeli';
  end if;
end
$$;

-- 3) Aynı hesap öğrenci tarafında normal kurallar: üyeliksiz none, deneme trial ---------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6200000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'none' then raise exception 'üyeliksiz koç-öğrenci none olmalı: %', public.caller_access_tier(); end if;
end
$$;
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
update public.profiles
   set subscription_status = 'trialing', trial_started_at = now() - interval '1 day', trial_ends_at = now() + interval '13 days'
 where id = 'c6200000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6200000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if public.caller_access_tier() <> 'trial' then raise exception 'denemedeki koç-öğrenci trial olmalı: %', public.caller_access_tier(); end if;
end
$$;
reset role;

select 'OK 062_dual_role_pg' as result;
rollback;
