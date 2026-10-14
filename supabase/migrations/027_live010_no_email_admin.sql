-- Canlı katalog (001–010). 011–026 ve 023 bu dosyaya bağımlı değil.
-- 023 protect_role e-postasını kaldırır ama handle_new_user / anon tetikleyici RPC’ye dokunmaz.
-- 023’ü yeniden yazmaz. Satır UPDATE/DELETE yok; mevcut admin profili korunur.
-- PRODUCTION/STAGING: otomatik uygulanmaz. SQL Editor veya onaylı CLI.
-- 011 (ve 005) sonra uygulanırsa protect_role / handle_new_user e-posta admin’i geri getirir;
-- 027’yi tekrar uygulayın. 002 INSERT e-posta yükseltmesi bu dosyayla kapanır.
-- Admin atama: auth.uid() null (postgres / service_role / SQL Editor).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.account_status = 'active'
  );
$$;

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = ''
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'student',
    'active'
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when public.profiles.role = 'admin' then 'admin'
          else public.profiles.role
        end;
  return new;
end;
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.protect_role() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.appointment_bind_student()') is not null then
    execute 'revoke all on function public.appointment_bind_student() from public, anon';
  end if;
end
$$;
