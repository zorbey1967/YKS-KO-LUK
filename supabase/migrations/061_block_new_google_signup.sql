-- 061: Google ile kayıt şimdilik kapalı. Kayıtlı olmayan bir e-postayla ilk kez "Google ile giriş"
-- yapılınca Auth yeni kullanıcı satırı eklemeye çalışır; bu tetikleyici onu reddeder. Hesap açılmaz,
-- oturum açılmaz; Auth tarayıcıya "Database error saving new user" döndürür ve arayüz
-- "Bu e-posta ile kayıt yok" der (src/lib/authUi.ts).
--
-- Etkilenmeyenler:
-- - E-posta + şifre kaydı (provider = email).
-- - Sunucunun açtığı hesaplar (Auth admin createUser, misafir ödeme 059; provider = email).
-- - Zaten kayıtlı kullanıcının Google girişi (yeni auth.users satırı eklenmez).
-- Google ile kaydı yeniden açmak için: drop trigger block_new_google_signup on auth.users;

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
