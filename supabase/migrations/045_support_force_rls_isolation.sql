-- Destek tablolarında FORCE RLS: tablo sahibi bile RLS’yi atlayamaz.
-- Additive / idempotent. Politika metni 044 ile aynı kalır; yalnızca FORCE açılır.
-- Öğrenci izolasyonu: SELECT user_id = auth.uid() OR is_admin().

alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;

alter table public.support_replies enable row level security;
alter table public.support_replies force row level security;

-- Mevcut politikalar 044’te; yeniden idempotent kurulum (drift önleme).
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

revoke all on table public.support_tickets from anon, public;
revoke all on table public.support_replies from anon, public;
grant select, insert, update on table public.support_tickets to authenticated;
grant select, insert on table public.support_replies to authenticated;
