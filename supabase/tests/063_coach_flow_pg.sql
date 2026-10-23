-- Throwaway prova testi (063 koç akışı). ROLLBACK; veri kalıcı değil.
-- Önkoşul (scripts/run-pg-commercial.mjs): ... → 062 → 063; live010_seed (sahip admin a…01).
begin;

do $$
begin
  if pg_catalog.to_regprocedure('public.coach_directory_rows()') is null then raise exception '063 yok'; end if;
end
$$;

-- Kurulum (sunucu bağlamı) ------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('c6300000-0000-4000-8000-000000000001', 'koc63@example.com', now(), '{"name":"Koç Altmışüç"}'),
 ('c6300000-0000-4000-8000-000000000002', 'ogr63@example.com', now(), '{"name":"Öğrenci Altmışüç"}'),
 ('c6300000-0000-4000-8000-000000000003', 'red63@example.com', now(), '{"name":"Red Koç"}'),
 ('c6300000-0000-4000-8000-000000000004', 'yeni63@example.com', now(),
  '{"name":"Yeni Başvuru","intent":"coach","coach_track":"YKS Eşit Ağırlık","coach_focus":"Deneme","coach_student_count":"7"}');
update public.profiles set role = 'student', account_status = 'active'
 where id in ('c6300000-0000-4000-8000-000000000001', 'c6300000-0000-4000-8000-000000000002', 'c6300000-0000-4000-8000-000000000003');

-- Kayıt tetikleyicisi: koç niyetiyle gelen kayıt beklemede başvuru açar
do $$
declare r record;
begin
  select status, track, focus, student_count into r from public.coaches where user_id = 'c6300000-0000-4000-8000-000000000004';
  if not found then raise exception 'kayıtta koç başvurusu açılmalı'; end if;
  if r.status <> 'pending' or r.track <> 'YKS Eşit Ağırlık' or r.student_count <> 7 then
    raise exception 'kayıt başvurusu alanları yanlış: % % %', r.status, r.track, r.student_count;
  end if;
  if exists (select 1 from public.coaches where user_id = 'c6300000-0000-4000-8000-000000000002') then
    raise exception 'öğrenci kaydı koç başvurusu açmamalı';
  end if;
end
$$;

-- Yönetici koç kayıtlarını açar
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.coaches (id, user_id, name, email, status) values
 ('c6300000-0000-4000-8000-0000000000c1', 'c6300000-0000-4000-8000-000000000001', 'Koç Altmışüç', 'koc63@example.com', 'active'),
 ('c6300000-0000-4000-8000-0000000000c3', 'c6300000-0000-4000-8000-000000000003', 'Red Koç', 'red63@example.com', 'rejected');
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

-- 1) Dizin: öğrenci onaylı koçu görür; askıdaki hesabın koçu görünmez -------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if not exists (select 1 from public.coach_directory where id = 'c6300000-0000-4000-8000-0000000000c1') then
    raise exception 'öğrenci onaylı koçu dizinde görmeli';
  end if;
  if exists (select 1 from public.coach_directory where id = 'c6300000-0000-4000-8000-0000000000c3') then
    raise exception 'reddedilen koç dizinde görünmemeli';
  end if;
end
$$;
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set account_status = 'pasif' where id = 'c6300000-0000-4000-8000-000000000001';
do $$
begin
  if public.is_active_coach('c6300000-0000-4000-8000-0000000000c1') then raise exception 'askıdaki hesabın koçu aktif sayılmamalı'; end if;
end
$$;
update public.profiles set account_status = 'active' where id = 'c6300000-0000-4000-8000-000000000001';

-- 2) Reddedilen koç yeniden başvurur; onaylı koçun adı ve durumu istemciden değişmez ------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000003","role":"authenticated"}', true);
update public.coaches set status = 'pending', focus = 'Yeni başvuru' where user_id = 'c6300000-0000-4000-8000-000000000003';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.coaches set name = 'Sahte Ad', status = 'pending', status_before_suspend = 'active', bio = 'Merhaba'
 where user_id = 'c6300000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
declare r record;
begin
  select status into r from public.coaches where user_id = 'c6300000-0000-4000-8000-000000000003';
  if r.status <> 'pending' then raise exception 'reddedilen koç yeniden başvurabilmeli: %', r.status; end if;
  select name, status, status_before_suspend, bio into r from public.coaches where user_id = 'c6300000-0000-4000-8000-000000000001';
  if r.name <> 'Koç Altmışüç' or r.status <> 'active' or r.status_before_suspend is not null then
    raise exception 'onaylı koç ad/durum/askı alanını değiştirememeli: % % %', r.name, r.status, r.status_before_suspend;
  end if;
  if r.bio <> 'Merhaba' then raise exception 'onaylı koç tanıtımını güncelleyebilmeli'; end if;
end
$$;

-- 3) Saat açma: onaylı koç açar; bekleyen koç açamaz ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.add_coach_slot(now() + interval '2 days');
    raise exception 'BEKLEYEN_SAAT_ACTI';
  exception when others then
    if sqlerrm not like '%onaylı değil%' then raise; end if;
  end;
end
$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000001","role":"authenticated"}', true);
create temp table t63 (k text primary key, v text) on commit drop;
grant all on t63 to authenticated;
insert into t63 select 'slot', (public.add_coach_slot(date_trunc('hour', now()) + interval '2 days'))->>'id';
-- Koç kendi saatine randevu alamaz
do $$
begin
  begin
    perform public.request_appointment((select v::uuid from t63 where k = 'slot'));
    raise exception 'KENDI_SAATINE_ALDI';
  exception when others then
    if sqlerrm not like '%kendi saatine%' then raise; end if;
  end;
end
$$;
reset role;

-- 4) Öğrenci talep eder; doğrudan randevu / ödev yazamaz --------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into t63 select 'appt', (public.request_appointment((select v::uuid from t63 where k = 'slot')))->>'id';
do $$
begin
  begin
    insert into public.appointments (id, coach_id, student_id, date, time, minutes, status, availability_id)
    values ('ap_dogrudan63', 'c6300000-0000-4000-8000-0000000000c1', 'c6300000-0000-4000-8000-000000000002',
            current_date + 3, '10:00', 40, 'bekliyor', (select v::uuid from t63 where k = 'slot'));
    raise exception 'DOGRUDAN_RANDEVU_YAZDI';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 5) Bekleyen talep bağ kurmaz; onaydan sonra özet ve ödev açılır ----------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.coach_student_brief('c6300000-0000-4000-8000-000000000002');
    raise exception 'BEKLEYEN_TALEPLE_OZET';
  exception when others then
    if sqlerrm not like '%yetkisiz%' then raise; end if;
  end;
end
$$;
select public.respond_appointment((select v from t63 where k = 'appt'), true);
do $$
begin
  if (public.coach_student_brief('c6300000-0000-4000-8000-000000000002'))->>'ok' <> 'true' then
    raise exception 'onaylı randevuyla özet açılmalı';
  end if;
  perform public.assign_coach_homework('c6300000-0000-4000-8000-000000000002', 'Paragraf 40 soru', current_date + 5);
  if (select count(*) from public.coach_linked_students()) <> 1 then raise exception 'bağlı öğrenci 1 olmalı'; end if;
  if public.can_join_meeting((select v from t63 where k = 'appt')) then
    raise exception 'iki gün sonraki derse şimdi girilmemeli';
  end if;
end
$$;
reset role;

-- 6) Öğrenci ödevi doğrudan değiştiremez; iptal talebine karşı taraf karar verir -------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  begin
    update public.coach_homeworks set title = 'değişti' where student_id = 'c6300000-0000-4000-8000-000000000002';
    raise exception 'ODEV_DOGRUDAN_DEGISTI';
  exception when insufficient_privilege then null;
  end;
  perform public.request_cancel_approved_appointment((select v from t63 where k = 'appt'));
  begin
    perform public.decide_approved_appointment_cancel((select v from t63 where k = 'appt'), true);
    raise exception 'KENDI_IPTALINI_ONAYLADI';
  exception when others then
    if sqlerrm not like '%karşı taraf%' then raise; end if;
  end;
end
$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.decide_approved_appointment_cancel((select v from t63 where k = 'appt'), true);
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if (select status from public.appointments where id = (select v from t63 where k = 'appt')) <> 'iptal' then
    raise exception 'karşı tarafın onayıyla randevu iptal olmalı';
  end if;
  if (select status from public.coach_availability where id = (select v::uuid from t63 where k = 'slot')) <> 'open' then
    raise exception 'iptal edilen ileri tarihli saat yeniden açılmalı';
  end if;
end
$$;

-- 7) Destek: koç modundan yazan onaylı koç "coach", öğrenci "student" ------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000001","role":"authenticated","email":"koc63@example.com"}', true);
insert into public.support_tickets (user_id, first_name, last_name, email, subject, body, sender_role)
values ('c6300000-0000-4000-8000-000000000001', 'Koç', 'Altmışüç', 'koc63@example.com', 'Koç sorusu', 'Merhaba', 'coach');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c6300000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c6300000-0000-4000-8000-000000000002","role":"authenticated","email":"ogr63@example.com"}', true);
insert into public.support_tickets (user_id, first_name, last_name, email, subject, body, sender_role)
values ('c6300000-0000-4000-8000-000000000002', 'Öğrenci', 'Altmışüç', 'ogr63@example.com', 'Öğrenci sorusu', 'Merhaba', 'coach');
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if (select sender_role from public.support_tickets where subject = 'Koç sorusu') <> 'coach' then
    raise exception 'onaylı koçun koç modundaki kaydı coach olmalı';
  end if;
  if (select sender_role from public.support_tickets where subject = 'Öğrenci sorusu') <> 'student' then
    raise exception 'koç olmayan kullanıcı coach yazamamalı';
  end if;
end
$$;

select 'OK 063_coach_flow_pg' as result;
rollback;
