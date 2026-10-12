# Shopier canlıya geçiş notları

Resmî olarak doğrulanmamış davranışlar işaretlidir. Bu dosya canlı ödeme veya secret içermez.

## İmza formatı (resmî portal yayımlamadı)

OpenAPI: webhook oluşturma yanıtındaki `token` payload imzalamak içindir. `developer.shopier.com` sayfalarında başlık adı, HMAC algoritması ve hex/Base64 kodlaması yok.

Kod adayı (kesin resmi destek diye kullanılmaz): ham gövde üzerinde HMAC-SHA256, `Shopier-Signature` başlığı, hex veya standart Base64. Uyuşmazsa retrieve ve üyelik yok.

**Canlı test (gerçek küçük tutarlı sipariş, bu repoda çalıştırılmaz):**

1. Edge’e `SHOPIER_PAT`, `SHOPIER_WEBHOOK_TOKEN`, `SHOPIER_PRODUCT_IMAGE_URL` yazın.
2. `POST /webhooks` ile `order.created` → `.../functions/v1/billing-webhook`.
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

## Tam iade — ürün kararı (kod kesmez)

Şu an: `billing_payments.status = refunded`. `profiles` / dönem bitişi değişmez. Öğrenci dönem sonuna kadar erişir.

Karar gerektirir (uygulanmadı): hemen kes, dönem sonunda kes, veya kesme. Chargeback/destek süreci netleşmeden otomatik kesme eklenmedi.

## Secrets

`SHOPIER_PAT`, `SHOPIER_WEBHOOK_TOKEN` (create yanıtı, bir kez), `SHOPIER_PRODUCT_IMAGE_URL`. `VITE_*` yok. Brüt tahsilat 200,00 TRY teyit edilmeden satışa geçilmez.
