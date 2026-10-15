-- Webhook atomic payment apply. Tables already exist (prod_billing_tables_rpcs).
-- Does not replace protect_plan / start_top_plan_trial / handle_new_user.
-- authenticated EXECUTE yok. Satır silme yok.

create or replace function public.apply_verified_payment(
  p_user_id uuid,
  p_plan_id text,
  p_provider text,
  p_payment_id text,
  p_amount_try numeric,
  p_checkout_id uuid default null,
  p_subscription_id text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  inserted int := 0;
  existing_end timestamptz;
  existing_start timestamptz;
  ends timestamptz;
  starts timestamptz;
  dup boolean;
  chk_amt numeric;
  chk_cur text;
  chk_uid uuid;
  pay_amt numeric;
  pay_cur text;
begin
  if p_user_id is null or p_payment_id is null or p_provider is null then
    raise exception 'eksik ödeme kimliği';
  end if;
  if p_plan_id not in ('pro', 'premium') then
    raise exception 'paket_yok';
  end if;
  if p_amount_try is null or p_amount_try <= 0 then
    raise exception 'tutar_gecersiz';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bill:' || p_user_id::text));

  if p_checkout_id is not null then
    select s.amount_try, s.currency, s.user_id
      into chk_amt, chk_cur, chk_uid
    from public.billing_checkout_sessions s
    where s.id = p_checkout_id;
    if not found then
      raise exception 'oturum_yok';
    end if;
    if chk_uid is distinct from p_user_id then
      raise exception 'siparis_uyusmuyor';
    end if;
    if upper(coalesce(chk_cur, 'TRY')) is distinct from 'TRY' then
      raise exception 'para_birimi';
    end if;
    if abs(coalesce(chk_amt, 0) - p_amount_try) > 0.009 then
      raise exception 'tutar_uyusmuyor';
    end if;
  end if;

  insert into public.billing_payments (
    user_id, checkout_session_id, amount_try, currency, status, provider, provider_payment_id
  ) values (
    p_user_id, p_checkout_id, p_amount_try, 'TRY', 'succeeded', p_provider, p_payment_id
  )
  on conflict (provider, provider_payment_id) do nothing;
  get diagnostics inserted = row_count;
  dup := inserted = 0;

  if dup then
    select p.amount_try, p.currency
      into pay_amt, pay_cur
    from public.billing_payments p
    where p.provider = p_provider and p.provider_payment_id = p_payment_id;
    if abs(coalesce(pay_amt, 0) - p_amount_try) > 0.009 or upper(coalesce(pay_cur, '')) is distinct from 'TRY' then
      raise exception 'tutar_uyusmuyor';
    end if;
  end if;

  select s.period_end, s.period_start
    into existing_end, existing_start
    from public.billing_subscriptions s
   where s.user_id = p_user_id;

  if dup and existing_end is not null then
    ends := existing_end;
    starts := coalesce(existing_start, pg_catalog.clock_timestamp());
  else
    starts := pg_catalog.clock_timestamp();
    ends := pg_catalog.clock_timestamp() + interval '30 days';
  end if;

  insert into public.billing_subscriptions (
    user_id, plan_id, status, period_start, period_end, provider,
    provider_subscription_id, locked_amount_try, currency, updated_at
  ) values (
    p_user_id, p_plan_id, 'active', starts, ends, p_provider,
    coalesce(nullif(p_subscription_id, ''), p_payment_id), p_amount_try, 'TRY', pg_catalog.clock_timestamp()
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    provider = excluded.provider,
    provider_subscription_id = excluded.provider_subscription_id,
    locked_amount_try = excluded.locked_amount_try,
    currency = 'TRY',
    updated_at = pg_catalog.clock_timestamp();

  if p_checkout_id is not null then
    update public.billing_checkout_sessions
      set status = 'paid', updated_at = pg_catalog.clock_timestamp()
      where id = p_checkout_id;
  end if;

  update public.profiles
    set
      plan = p_plan_id,
      subscription_status = 'active',
      subscription_started_at = starts,
      subscription_ends_at = ends,
      billing_provider = p_provider,
      provider_subscription_id = coalesce(nullif(p_subscription_id, ''), p_payment_id),
      updated_at = pg_catalog.now()
    where id = p_user_id
      and role = 'student';

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'duplicate_payment', dup,
    'period_end', ends
  );
end;
$$;

revoke all on function public.apply_verified_payment(uuid, text, text, text, numeric, uuid, text) from public, anon, authenticated;

create unique index if not exists billing_checkout_shopier_product_uidx
  on public.billing_checkout_sessions (provider, provider_session_id)
  where provider = 'shopier' and coalesce(provider_session_id, '') <> '';
