# Öğrenci E-Koçluk

YKS ve okul öğrencileri için kişisel çalışma paneli: görev, hedef, deneme, net, konu, soru bankası ve odak süresi.

Canlı adres: https://e-kocluk.vercel.app/

## Çalıştırma

```bash
npm install
npm run dev
```

Tarayıcı: `http://localhost:5173`

## Ortam

`.env.example` dosyasını `.env` olarak kopyala (yalnızca yerel geliştirme; GitHub’a koyma):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (yalnızca publishable/anon key)
- `VITE_ADMIN_EMAIL` (yönetici paneli görünürlüğü; asıl yetki RLS)

Canlı yayın için aynı `VITE_*` değişkenlerini Vercel → Project → Settings → Environment Variables → Production’a ekle, ardından **Redeploy**. Vite bunları build anında gömer. `service_role` anahtarını Vercel’e veya frontend’e koyma.

SQL şeması: `supabase/migrations/` — SQL Editor veya onaylı CLI ile bilinçli uygulanır; uygulama otomatik SQL çalıştırmaz.

## Mimari

- Vite + React + TypeScript
- Yerel veri: `localStorage` (`yks_v7_*`)
- Giriş: Supabase Auth
- Bulut: `profiles` + `student_data` (JSON)
- Soru bankası: `src/data/bankData.ts`

## Yerel kod, canlı veritabanı, ödeme

Üç katmanı karıştırmayın:

1. **Yerel git dalı** (`feature/shopier-billing`): Shopier checkout/webhook kodu, ZORRO, soru bankası ve migration dosyaları `009`–`028` repoda durur. Bu, canlı şemanın birebir kopyası değildir.
2. **Canlı Supabase** (son denetim): `schema_migrations` yalnızca **001–010**. Billing tabloları, `student_entitled` ve Shopier product map **yok**. Görüntülü görüşme 009/010 ile canlıda vardır; kayıt yok.
3. **Gerçek ödeme**: Tarayıcı üyelik ekranı Shopier’e yönlendirecek şekilde yazılmıştır. Canlıda checkout tabloları ve onaylı edge deploy olmadan **tahsilat/üyelik açılmaz**. Kampanya fiyatları (`src/lib/plans.ts`) istemci göstergesidir; tutar sunucu kataloğundan kilitlenir.

`027_live010_no_email_admin.sql` e-posta ile yönetici yapmayı kapatmak için 010 şemasına uygundur; otomatik uygulanmaz. `023` aynı niyetin sonraki zincir dosyasıdır; `handle_new_user` ve anon tetikleyici REVOKE `027`’dedir.

Yönetici paneli yalnızca sunucu `is_admin()` (oturum `auth.uid()` + `profiles.role` + `active`) ile açılır. `VITE_ADMIN_EMAIL` görünürlük/yardımcı alandır, yetki vermez. `service_role` anahtarını Vercel’e veya frontend’e koyma.

## Google indeksleme

Teknik SEO (`title`, `description`, canonical, `robots.txt`, `sitemap.xml`) hazırdır. Google’da görünmesi için [Google Search Console](https://search.google.com/search-console) üzerinden `https://e-kocluk.vercel.app/` özelliği ekleyip sitemap’i gönderin. Hash sayfalar (`#/coaches` vb.) ayrı URL olarak indekslenmez.
