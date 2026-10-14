-- Ayrı düzeltme. 027’ye bağlı değil. Canlı PG 17.6 (15+ security_invoker).
-- 003 view varsayılan SECURITY DEFINER. Satır verisi değişmez; yalnızca view seçeneği.
-- PRODUCTION/STAGING: otomatik uygulanmaz.

create or replace view public.coach_directory
with (security_invoker = true) as
  select id, name, photo, track, focus, experience, bio, student_count, created_at
  from public.coaches
  where status = 'active';

revoke all on table public.coach_directory from public;
grant select on table public.coach_directory to anon, authenticated;
