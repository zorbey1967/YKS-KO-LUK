-- 020+021+016+022 throwaway PG. ROLLBACK. Üretim yok.

begin;

do $$
declare
  uid uuid := '55555555-5555-4555-8555-555555555555';
  chk uuid := '66666666-6666-4666-8666-666666666666';
  r1 jsonb;
  r2 jsonb;
  e1 timestamptz;
  e2 timestamptz;
  n int;
begin
  insert into auth.users (id, email_confirmed_at) values (uid, now())
    on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
  insert into public.profiles (id, role, account_status, plan)
    values (uid, 'student', 'active', 'Ücretsiz')
    on conflict (id) do update set role = 'student', account_status = 'active';
  insert into public.billing_checkout_sessions (id, user_id, plan_id, amount_try, currency, status)
    values (chk, uid, 'pro', 100, 'TRY', 'pending')
    on conflict (id) do nothing;

  r1 := public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_atom', 100, chk, 'pay_atom');
  if (r1->>'ok') is distinct from 'true' or (r1->>'duplicate_payment')::boolean then
    raise exception 'ilk ödeme duplicate olmamalı: %', r1;
  end if;
  e1 := (r1->>'period_end')::timestamptz;

  r2 := public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_atom', 100, chk, 'pay_atom');
  if not (r2->>'duplicate_payment')::boolean then
    raise exception 'aynı id ikinci çağrı duplicate olmalı: %', r2;
  end if;
  e2 := (r2->>'period_end')::timestamptz;
  if e1 is distinct from e2 then
    raise exception 'aynı ödeme süreyi uzattı: % -> %', e1, e2;
  end if;
  select subscription_ends_at into e2 from public.profiles where id = uid;
  if e1 is distinct from e2 then
    raise exception 'profil period_end kaydı uzadı';
  end if;

  -- Kısmi yazım + retry: payment var, abonelik yok.
  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (uid, chk, 100, 'TRY', 'succeeded', 'iyzico', 'pay_partial');
  delete from public.billing_subscriptions where user_id = uid;
  r1 := public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_partial', 100, chk, '');
  if not (r1->>'duplicate_payment')::boolean then
    raise exception 'partial retry duplicate (ödeme satırı vardı) olmalı';
  end if;
  e1 := (r1->>'period_end')::timestamptz;
  r2 := public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_partial', 100, chk, '');
  if (r1->>'period_end') is distinct from (r2->>'period_end') then
    raise exception 'partial retry ikinci kez uzattı';
  end if;

  -- Farklı payment_id: mevcut ürün kuralı yeni 30 gün (burada kanıt, kural değişmedi).
  r2 := public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_other', 100, chk, '');
  if (r2->>'duplicate_payment')::boolean then
    raise exception 'farklı id duplicate olmamalı';
  end if;
  if (r2->>'period_end')::timestamptz <= e1 then
    raise exception 'farklı ödeme kimliği mevcut kuralda yeni period_end yazmalı';
  end if;

  select count(*) into n from public.billing_payments
    where user_id = uid and provider_payment_id in ('pay_atom', 'pay_partial', 'pay_other');
  if n <> 3 then
    raise exception 'üç ayrı payment_id beklenirdi, got %', n;
  end if;

  begin
    perform public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_atom', 50, chk, '');
    raise exception 'tutar uyuşmazlığı istisna üretmeli';
  exception
    when others then
      if sqlerrm not like '%tutar_uyusmuyor%' then
        raise exception 'beklenen tutar_uyusmuyor, got %', sqlerrm;
      end if;
  end;

  insert into public.billing_checkout_sessions (id, user_id, plan_id, amount_try, currency, status)
    values ('88888888-8888-4888-8888-888888888888', uid, 'pro', 100, 'USD', 'pending');
  begin
    perform public.apply_verified_payment(
      uid, 'pro', 'iyzico', 'pay_usd', 100, '88888888-8888-4888-8888-888888888888'::uuid, '');
    raise exception 'USD istisna üretmeli';
  exception
    when others then
      if sqlerrm not like '%para_birimi%' then
        raise exception 'beklenen para_birimi, got %', sqlerrm;
      end if;
  end;

  update public.billing_subscriptions set status = 'canceled' where user_id = uid;
  r1 := public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_atom', 100, chk, '');
  if not (r1->>'duplicate_payment')::boolean then
    raise exception 'iptal sonrası aynı id duplicate kalmalı';
  end if;

  update public.billing_subscriptions
    set period_end = now() - interval '1 day', status = 'expired' where user_id = uid;
  e1 := (select period_end from public.billing_subscriptions where user_id = uid);
  r1 := public.apply_verified_payment(uid, 'pro', 'iyzico', 'pay_atom', 100, chk, '');
  if (select period_end from public.billing_subscriptions where user_id = uid) is distinct from e1 then
    raise exception 'aynı id süresi dolmuş üyeliği uzatmamalı';
  end if;
end
$$;

rollback;
