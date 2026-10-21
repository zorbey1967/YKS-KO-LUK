# Shopier canlıya geçiş notları

Resmî olarak doğrulanmamış davranışlar işaretlidir. Bu dosya canlı ödeme veya secret içermez.

## İmza formatı (resmî portal yayımlamadı)

OpenAPI: webhook oluşturma yanıtındaki `token` payload imzalamak içindir. `developer.shopier.com` sayfalarında başlık adı, HMAC algoritması ve hex/Base64 kodlaması yok.

Kod adayı (kesin resmi destek diye kullanılmaz): ham gövde üzerinde HMAC-SHA256, `Shopier-Signature` başlığı, hex veya standart Base64. Uyuşmazsa retrieve ve üyelik yok.

## Webhook adresi

Shopier aboneliğine verilen adres: `https://e-kocluk.vercel.app/api/shopier/webhook`

- `api/shopier/webhook.ts` (Vercel Edge, `dub1`) → `api/_lib/shopierWebhook.ts`. Mantık Supabase `billing-webhook` Shopier dalıyla aynı; yalnız `supabase/functions/_shared` yardımcılarını kullanır.
- Supabase `billing-webhook` aynı token ile çalışmaya devam eder; Shopier’e yalnız biri verilir.
- `vercel.json` SPA yönlendirmesi `api/` hariç tutar. Aksi halde Shopier `index.html` için 200 alır ve olay kaybolur.
- Yanıt süresi 4,5 sn ile sınırlı; aşılırsa 503 (200 değil) ve Shopier tekrar dener. Olay kimliği ve RPC tekrar güvenlidir.

## Secrets

Vercel (yalnız Production, Sensitive, `VITE_` öneki yok): `SHOPIER_WEBHOOK_TOKEN`, `SHOPIER_PAT`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` (yoksa `VITE_SUPABASE_URL` okunur). İsteğe bağlı `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Preview ortamına service role eklemeyin.

Supabase Edge: `SHOPIER_PAT`, `SHOPIER_WEBHOOK_TOKEN` (create yanıtı, bir kez), `SHOPIER_PRODUCT_IMAGE_URL` (checkout). Brüt tahsilat 200,00 TRY teyit edilmeden satışa geçilmez.

## Canlı test

Gerçek küçük tutarlı sipariş; bu repoda çalıştırılmaz.

1. Secret’ları yukarıdaki gibi yazın.
2. PAT ile `POST /webhooks`: olay `order.created`, adres yukarıdaki Vercel adresi. Yanıttaki `token` Vercel ve Supabase’de `SHOPIER_WEBHOOK_TOKEN`.
3. İlk gerçek bildirimi izleyin:
   - 401: aday format canlı teslimatla uyuşmuyor; üyelik açılmamış olmalı. Shopier destek/dokümandan imza baytlarını teyit edin.
   - 502: sipariş GET başarısız.
   - `applied: false`: eşleme/tutar/durum reddi.
   - `applied: true`: GET `order.id` eşleşti ve RPC yazdı.

Tarayıcı teşekkür sayfası kanıt değildir.

## Webhook gelmezse

1. Öğrenci üyeliği açılmaz (`redirected` oturum).
2. Shopier panelinden sipariş `id` alın.
3. Service role ile `GET /orders/{id}` (`paid`, `TRY`, tutar, `productId`).
4. `billing_checkout_sessions.provider_session_id` = `productId` ve `user_id` doğru öğrenci mi bakın.
5. Eşleşme yoksa üyelik yazmayın; para iadesi veya manuel eşleme ayrı onay.
6. Eşleşme varsa mevcut `apply_verified_payment` (aynı `provider_payment_id`) — yeni RPC yok.
7. Poll/cron bu turda yok.

## Mükerrer ürün

Aynı öğrenci/plan, 6 saat içinde eşlenmiş `pending|redirected` oturum varsa yeni ürün açılmaz; URL `GET /products/{id}` ve DB yeniden okuma sonrası döner. Ürün silinmişse eski oturum `failed`, yeni ürün denenir.

Shopier panelinde fazla dijital ürün: stok 0 veya sil; `orphan_product` olayına bakın.

## Orphan ürün (oluştu, eşleme yok)

Checkout URL dönmez. Silme başarısızsa `billing_events` (`event_type = orphan_product`, `event_id = orphan-product:{productId}:{sessionId}`).

Webhook eşlenmemiş `productId` için üyelik açmaz (`urun_oturum_yok`). Yanlış öğrenciye grant yok.

Uzlaştırma: panelde ürünü kapatın; ödeme olduysa iade veya (onaylı) `productId` → doğru oturum yazımı sonra webhook/RPC. Oturum yazmadan üyelik açmayın.

## İade

055 `apply_payment_refund`: karar `GET /orders/{id}` siparişindeki `succeeded` iadelerin toplamından verilir (`Shopier-Event` yalnız etiket). Tam iadede o ödemenin kapsadığı süre düşülür; kalan süre yoksa erişim kapanır. Kısmi iadede erişim değişmez.

`refund.updated` ayrı abonelik ister ve kendi `token`’ını döndürebilir; kod tek `SHOPIER_WEBHOOK_TOKEN` okur. Token farklıysa iade bildirimi 401 alır. Doğrulanmadı.

İade gövdesinde sipariş kimliği alanı gerçek bildirimle doğrulanmadı. Vercel endpoint’i (`shopierWebhookOrderId`) açık sipariş alanlarını sırayla dener: `data.orderId`, `data.order.id`, `data.order_id`, `orderId`, `order.id`, `order_id`. İade olaylarında kök `id` / `data.id` iade kimliği olabileceği için kullanılmaz; açık alan yoksa 400 döner ve sipariş sorgulanmaz. Supabase `billing-webhook` eski sırayı (`data.id` önce) korur; Shopier’e yalnız Vercel adresi verilir.
