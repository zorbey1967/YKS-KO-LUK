-- CANLI UYGULAMA: 062 (koç onayı öğrenci rolünü korur — tek hesap öğrenci + koç).
-- Canlıdaki mevcut tanım zaten rol değiştirmiyor; bu dosya repo ile eşitler ve search_path'i sıkılaştırır.
-- Tek işlem; hata olursa hiçbir değişiklik kalmaz. Tekrar çalıştırmak güvenlidir.

begin;

do $$
declare
  missing text := '';
begin
  if to_regclass('public.coaches') is null then missing := missing || ' coaches'; end if;
  if pg_catalog.to_regprocedure('public.is_admin()') is null then missing := missing || ' is_admin'; end if;
  if missing <> '' then
    raise exception 'ONKOSUL_EKSIK:% - hiçbir değişiklik yapılmadı', missing;
  end if;
end
$$;

-- ===================== 062_coach_approval_keeps_student_role.sql =====================

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

do $$
begin
  if position('profiles' in pg_catalog.pg_get_functiondef('public.admin_set_coach_status(uuid,text)'::regprocedure)) > 0 then
    raise exception 'SON_KONTROL_BASARISIZ: admin_set_coach_status hâlâ profiles güncelliyor - geri aliniyor';
  end if;
end
$$;

commit;

select 'CANLI_062_OK' as sonuc;
