-- student_entitled: NULL / tanımsız üyelik artık yetki vermez (istemci fail-closed ile hizalı).
-- 013 gerekir (subscription_* kolonları). 016 tablo/RLS’ye dokunulmaz.
-- 009 can_join_meeting değiştirilmez: onaylı randevuya katılım üyelik NULL yüzünden kesilmez.
-- PRODUCTION’A otomatik uygulanmaz. Satır UPDATE yok; profil/ödeme kayıtları yazılmaz.
-- Tekrar çalıştırılabilir: CREATE OR REPLACE + aynı GRANT.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'subscription_status'
  ) then
    raise exception '018 durdu: 013 billing kolonları yok. Önce 013 uygulayın.';
  end if;
end
$$;

create or replace function public.student_entitled(p_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.profiles%rowtype;
begin
  if p_id is null then
    return false;
  end if;

  select * into r from public.profiles where id = p_id;
  if not found then
    return false;
  end if;

  if r.role in ('admin', 'coach') then
    return true;
  end if;

  if r.account_status is distinct from 'active' then
    return false;
  end if;

  -- NULL ve 'none': yetki yok. Satır güncellenmez; yalnızca kapı kapanır.
  if r.subscription_status is null or r.subscription_status = 'none' then
    return false;
  end if;

  if r.subscription_status = 'trialing' then
    return r.trial_ends_at is not null and r.trial_ends_at > now();
  end if;

  if r.subscription_status = 'active' then
    return r.subscription_ends_at is null or r.subscription_ends_at > now();
  end if;

  return false;
end;
$$;

revoke all on function public.student_entitled(uuid) from public, anon;
grant execute on function public.student_entitled(uuid) to authenticated;
