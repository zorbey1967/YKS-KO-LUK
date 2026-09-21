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

SQL şeması: `supabase/migrations/` — SQL Editor’de bilinçli uygulanır; uygulama otomatik SQL çalıştırmaz.

## Mimari

- Vite + React + TypeScript
- Yerel veri: `localStorage` (`yks_v7_*`)
- Giriş: Supabase Auth
- Bulut: `profiles` + `student_data` (JSON)
- Soru bankası: `src/data/bankData.ts`

## Üyelik

Üyelik ekranı arayüz denemesidir. Gerçek ödeme ve görüntülü görüşme bağlı değildir.

## Google indeksleme

Teknik SEO (`title`, `description`, canonical, `robots.txt`, `sitemap.xml`) hazırdır. Google’da görünmesi için [Google Search Console](https://search.google.com/search-console) üzerinden `https://e-kocluk.vercel.app/` özelliği ekleyip sitemap’i gönderin. Hash sayfalar (`#/coaches` vb.) ayrı URL olarak indekslenmez.
