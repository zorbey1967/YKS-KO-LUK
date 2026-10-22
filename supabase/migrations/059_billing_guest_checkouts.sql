-- 059: Hesapsız (giriş yapmadan) Shopier ödemesi.
--
-- Akış: tarayıcı "Ödeme Yap" der → sunucu bu tabloya bir satır ve Shopier ürünü açar, tarayıcıya tek
-- kullanımlık gizli anahtar verir (yalnız SHA-256 özeti saklanır) → Shopier webhook'u doğrulanır →
-- hesap açılır (Auth admin, sunucu) → guest_checkout_attach öğrenciye normal bir ödeme oturumu yazar →
-- paket mevcut apply_verified_payment (054/055) ile tanımlanır → tarayıcı anahtarla oturumunu alır.
--
-- Mevcut tablolar, RLS politikaları, 043/054/055/058 değişmez. Satır silinmez. Tekrar çalıştırılabilir.
-- İstemci (anon/authenticated) bu tabloya ve fonksiyona hiç erişemez; yalnız service_role.

create table if not exists public.billing_guest_checkouts (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null check (plan_id in ('pro', 'premium')),
  amount_try numeric(12,2) not null check (amount_try > 0),
  currency text not null default 'TRY',
  status text not null default 'pending' check (status in ('pending', 'redirected', 'paid', 'failed', 'expired')),
  provider text not null default 'shopier',
  provider_session_id text not null default '',
  claim_token_hash text not null,
  user_id uuid references auth.users(id) on delete set null,
  checkout_session_id uuid references public.billing_checkout_sessions(id) on delete set null,
  provider_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  claimed_at timestamptz
);

create unique index if not exists billing_guest_checkouts_token_uidx
  on public.billing_guest_checkouts (claim_token_hash);
create unique index if not exists billing_guest_checkouts_product_uidx
  on public.billing_guest_checkouts (provider, provider_session_id)
  where provider_session_id <> '';
create index if not exists billing_guest_checkouts_created_idx
  on public.billing_guest_checkouts (created_at desc);

alter table public.billing_guest_checkouts enable row level security;
alter table public.billing_guest_checkouts force row level security;
revoke all on table public.billing_guest_checkouts from public, anon, authenticated;
grant all on table public.billing_guest_checkouts to service_role;

comment on table public.billing_guest_checkouts is
  'Hesapsız Shopier ödemesi. İstemci erişimi yok; yalnız billing-guest / billing-webhook (service_role).';

-- Ödemesi doğrulanmış hesapsız ödemeyi öğrenciye bağlar ve ona normal bir ödeme oturumu açar.
-- Kilitli ve tekrar çalıştırılabilir: ikinci çağrı aynı oturumu döndürür, yeni satır açmaz.
-- Başka öğrenciye bağlanmış satır başka öğrenciye bağlanamaz.
create or replace function public.guest_checkout_attach(
  p_guest_id uuid,
  p_user_id uuid,
  p_order_id text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  g record;
  sid uuid;
begin
  if p_guest_id is null or p_user_id is null or coalesce(p_order_id, '') = '' then
    raise exception 'eksik_parametre';
  end if;

  select * into g from public.billing_guest_checkouts where id = p_guest_id for update;
  if not found then
    raise exception 'misafir_odeme_yok';
  end if;
  if g.user_id is not null and g.user_id is distinct from p_user_id then
    raise exception 'kullanici_uyusmuyor';
  end if;
  if g.provider_order_id is not null and g.provider_order_id is distinct from p_order_id then
    raise exception 'siparis_uyusmuyor';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'student') then
    raise exception 'ogrenci_profili_yok';
  end if;

  sid := g.checkout_session_id;
  if sid is null then
    insert into public.billing_checkout_sessions (
      user_id, plan_id, amount_try, currency, status, provider, provider_session_id
    ) values (
      p_user_id, g.plan_id, g.amount_try, g.currency, 'redirected', g.provider, g.provider_session_id
    )
    returning id into sid;
  end if;

  update public.billing_guest_checkouts
     set user_id = p_user_id,
         checkout_session_id = sid,
         provider_order_id = p_order_id,
         updated_at = pg_catalog.now()
   where id = p_guest_id;

  return sid;
end;
$$;

revoke all on function public.guest_checkout_attach(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.guest_checkout_attach(uuid, uuid, text) to service_role;
