-- Gerçek PostgreSQL. 020 + 021 + 016 uygulanmış throwaway DB.
-- activatePaid TypeScript değil; 016 unique + “süre uzatma” SQL eşdeğeri.
-- Üretim URL yok. ROLLBACK.

begin;

do $$
declare
  uid uuid := '55555555-5555-4555-8555-555555555555';
  chk uuid := '66666666-6666-4666-8666-666666666666';
  kept timestamptz := '2026-12-01T00:00:00Z';
  dup boolean := false;
  ends timestamptz;
  n int;
begin
  insert into auth.users (id, email_confirmed_at) values (uid, now())
    on conflict (id) do update set email_confirmed_at = excluded.email_confirmed_at;
  insert into public.profiles (id, role, account_status, plan)
    values (uid, 'student', 'active', 'Ücretsiz')
    on conflict (id) do update set account_status = 'active', role = 'student';

  insert into public.billing_checkout_sessions (id, user_id, plan_id, amount_try, currency, status, provider)
    values (chk, uid, 'pro', 100, 'TRY', 'pending', 'iyzico');

  insert into public.billing_subscriptions (
    user_id, plan_id, status, period_start, period_end, provider, currency, locked_amount_try
  ) values (
    uid, 'pro', 'active', '2026-11-01T00:00:00Z', kept, 'iyzico', 'TRY', 100
  );

  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (uid, chk, 100, 'TRY', 'succeeded', 'iyzico', 'pay_1');

  begin
    insert into public.billing_payments (
      user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
    ) values (uid, chk, 100, 'TRY', 'succeeded', 'iyzico', 'pay_1');
    raise exception 'unique (provider, provider_payment_id) beklenirdi';
  exception
    when unique_violation then
      dup := true;
  end;
  if not dup then
    raise exception 'yinelenen ödeme unique_violation üretmeli';
  end if;

  -- applyVerifiedPayment duplicate: mevcut period_end korunur (extendPeriod false).
  update public.billing_subscriptions s
    set period_end = s.period_end,
        updated_at = now()
    where s.user_id = uid;
  select period_end into ends from public.billing_subscriptions where user_id = uid;
  if ends is distinct from kept then
    raise exception 'yinelenen ödeme süreyi uzattı: %', ends;
  end if;

  insert into public.billing_events (provider, event_id, event_type, user_id)
    values ('iyzico', 'pay_1', 'SUCCESS', uid);
  begin
    insert into public.billing_events (provider, event_id, event_type, user_id)
      values ('iyzico', 'pay_1', 'SUCCESS', uid);
    raise exception 'billing_events unique beklenirdi';
  exception
    when unique_violation then
      null;
  end;

  -- Bilinmeyen sipariş: oturum yok → ödeme/üyelik satırı yok.
  select count(*) into n from public.billing_checkout_sessions where id = '77777777-7777-4777-8777-777777777777';
  if n <> 0 then
    raise exception 'bilinmeyen sipariş oturumu oluşmamalı';
  end if;

  -- Yanlış tutar oturuma yazılmaz (katalog 100, kayıt 1).
  begin
    insert into public.billing_checkout_sessions (user_id, plan_id, amount_try, currency)
      values (uid, 'pro', 0, 'TRY');
    raise exception 'amount_try > 0 check beklenirdi';
  exception
    when check_violation then
      null;
  end;

  -- Eşzamanlı aynı payment_id: unique + ON CONFLICT yalnızca 1 satır.
  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (uid, chk, 100, 'TRY', 'succeeded', 'iyzico', 'pay_conc')
  on conflict (provider, provider_payment_id) do nothing;
  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (uid, chk, 100, 'TRY', 'succeeded', 'iyzico', 'pay_conc')
  on conflict (provider, provider_payment_id) do nothing;
  select count(*) into n from public.billing_payments where provider_payment_id = 'pay_conc';
  if n <> 1 then
    raise exception 'eşzamanlı aynı id 1 satır olmalı, got %', n;
  end if;
  select period_end into ends from public.billing_subscriptions where user_id = uid;
  if ends is distinct from kept then
    raise exception 'eşzamanlı tekrar süreyi uzattı';
  end if;

  -- Başarısız ödeme üyeliği değiştirmez.
  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (uid, chk, 100, 'TRY', 'failed', 'iyzico', 'pay_fail');
  select period_end into ends from public.billing_subscriptions where user_id = uid;
  if ends is distinct from kept then
    raise exception 'failed ödeme süreyi değiştirdi';
  end if;

  -- Farklı payment_id ikinci satıra izin verir (şema). Süre uzatma ürün kararı; burada uzatılmadı.
  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (uid, chk, 100, 'TRY', 'succeeded', 'iyzico', 'pay_2');
  select count(*) into n from public.billing_payments
    where user_id = uid and status = 'succeeded';
  if n < 3 then
    raise exception 'farklı payment_id ikinci succeeded yazılmalı';
  end if;
  select period_end into ends from public.billing_subscriptions where user_id = uid;
  if ends is distinct from kept then
    raise exception 'test yanlışlıkla pay_2 ile süre uzattı';
  end if;

  -- 016 currency CHECK yok: USD satırı kabul edilir (webhook TRY reddeder).
  insert into public.billing_checkout_sessions (user_id, plan_id, amount_try, currency, status)
    values (uid, 'pro', 100, 'USD', 'pending');
end
$$;

rollback;
