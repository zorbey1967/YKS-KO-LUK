-- Aşama 2: yönetici yetkisi (RLS). Koç/randevu/finans tabloları yok.
-- Bu dosya otomatik uygulanmaz; SQL Editor veya onaylı CLI ile çalıştırın.
-- Mevcut profiles / student_data kendi-satır politikaları korunur.

alter table public.profiles
  add column if not exists role text not null default 'student',
  add column if not exists account_status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'coach', 'admin'));

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'pasif'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.account_status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.email, '')) = 'yusufbesiroglu357@gmail.com' then
      new.role := 'admin';
      new.account_status := coalesce(nullif(new.account_status, ''), 'active');
    else
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

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text := 'student';
begin
  if lower(coalesce(new.email, '')) = 'yusufbesiroglu357@gmail.com' then
    r := 'admin';
  end if;
  insert into public.profiles (id, email, name, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    r,
    'active'
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when public.profiles.role = 'admin' then 'admin'
          when lower(coalesce(excluded.email, '')) = 'yusufbesiroglu357@gmail.com' then 'admin'
          else public.profiles.role
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Mevcut hesap (migration superuser: auth.uid() boş, protect_role izin verir)
update public.profiles
  set role = 'admin', account_status = 'active'
  where lower(email) = 'yusufbesiroglu357@gmail.com';
