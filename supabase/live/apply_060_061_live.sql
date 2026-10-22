-- CANLI UYGULAMA: 060 (deneme süresinde tüm özellikler) + 061 (yeni Google kaydı kapalı).
-- Önkoşul: 058 canlıda. Tek işlem; hata olursa hiçbir değişiklik kalmaz. Tekrar çalıştırmak güvenlidir.
-- SIRA: önce bu dosya, SONRA student-ai ve exam-scan (deneme = tüm yetenek) edge fonksiyonları ve frontend.

begin;

do $$
declare
  missing text := '';
begin
  if pg_catalog.to_regprocedure('public.caller_access_tier()') is null then missing := missing || ' 058_caller_access_tier'; end if;
  if pg_catalog.to_regprocedure('public.caller_premium_ai()') is null then missing := missing || ' 058_caller_premium_ai'; end if;
  if to_regclass('auth.users') is null then missing := missing || ' auth.users'; end if;
  if missing <> '' then
    raise exception 'ONKOSUL_EKSIK:% - hiçbir değişiklik yapılmadı', missing;
  end if;
end
$$;

-- ===================== 060_trial_full_access.sql =====================

create or replace function public.caller_premium_ai()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.caller_access_tier() in ('premium', 'staff', 'trial');
$$;

revoke all on function public.caller_premium_ai() from public, anon;
grant execute on function public.caller_premium_ai() to authenticated;

comment on function public.caller_premium_ai() is
  'Yapay Zekâ (ZORRO) ve gelişmiş analiz yetkisi: aktif Premium, aktif 14 günlük deneme ve yönetici.';

-- ===================== 061_block_new_google_signup.sql =====================

create or replace function public.block_new_google_signup()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- to_jsonb: kolon yoksa (yerel prova şeması) sağlayıcı boş sayılır; kayıt engellenmez.
  if lower(coalesce(to_jsonb(new)->'raw_app_meta_data'->>'provider', '')) = 'google' then
    raise exception 'GOOGLE_KAYIT_YOK: Bu e-posta ile kayıt yok'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.block_new_google_signup() from public, anon, authenticated;

drop trigger if exists block_new_google_signup on auth.users;
create trigger block_new_google_signup
  before insert on auth.users
  for each row execute function public.block_new_google_signup();

do $$
begin
  if position('''trial''' in pg_catalog.pg_get_functiondef('public.caller_premium_ai()'::regprocedure)) = 0 then
    raise exception 'SON_KONTROL_BASARISIZ: caller_premium_ai deneme icermiyor - geri aliniyor';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'auth.users'::regclass and t.tgname = 'block_new_google_signup' and not t.tgisinternal
  ) then
    raise exception 'SON_KONTROL_BASARISIZ: block_new_google_signup tetikleyicisi yok - geri aliniyor';
  end if;
end
$$;

commit;

select 'CANLI_060_061_OK' as sonuc;
