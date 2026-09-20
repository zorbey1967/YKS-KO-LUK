-- YKS E-Koçluk şeması. Supabase SQL editor veya CLI ile çalıştırın.
-- RLS: her satır yalnızca kendi kullanıcısına açık.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  plan text not null default 'Ücretsiz',
  target_department text,
  target_rank integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.student_data enable row level security;

drop policy if exists "profiles_own_select" on public.profiles;
create policy "profiles_own_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_own_upsert" on public.profiles;
create policy "profiles_own_upsert" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "student_data_own_select" on public.student_data;
create policy "student_data_own_select" on public.student_data
  for select using (auth.uid() = user_id);

drop policy if exists "student_data_own_write" on public.student_data;
create policy "student_data_own_write" on public.student_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- plan alanını istemci yükseltmesin: trigger ile ücretsiz kilidi (ödeme webhook'u service role kullanır)
create or replace function public.protect_plan()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.plan := coalesce(old.plan, 'Ücretsiz');
    if new.plan is null or new.plan = '' then
      new.plan := 'Ücretsiz';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_plan on public.profiles;
create trigger profiles_protect_plan
  before insert or update on public.profiles
  for each row execute procedure public.protect_plan();
