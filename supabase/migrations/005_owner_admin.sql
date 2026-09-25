-- Platform sahibi hesabı her zaman yönetici kalır.
-- 002'deki e-posta ile aynı; oturum bu adrese aitse panel ve RLS açılır.

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'yusufbesiroglu357@gmail.com' then
    new.role := 'admin';
    new.account_status := 'active';
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'admin' then
      new.role := 'student';
    end if;
    new.role := coalesce(nullif(new.role, ''), 'student');
    if new.role not in ('student', 'coach') then
      new.role := 'student';
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

insert into public.profiles (id, email, name, role, account_status)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'name', ''),
  'admin',
  'active'
from auth.users u
where lower(coalesce(u.email, '')) = 'yusufbesiroglu357@gmail.com'
on conflict (id) do update
  set email = excluded.email,
      role = 'admin',
      account_status = 'active';
