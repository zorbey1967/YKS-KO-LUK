-- Öğrenci ders programı PDF → bağlı koç. Additive / idempotent.
-- Storage path: {student_uid}/{submission_id}.pdf — başka öğrenci klasörüne yazılmaz.
-- RLS: öğrenci kendi; koç yalnızca coach_linked_to_student.

create or replace function public.student_linked_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cid from (
    select m.coach_id as cid, 1 as ord
      from public.coach_matches m
     where m.student_id = auth.uid() and m.status = 'active'
    union all
    select a.coach_id, 2
      from public.appointments a
     where a.student_id = auth.uid() and a.status = 'onay'
  ) x
  order by ord
  limit 1;
$$;

revoke all on function public.student_linked_coach_id() from public, anon;
grant execute on function public.student_linked_coach_id() to authenticated;

create table if not exists public.schedule_pdf_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  student_name text not null default '',
  storage_path text not null,
  file_name text not null default '',
  file_size integer not null default 0 check (file_size >= 0 and file_size <= 12582912),
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  constraint schedule_pdf_status_check check (status in ('sent')),
  constraint schedule_pdf_path_owns_student check (storage_path like (student_id::text || '/%')),
  constraint schedule_pdf_name_len check (char_length(file_name) between 1 and 260),
  constraint schedule_pdf_path_len check (char_length(storage_path) between 10 and 400)
);

create index if not exists schedule_pdf_submissions_coach_created_idx
  on public.schedule_pdf_submissions (coach_id, created_at desc);
create index if not exists schedule_pdf_submissions_student_created_idx
  on public.schedule_pdf_submissions (student_id, created_at desc);

alter table public.schedule_pdf_submissions enable row level security;
alter table public.schedule_pdf_submissions force row level security;

revoke all on table public.schedule_pdf_submissions from anon, public;
grant select, insert on table public.schedule_pdf_submissions to authenticated;

drop policy if exists schedule_pdf_select on public.schedule_pdf_submissions;
create policy schedule_pdf_select on public.schedule_pdf_submissions
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

drop policy if exists schedule_pdf_insert on public.schedule_pdf_submissions;
create policy schedule_pdf_insert on public.schedule_pdf_submissions
  for insert with check (
    public.caller_account_active()
    and auth.uid() is not null
    and student_id = auth.uid()
    and public.coach_linked_to_student(coach_id, auth.uid())
    and storage_path like (auth.uid()::text || '/%')
  );

create or replace function public.schedule_pdf_force_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked uuid;
  pname text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if public.is_admin() then
    return new;
  end if;
  new.student_id := auth.uid();
  linked := public.student_linked_coach_id();
  if linked is null then
    raise exception 'Bağlı koç yok';
  end if;
  if new.coach_id is distinct from linked and not public.coach_linked_to_student(new.coach_id, auth.uid()) then
    raise exception 'Bu koça gönderemezsin';
  end if;
  if not public.coach_linked_to_student(new.coach_id, auth.uid()) then
    new.coach_id := linked;
  end if;
  if new.storage_path is null or new.storage_path not like (auth.uid()::text || '/%') then
    raise exception 'Geçersiz dosya yolu';
  end if;
  new.status := 'sent';
  new.file_name := left(trim(coalesce(new.file_name, 'program.pdf')), 260);
  select left(trim(coalesce(p.name, '')), 120) into pname from public.profiles p where p.id = auth.uid();
  new.student_name := coalesce(nullif(pname, ''), left(coalesce(auth.jwt() ->> 'email', 'Öğrenci'), 80));
  return new;
end;
$$;

drop trigger if exists schedule_pdf_force on public.schedule_pdf_submissions;
create trigger schedule_pdf_force
  before insert on public.schedule_pdf_submissions
  for each row execute procedure public.schedule_pdf_force_row();

revoke all on function public.schedule_pdf_force_row() from public, anon;

-- Storage kova (private).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'schedule-pdfs',
  'schedule-pdfs',
  false,
  12582912,
  array['application/pdf']::text[]
)
on conflict (id) do update
  set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists schedule_pdfs_insert_own on storage.objects;
create policy schedule_pdfs_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'schedule-pdfs'
  and public.caller_account_active()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) = 'pdf'
);

drop policy if exists schedule_pdfs_select_own_or_coach on storage.objects;
create policy schedule_pdfs_select_own_or_coach
on storage.objects
for select
to authenticated
using (
  bucket_id = 'schedule-pdfs'
  and public.caller_account_active()
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or public.is_admin()
    or exists (
      select 1 from public.coaches c
      where c.user_id = auth.uid()
        and c.status = 'active'
        and public.coach_linked_to_student(c.id, ((storage.foldername(objects.name))[1])::uuid)
    )
  )
);

drop policy if exists schedule_pdfs_delete_own on storage.objects;
create policy schedule_pdfs_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'schedule-pdfs'
  and public.caller_account_active()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
