-- student_entitled: yalnızca çağıranın auth.uid() değeri; PostgREST yüzeyi kapanır.
-- Fail-closed: NULL / 'none' yetki vermez. Satır UPDATE yok.
-- 013 billing kolonları gerekir. 009 can_join_meeting, 016 protect_plan, webhook dokunulmaz.
-- PRODUCTION’A bu dosya otomatik uygulanmaz. Önce 013; CLI kaydı 018 varsa bu gövde onun üzerine REPLACE eder.
-- İç çağrı: request_appointment SECURITY DEFINER sahibi student_entitled’i EXECUTE grant olmadan çağırabilir.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'subscription_status'
  ) then
    raise exception '019 durdu: 013 billing kolonları yok. Önce 013 uygulayın.';
  end if;
end
$$;

create or replace function public.student_entitled(p_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r public.profiles%rowtype;
  uid uuid := auth.uid();
begin
  if p_id is null or uid is null then
    return false;
  end if;
  if p_id is distinct from uid then
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

revoke all on function public.student_entitled(uuid) from public, anon, authenticated;
