-- Yerel / staging. Production’a bu turda uygulanmaz.
-- Koç JWT ile DELETE geçmişi silerdi (029 appt_delete). Durum geçişi RPC/UPDATE ile kalır; satır silinmez.

drop policy if exists "appt_delete" on public.appointments;
create policy "appt_delete" on public.appointments
  for delete using (public.is_admin());
