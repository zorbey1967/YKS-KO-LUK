-- Yerel / staging. Production’a bu turda uygulanmaz.
-- 004 appointment_starts_at EXECUTE’u authenticated’dan aldı.
-- UPDATE tetikleyicisi starts_at hesaplarken 42501: koç/öğrenci durum güncelleyemez.
-- Fonksiyon salt tarih+saat; yetki genişletmez.

grant execute on function public.appointment_starts_at(date, text) to authenticated;
