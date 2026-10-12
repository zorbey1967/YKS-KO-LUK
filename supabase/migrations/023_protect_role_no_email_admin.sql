-- 002/canlı protect_role e-posta ile admin yapar. Bu dosya e-posta yükseltmesini kaldırır.
-- PRODUCTION/STAGING’e otomatik uygulanmaz. Admin atama: service_role / SQL Editor (auth.uid() null).
-- INSERT (oturumlu): admin yazılamaz. UPDATE (oturumlu): role/account_status dondurulur; admin başkasına admin veremez.

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      if new.role = 'admin' then
        new.role := 'student';
      end if;
      new.role := coalesce(nullif(new.role, ''), 'student');
      if new.role not in ('student', 'coach') then
        new.role := 'student';
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is null then
      return new;
    end if;
    if not public.is_admin() then
      new.role := old.role;
      new.account_status := old.account_status;
    elsif new.role = 'admin' and old.role is distinct from 'admin' then
      new.role := old.role;
    elsif old.role = 'admin' and new.role is distinct from 'admin' then
      new.role := 'admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute procedure public.protect_role();

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
