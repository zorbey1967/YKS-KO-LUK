-- Destek talepleri. Zorro tablolarına dokunulmaz.
-- Additive / idempotent. Tablo silme ve satır silme yok. RLS gevşetilmez.
-- Anon erişimi yok. Öğrenci yalnızca kendi satırı. Admin is_admin().

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  subject text not null,
  body text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_status_check check (status in ('new', 'reviewing', 'replied')),
  constraint support_tickets_subject_len check (char_length(subject) between 1 and 160),
  constraint support_tickets_body_len check (char_length(body) between 1 and 4000)
);

create table if not exists public.support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_replies_role_check check (role in ('student', 'admin')),
  constraint support_replies_body_len check (char_length(body) between 1 and 4000)
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_replies_ticket_created_idx
  on public.support_replies (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_replies enable row level security;

revoke all on table public.support_tickets from anon, public;
revoke all on table public.support_replies from anon, public;
grant select, insert, update on table public.support_tickets to authenticated;
grant select, insert on table public.support_replies to authenticated;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists support_replies_select on public.support_replies;
create policy support_replies_select on public.support_replies
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists support_replies_insert on public.support_replies;
create policy support_replies_insert on public.support_replies
  for insert with check (
    auth.uid() is not null
    and author_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    )
  );

create or replace function public.support_force_ticket()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.is_admin() then
    new.user_id := auth.uid();
    if tg_op = 'INSERT' then
      new.status := 'new';
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.email := left(coalesce(nullif(auth.jwt() ->> 'email', ''), new.email, ''), 320);
    new.first_name := left(trim(coalesce(new.first_name, '')), 80);
    new.last_name := left(trim(coalesce(new.last_name, '')), 80);
    new.subject := left(trim(new.subject), 160);
    new.body := left(trim(new.body), 4000);
  elsif public.is_admin() then
    new.user_id := old.user_id;
    new.email := old.email;
    new.first_name := old.first_name;
    new.last_name := old.last_name;
    new.subject := old.subject;
    new.body := old.body;
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
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  new.author_id := auth.uid();
  if public.is_admin() then
    new.role := 'admin';
  else
    new.role := 'student';
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

drop trigger if exists support_tickets_force on public.support_tickets;
create trigger support_tickets_force
  before insert or update on public.support_tickets
  for each row execute procedure public.support_force_ticket();

drop trigger if exists support_replies_force on public.support_replies;
create trigger support_replies_force
  before insert on public.support_replies
  for each row execute procedure public.support_force_reply();

revoke all on function public.support_force_ticket() from public, anon;
revoke all on function public.support_force_reply() from public, anon;
