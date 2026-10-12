-- Zorro sohbet geçmişi. Kullanıcı yalnızca kendi satırlarını görür.
-- PRODUCTION'A otomatik uygulanmaz.
-- Mevcut 001–011 dosyalarına dokunulmaz. Mevcut kullanıcılar etkilenmez (yeni tablolar).

create table if not exists public.zorro_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Yeni sohbet',
  preview text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zorro_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.zorro_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint zorro_messages_role_check check (role in ('user', 'assistant'))
);

create index if not exists zorro_conversations_user_updated_idx
  on public.zorro_conversations (user_id, updated_at desc);

create index if not exists zorro_messages_conv_created_idx
  on public.zorro_messages (conversation_id, created_at);

alter table public.zorro_conversations enable row level security;
alter table public.zorro_messages enable row level security;

revoke all on public.zorro_conversations from anon, public;
revoke all on public.zorro_messages from anon, public;
grant select, insert, update, delete on public.zorro_conversations to authenticated;
grant select, insert, update, delete on public.zorro_messages to authenticated;

drop policy if exists "zorro_conversations_own_select" on public.zorro_conversations;
create policy "zorro_conversations_own_select" on public.zorro_conversations
  for select using (auth.uid() = user_id);

drop policy if exists "zorro_conversations_own_insert" on public.zorro_conversations;
create policy "zorro_conversations_own_insert" on public.zorro_conversations
  for insert with check (auth.uid() = user_id);

drop policy if exists "zorro_conversations_own_update" on public.zorro_conversations;
create policy "zorro_conversations_own_update" on public.zorro_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "zorro_conversations_own_delete" on public.zorro_conversations;
create policy "zorro_conversations_own_delete" on public.zorro_conversations
  for delete using (auth.uid() = user_id);

drop policy if exists "zorro_messages_own_select" on public.zorro_messages;
create policy "zorro_messages_own_select" on public.zorro_messages
  for select using (auth.uid() = user_id);

drop policy if exists "zorro_messages_own_insert" on public.zorro_messages;
create policy "zorro_messages_own_insert" on public.zorro_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.zorro_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "zorro_messages_own_delete" on public.zorro_messages;
create policy "zorro_messages_own_delete" on public.zorro_messages
  for delete using (auth.uid() = user_id);

create or replace function public.zorro_force_owner()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  new.user_id := auth.uid();
  if tg_table_name = 'zorro_messages' then
    if not exists (
      select 1 from public.zorro_conversations c
      where c.id = new.conversation_id and c.user_id = auth.uid()
    ) then
      raise exception 'Sohbet bulunamadı';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zorro_conversations_owner on public.zorro_conversations;
create trigger zorro_conversations_owner
  before insert or update on public.zorro_conversations
  for each row execute procedure public.zorro_force_owner();

drop trigger if exists zorro_messages_owner on public.zorro_messages;
create trigger zorro_messages_owner
  before insert on public.zorro_messages
  for each row execute procedure public.zorro_force_owner();
