-- coaches.name gölgelemesi: EXISTS alt sorguda bare `name` → c.name oluyordu.
-- storage.objects.name açıkça kullanılmalı.

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

drop policy if exists schedule_pdfs_select_own_or_coach on storage.objects;
create policy schedule_pdfs_select_own_or_coach
on storage.objects
for select
to authenticated
using (
  bucket_id = 'schedule-pdfs'
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
