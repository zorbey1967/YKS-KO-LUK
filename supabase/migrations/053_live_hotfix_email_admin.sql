-- Canlı katalog hotfix: protect_role / handle_new_user e-postaya göre admin atıyordu.
-- profiles UPDATE RLS kendi satırına izin verdiği için kullanıcı email sütununu yönetici
-- e-postasına çekip role='admin' alabiliyordu. Bu migration:
--   * e-posta tabanlı admin atamasını kaldırır,
--   * yönetici olmayan istemcinin role / account_status / email değiştirmesini engeller,
--   * istemci INSERT’inde rolü 'student' yapar,
--   * mevcut admin satırını değiştirmez (role zaten tabloda saklı).
-- Veri satırı güncellemez; yalnızca iki fonksiyonu değiştirir.

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- auth.uid() null: Auth tetikleyicisi / service_role. İstemci asla admin/koç açamaz.
    if auth.uid() is not null and not public.is_admin() then
      new.role := 'student';
    else
      new.role := coalesce(nullif(new.role, ''), 'student');
      if new.role = 'admin' then
        new.role := 'student';
      end if;
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
      new.email := old.email;
    elsif new.role = 'admin' and old.role is distinct from 'admin' then
      new.role := old.role;
    elsif old.role = 'admin' and new.role is distinct from 'admin' then
      new.role := 'admin';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

revoke all on function public.protect_role() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
