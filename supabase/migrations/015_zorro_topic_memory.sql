-- Öğrenme hafızası (conversation değil).
-- PRODUCTION otomatik uygulanmaz.
-- 012 sohbet tablolarına dokunulmaz.

create table if not exists public.zorro_topic_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  subject text not null default '',
  mastery smallint,
  confidence smallint,
  last_seen timestamptz,
  attempts int not null default 0,
  correct int not null default 0,
  incorrect int not null default 0,
  common_errors text not null default '',
  recommended_next_step text not null default '',
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, topic, subject)
);

create index if not exists zorro_topic_memory_user_idx on public.zorro_topic_memory (user_id, updated_at desc);

alter table public.zorro_topic_memory enable row level security;
revoke all on public.zorro_topic_memory from anon, public;
grant select, insert, update, delete on public.zorro_topic_memory to authenticated;

drop policy if exists "zorro_mem_own_all" on public.zorro_topic_memory;
create policy "zorro_mem_own_all" on public.zorro_topic_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.zorro_topic_memory is
  'Öğrenme hafızası. Sohbet geçmişinden ayrı. mastery 0–5; 8 denemeden azsa null bırakın.';
