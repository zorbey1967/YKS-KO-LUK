-- Canlı 001–010 şemasına benzer örnek veri (throwaway prova). Gerçek kişi/e-posta yok.
-- Sahip admin, iki öğrenci (biri e-postası doğrulanmamış), onaylı ve bekleyen koç, askıdaki öğrenci.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000001','owner@example.com', now(), '{"name":"Sahip Hesap"}'),
 ('a0000000-0000-4000-8000-000000000002','ogrenci1@example.com', now(), '{"name":"Ali Veli"}'),
 ('a0000000-0000-4000-8000-000000000003','ogrenci2@example.com', null, '{"name":"Ayşe Kaya"}'),
 ('a0000000-0000-4000-8000-000000000004','koc1@example.com', now(), '{"name":"Koç Bir"}'),
 ('a0000000-0000-4000-8000-000000000005','koc2@example.com', now(), '{"name":"Koç İki"}'),
 ('a0000000-0000-4000-8000-000000000006','pasif@example.com', now(), '{"name":"Pasif Öğrenci"}');
-- Migration çalıştırıcısı gibi (auth.uid() boş): sahip admin, bir öğrenci askıda.
update public.profiles set role = 'admin', account_status = 'active' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set account_status = 'pasif' where id = 'a0000000-0000-4000-8000-000000000006';
-- Koç satırları admin oturumuyla (003 force_coach_pending admin dışını pending yapar).
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', false);
insert into public.coaches (id, user_id, name, email, status) values
 ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','Koç Bir','koc1@example.com','active'),
 ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000005','Koç İki','koc2@example.com','pending');
select set_config('request.jwt.claim.sub', '', false);
insert into public.student_data (user_id, data) values
 ('a0000000-0000-4000-8000-000000000002', '{"sessions":[{"id":"s1","date":"2026-10-10","minutes":30},{"id":"s1","date":"2026-10-10","minutes":30}],"examTargets":[{"id":"e1","title":"TYT","date":"2027-06-19"}]}');
