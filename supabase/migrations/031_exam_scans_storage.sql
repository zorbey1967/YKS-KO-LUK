-- Yerel / staging taslak. Production’a bu turda uygulanmaz.
-- Resmî Storage: özel kova RLS’e tabidir; herkese açık URL yoktur.
-- https://supabase.com/docs/guides/storage/buckets/fundamentals
-- https://supabase.com/docs/guides/storage/security/access-control
-- Koçlara Storage okuma verilmez; raporlar exam_reports / exam-scan üzerinden.
-- Kova MIME listesi Content-Type/uzantıya bakar; sihirli bayt exam-scan sniffMime ile.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exam-scans',
  'exam-scans',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
  set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "exam_scans_insert_own" on storage.objects;
create policy "exam_scans_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exam-scans'
  and public.caller_account_active()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'pdf')
);

drop policy if exists "exam_scans_select_own" on storage.objects;
create policy "exam_scans_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exam-scans'
  and public.caller_account_active()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "exam_scans_delete_own" on storage.objects;
create policy "exam_scans_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exam-scans'
  and public.caller_account_active()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "exam_scans_update_own" on storage.objects;
-- Güncelleme yok: upsert ile başkasının dosyasını ezmeyi kapat.
