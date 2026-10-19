# Canlıya geçiş kontrol listesi (uygulanmadı)

Canlı katalog: **001–010**. 011–026 ve 027–032 canlıda yok. Canlı proje `naiakscryafhvcghjmzx` bu turda hedef değildir.

Yerel kanıt: `npx supabase db reset --local` → 001–005 ve 007–038. Depoda 006 yok. 011–038 canlıda yok. Deneme 14 gün. Google OAuth Dashboard’da Automatic linking kapalı olmalı.

## Google OAuth (canlıda doğrulanmadı)

Kod: `signInWithOAuth({ provider: 'google' })`, PKCE, `redirectTo` origin `/`, `shouldAutoLinkIdentities() === false`.

Canlıda yapılacaklar (değer buraya yazılmaz):

1. Google Cloud: OAuth 2.0 Web client; yetkili yönlendirme `https://<proje>.supabase.co/auth/v1/callback` ve site origin `/`.
2. Supabase Dashboard → Authentication → Providers → Google: Client ID + Secret; **Automatic account linking kapalı**.
3. Site URL ve Redirect URLs: üretim origin (`https://e-kocluk.vercel.app/`).
4. Yerel `config.toml` `[auth.external.google] enabled = false` kalır ta ki `YKS_GOOGLE_CLIENT_ID` / `YKS_GOOGLE_CLIENT_SECRET` verilene kadar.

Canlı Google giriş E2E bu turda yok.

Canlı kapatma (uygulanmadı): 027–036 dağıtımı → `platform_owner` UUID insert (e-posta yok) → `preview_disable_non_owner_accounts` → `p_expect` eşleşmesi → `disable_non_owner_accounts` → `grant_owner_premium_entitlement`. Eşleşmezse dur. Aday `profiles.role=admin` sahip değildir.

İzole `npm run test:pg:security` ayrı throwaway Postgres’tir; bulut doğrulaması değildir.

Ön kontrol (dry-run, dağıtım yok):

```
npm run pack:bank
npm run verify:bank
npm run staging:check
```

`--apply` yalnızca komut listesi basar; `STAGING_CONFIRM=I_UNDERSTAND_STAGING` ve canlı olmayan `YKS_STAGING_PROJECT_REF` ister. Canlı `naiakscryafhvcghjmzx` / `*.supabase.co` reddedilir. `config.toml` `project_id` yerel konteyner adıdır; uzak apply hedefi olamaz. `disable_non_owner_accounts` betikte yok.

## Staging sıra

027 → 028 → 029 → 030 → 031 → 032 → 033 → 034 → 035 → 036 → 037 → 038

033: `appointment_starts_at` GRANT (randevu durum 42501). 034: `coach_directory_cards()` SECURITY DEFINER + `search_path=''`; görünüm invoker, yalnız genel kart. `email` / `user_id` / `score` yok.

Yerel kurulum: `supabase/tests/LOCAL_SETUP.md`.

Sonra edge: `admin-account-status` → `student-ai` → `exam-scan` → `bank-pack` (`pack.json` fonksiyon klasöründe; `npm run pack:bank`).

032, 030 `platform_owner` ister. 030, 029 `caller_account_active` ister. 011/005 sonrası 027 tekrar.

## Edge ortam değişkenleri (değer yok)

| Fonksiyon | Değişken |
|---|---|
| tümü | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| admin-account-status, billing-checkout, billing-webhook | `SUPABASE_SERVICE_ROLE_KEY` |
| student-ai, exam-scan | `GEMINI_API_KEY` (`GEMINI_MODEL` isteğe bağlı) |
| billing-checkout / webhook | `SHOPIER_PAT`, `SHOPIER_WEBHOOK_TOKEN`, `SHOPIER_PRODUCT_IMAGE_URL` |
| meeting-token | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |

Canlı anahtar kullanma. Uzak staging projesi bu turda yok.

## 032 önizleme (hesap değiştirmez)

Sahip UUID yoksa / yanlışsa / pasifse yazma yok. Canlı sayılar uydurulmaz. Çıktı kaydı zorunlu:

`total_profiles`, `would_suspend_profiles`, `would_pasif_coaches`, `coach_rows`, `appointment_count`, `meeting_count`, `payment_count`.

```
select public.preview_disable_non_owner_accounts('<sahip-uuid>'::uuid);
```

Kaydetmeden ve `p_expect` ile birebir karşılaştırmadan kapatma yok:

```
select public.disable_non_owner_accounts('<uuid>'::uuid, '<önizleme-json>'::jsonb);
```

`p_expect` yoksa veya sayılar eşleşmezse skip. Randevu/görüşme/ödeme silinmez; sayı değişirse exception. Toplu kapatma otomatik çalışmaz.

## Banka

1. `verify:bank` — 7007 / 17 / 501 / sha256; `pack.json` gitignore  
2. `bank-pack` canlı deploy **yok**  
3. Öğrenci: manifest `pack:true`; koç 403; askı 403; üyeliksiz 402; paket yok/bozuk 503  

Eksik uzak staging: `YKS_STAGING_PROJECT_REF` (canlı değil), `SUPABASE_ACCESS_TOKEN`, ayrı ücretli proje onayı.

## Geri dönüş

Askı: `admin_set_account_status(..., 'active')`. Pack: önceki sha256. Edge: önceki sürüm.

## 055 ticari hazırlık (uygulanmadı)

`supabase/migrations/055_commercial_readiness.sql` tek dosya, additive, idempotent; satır silmez.
Canlı şemanın hangi durumda olduğundan bağımsız aynı sonucu verir (yalnız 041–049 ya da 011–049 tam zincir).

- Profil: istemci yalnızca kendi `name / target_department / target_rank / updated_at` alanını yazar; INSERT/DELETE ve e-posta/rol/plan yazımı kapalı (e-posta ile yönetici olma açığı).
- Kayıt: ad-soyad, niyet, sınıf, alan, sınav profile yazılır; öğrenci hemen aktif; onaylı koçlar `role='coach'`.
- Ödeme: süre bitmeden yenileme / Pro→Premium kalan günleri korur; aynı ödeme tekrar gelirse süre uzamaz.
- İade: `apply_payment_refund` (yalnız sunucu); tam iade süreyi düşer, kalan yoksa erişim kapanır; kısmi iade erişimi değiştirmez.
- Deneme: e-postası doğrulanmamış hesap başlatamaz.

Önce prova (Docker açık): `npm run test:pg:commercial` → `PG_COMMERCIAL_OK`.
Canlıya uygulamadan önce canlıdaki `supabase_migrations.schema_migrations` listesi ve `pg_dump --schema-only` alınır; 055 önce staging'de çalıştırılır.

Shopier imza formatı (başlık/HMAC kodlaması) gerçek küçük bir ödeme + iade ile **henüz doğrulanmadı** (bkz. `supabase/functions/_shared/shopierWebhook.ts` TODO).
