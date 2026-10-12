-- Yerel / throwaway PostgreSQL. Production’a bu turda uygulanmaz.
-- student_data JSON içindeki sessions dizisini id’ye göre tekilleştirir.

create table if not exists public.student_data (
  user_id uuid primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.student_data enable row level security;
alter table public.student_data force row level security;
grant usage on schema public to authenticated, anon;

drop policy if exists "student_data_own_select" on public.student_data;
create policy "student_data_own_select" on public.student_data
  for select using (auth.uid() = user_id);

drop policy if exists "student_data_own_write" on public.student_data;
create policy "student_data_own_write" on public.student_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.student_data to authenticated;

create or replace function public.canonicalize_student_json(d jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  sessions jsonb := '[]'::jsonb;
  seen text[] := '{}';
  el jsonb;
  sid text;
begin
  if d is null or jsonb_typeof(d) <> 'object' then
    return '{}'::jsonb;
  end if;
  for el in select jsonb_array_elements(coalesce(d->'sessions', '[]'::jsonb))
  loop
    sid := el->>'id';
    if sid is null or sid = '' or sid = any(seen) then
      continue;
    end if;
    seen := array_append(seen, sid);
    sessions := sessions || jsonb_build_array(el);
  end loop;
  return d || jsonb_build_object('sessions', sessions);
end;
$$;

create or replace function public.student_data_canonicalize()
returns trigger
language plpgsql
as $$
begin
  new.data := public.canonicalize_student_json(coalesce(new.data, '{}'::jsonb));
  return new;
end;
$$;

drop trigger if exists student_data_canonicalize_biu on public.student_data;
create trigger student_data_canonicalize_biu
before insert or update of data on public.student_data
for each row execute procedure public.student_data_canonicalize();
