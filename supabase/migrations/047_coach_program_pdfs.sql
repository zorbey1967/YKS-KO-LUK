-- Koç → öğrenci ders programı PDF. Öğrencinin kendi schedule-pdfs kovası ayrıdır.
-- Path: {student_uid}/{submission_id}.pdf
-- RLS: öğrenci kendi; koç yalnızca coach_linked_to_student.

create table if not exists public.coach_program_pdfs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  student_name text not null default '',
  storage_path text not null,
  file_name text not null default '',
  file_size integer not null default 0 check (file_size >= 0 and file_size <= 12582912),
  created_at timestamptz not null default now(),
  constraint coach_program_pdf_path_owns_student check (storage_path like (student_id::text || '/%')),
  constraint coach_program_pdf_name_len check (char_length(file_name) between 1 and 260),
  constraint coach_program_pdf_path_len check (char_length(storage_path) between 10 and 400)
);

create index if not exists coach_program_pdfs_student_created_idx
  on public.coach_program_pdfs (student_id, created_at desc);
create index if not exists coach_program_pdfs_coach_created_idx
  on public.coach_program_pdfs (coach_id, created_at desc);

alter table public.coach_program_pdfs enable row level security;
alter table public.coach_program_pdfs force row level security;

revoke all on table public.coach_program_pdfs from anon, public;
grant select, insert on table public.coach_program_pdfs to authenticated;

drop policy if exists coach_program_pdf_select on public.coach_program_pdfs;
create policy coach_program_pdf_select on public.coach_program_pdfs
  for select using (
    public.caller_account_active()
    and (
      student_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.coaches c
        where c.user_id = auth.uid()
          and c.status = 'active'
          and c.id = coach_id
          and public.coach_linked_to_student(c.id, student_id)
      )
    )
  );

drop policy if exists coach_program_pdf_insert on public.coach_program_pdfs;
create policy coach_program_pdf_insert on public.coach_program_pdfs
  for insert with check (
    public.caller_account_active()
    and auth.uid() is not null
    and exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid()
        and c.status = 'active'
        and c.id = coach_id
        and public.coach_linked_to_student(c.id, student_id)
    )
    and storage_path like (student_id::text || '/%')
  );

create or replace function public.coach_program_pdf_force_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cid uuid;
  pname text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if public.is_admin() then
    return new;
  end if;
  select c.id into cid from public.coaches c
   where c.user_id = auth.uid() and c.status = 'active' limit 1;
  if cid is null then
    raise exception 'Aktif koç hesabı gerekli';
  end if;
  new.coach_id := cid;
  if new.student_id is null or not public.coach_linked_to_student(cid, new.student_id) then
    raise exception 'Bu öğrenciye program yükleyemezsin';
  end if;
  if new.storage_path is null or new.storage_path not like (new.student_id::text || '/%') then
    raise exception 'Geçersiz dosya yolu';
  end if;
  new.file_name := left(trim(coalesce(new.file_name, 'koc-program.pdf')), 260);
  select left(trim(coalesce(p.name, '')), 120) into pname from public.profiles p where p.id = new.student_id;
  new.student_name := coalesce(nullif(pname, ''), 'Öğrenci');
  return new;
end;
$$;

drop trigger if exists coach_program_pdf_force on public.coach_program_pdfs;
create trigger coach_program_pdf_force
  before insert on public.coach_program_pdfs
  for each row execute procedure public.coach_program_pdf_force_row();

revoke all on function public.coach_program_pdf_force_row() from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-program-pdfs',
  'coach-program-pdfs',
  false,
  12582912,
  array['application/pdf']::text[]
)
on conflict (id) do update
  set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists coach_program_pdfs_insert on storage.objects;
create policy coach_program_pdfs_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'coach-program-pdfs'
  and public.caller_account_active()
  and storage.extension(objects.name) = 'pdf'
  and exists (
    select 1 from public.coaches c
    where c.user_id = auth.uid()
      and c.status = 'active'
      and public.coach_linked_to_student(c.id, ((storage.foldername(objects.name))[1])::uuid)
  )
);

drop policy if exists coach_program_pdfs_select on storage.objects;
create policy coach_program_pdfs_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'coach-program-pdfs'
  and public.caller_account_active()
  and (
    (storage.foldername(objects.name))[1] = (select auth.uid()::text)
    or public.is_admin()
    or exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid()
        and c.status = 'active'
        and public.coach_linked_to_student(c.id, ((storage.foldername(objects.name))[1])::uuid)
    )
  )
);
