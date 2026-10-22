-- 062: Tek hesap öğrenci + koç.
-- Koç onayı yalnız coaches.status değiştirir; profiles.role 'student' kalır.
-- Böylece onaylı koç aynı hesapla öğrenci tarafını (deneme / Pro / Premium kuralları aynen) kullanabilir;
-- koç paneli istemcide "Koç olarak gir" modu + aktif coaches kaydıyla açılır (RLS zaten coaches üzerinden).
-- 011'deki sürüm onayda role='coach' yapıyordu; canlıdaki tanım (003) yapmıyordu. Bu dosya ikisini eşitler.

create or replace function public.admin_set_coach_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  if p_status not in ('pending', 'active', 'rejected', 'pasif') then
    raise exception 'geçersiz durum';
  end if;
  update public.coaches set status = p_status, updated_at = pg_catalog.now() where id = p_id;
end;
$$;

revoke all on function public.admin_set_coach_status(uuid, text) from public, anon;
grant execute on function public.admin_set_coach_status(uuid, text) to authenticated;
