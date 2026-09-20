# Öğrenci E-Koçluk

YKS öğrencileri için kişisel çalışma paneli: görev, hedef, deneme, net, konu, soru bankası ve odak süresi.

## Çalıştırma

```bash
npm install
npm run dev
```

Tarayıcı: `http://localhost:5173`

## Ortam

`.env.example` dosyasını `.env` olarak kopyala:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (yalnızca publishable/anon key)

SQL şeması: `supabase/migrations/001_init.sql` — Supabase SQL editor’de bir kez çalıştır.

## Mimari

- Vite + React + TypeScript
- Yerel veri: `localStorage` (`yks_v7_*`), eski `yks_v6_*` yedekleri okunur
- Giriş: Supabase Auth
- Bulut: `profiles` + `student_data` (JSON); tablo yoksa uygulama yerel çalışır
- Soru bankası: `src/data/bankData.ts` (YKS TYT/AYT, özgün alıştırma soruları)

Eski tek dosyalık V31 arayüzü `legacy/app-v31.html` içinde durur; üretim girişi bu React uygulamasıdır.

## Üyelik ve AI

Üyelik ekranı hazır; plan alanı istemciden yükseltilemez (SQL tetikleyici). Gerçek ödeme ve model çağrısı sonraki adım: Edge Function + webhook.
