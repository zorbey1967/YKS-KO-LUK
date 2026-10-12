-- TASLAK. PRODUCTION / STAGING’e bu adımda uygulanmaz.
-- Shopier checkout: billing_checkout_sessions.provider_session_id = Shopier product.id
-- apply_verified_payment p_provider serbest metin; shopier için yeni RPC gerekmez.
-- Benzersiz ürün eşlemesi (boş id’ler hariç).

create unique index if not exists billing_checkout_shopier_product_uidx
  on public.billing_checkout_sessions (provider, provider_session_id)
  where provider = 'shopier' and coalesce(provider_session_id, '') <> '';
