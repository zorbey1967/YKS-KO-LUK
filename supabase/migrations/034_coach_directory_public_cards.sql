-- Yerel / staging. Production’a bu turda uygulanmaz.
-- 028/032 invoker görünüm + coaches_select_own_admin dizini boşaltır.
-- Kartlar SECURITY DEFINER fonksiyon (search_path kilitli). Görünüm invoker; yalnız fonksiyonu okur.
-- email, user_id, score görünümde ve dönüş tipinde yok. coaches RLS değişmez.

drop view if exists public.coach_directory;

create or replace function public.coach_directory_cards()
returns table (
  id uuid,
  name text,
  photo text,
  track text,
  focus text,
  experience text,
  bio text,
  student_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.photo, c.track, c.focus, c.experience, c.bio, c.student_count, c.created_at
  from public.coaches c
  inner join public.profiles p on p.id = c.user_id
  where c.status = 'active'
    and p.account_status = 'active';
$$;

revoke all on function public.coach_directory_cards() from public, anon, authenticated;
grant execute on function public.coach_directory_cards() to anon, authenticated;

create view public.coach_directory
with (security_invoker = true, security_barrier = true) as
  select id, name, photo, track, focus, experience, bio, student_count, created_at
  from public.coach_directory_cards();

-- Varsayılan PUBLIC + anon/authenticated ALL; yalnız SELECT kalmalı.
-- Görünüm fonksiyon üstünde olduğu için yazma zaten başarısız; yetki yine kapanır.
revoke all on table public.coach_directory from public, anon, authenticated;
grant select on table public.coach_directory to anon, authenticated;
grant select (
  id, name, photo, track, focus, experience, bio, student_count, created_at
) on table public.coach_directory to anon, authenticated;
