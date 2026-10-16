-- Destek: gönderen rolü (öğrenci/koç). Additive. DROP/DELETE yok. RLS gevşetilmez.

alter table public.support_tickets
  add column if not exists sender_role text not null default 'student';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_tickets_sender_role_check'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_sender_role_check
      check (sender_role in ('student', 'coach'));
  end if;
end $$;

-- Eski constraint'te yalnızca student|admin vardı; koç yanıt rolü için genişlet.
alter table public.support_replies drop constraint if exists support_replies_role_check;
alter table public.support_replies
  add constraint support_replies_role_check
  check (role in ('student', 'coach', 'admin'));

create or replace function public.support_force_ticket()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prow text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.is_admin() then
    new.user_id := auth.uid();
    if tg_op = 'INSERT' then
      new.status := 'new';
      select lower(coalesce(p.role, 'student')) into prow
        from public.profiles p where p.id = auth.uid();
      if prow = 'coach' then
        new.sender_role := 'coach';
      else
        new.sender_role := 'student';
      end if;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.email := left(coalesce(nullif(auth.jwt() ->> 'email', ''), new.email, ''), 320);
    new.first_name := left(trim(coalesce(new.first_name, '')), 80);
    new.last_name := left(trim(coalesce(new.last_name, '')), 80);
    new.subject := left(trim(new.subject), 160);
    new.body := left(trim(new.body), 4000);
    if new.sender_role is null or new.sender_role not in ('student', 'coach') then
      new.sender_role := 'student';
    end if;
  elsif public.is_admin() then
    new.user_id := old.user_id;
    new.email := old.email;
    new.first_name := old.first_name;
    new.last_name := old.last_name;
    new.subject := old.subject;
    new.body := old.body;
    new.sender_role := old.sender_role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.support_force_reply()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prow text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  new.author_id := auth.uid();
  if public.is_admin() then
    new.role := 'admin';
  else
    select lower(coalesce(p.role, 'student')) into prow
      from public.profiles p where p.id = auth.uid();
    if prow = 'coach' then
      new.role := 'coach';
    else
      new.role := 'student';
    end if;
    if not exists (
      select 1 from public.support_tickets t
      where t.id = new.ticket_id and t.user_id = auth.uid()
    ) then
      raise exception 'Kayıt bulunamadı';
    end if;
  end if;
  new.body := left(trim(new.body), 4000);
  return new;
end;
$$;

-- FORCE RLS korunur; politikalar 045 ile aynı kalır (yeniden yazılmaz / gevşetilmez).
alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;
alter table public.support_replies enable row level security;
alter table public.support_replies force row level security;
