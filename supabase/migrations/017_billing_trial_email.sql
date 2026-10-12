-- Deneme: e-posta doğrulanmadan başlamasın.
-- Admin ödeme listesi: kart/secret yok.
-- 013+016 gerekir. PRODUCTION’A bu adımda uygulanmaz.
-- Risk: email_confirmed_at yoksa onay RPC ‘e-posta doğrulanmamış’ döner; deneme yazılmaz.

create or replace function public.admin_review_student(p_id uuid, p_status text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  if p_id is null or p_id = auth.uid() then
    raise exception 'yetkisiz';
  end if;
  if p_status not in ('active', 'rejected', 'pending') then
    raise exception 'geçersiz durum';
  end if;
  if p_status = 'active' then
    if not exists (
      select 1 from auth.users u
      where u.id = p_id and u.email_confirmed_at is not null
    ) then
      raise exception 'e-posta doğrulanmamış';
    end if;
  end if;
  update public.profiles
    set
      account_status = p_status,
      approval_note = case when p_status = 'rejected' then coalesce(p_note, '') else '' end,
      trial_started_at = case
        when p_status = 'active' and trial_started_at is null then now()
        else trial_started_at
      end,
      trial_ends_at = case
        when p_status = 'active' and trial_ends_at is null then now() + interval '14 days'
        else trial_ends_at
      end,
      subscription_status = case
        when p_status = 'active' and coalesce(subscription_status, '') in ('', 'none', 'pending_approval') then 'trialing'
        when p_status = 'rejected' then 'blocked'
        else subscription_status
      end,
      updated_at = now()
    where id = p_id
      and role = 'student';
end;
$$;

create or replace function public.admin_list_payments()
returns table (
  id uuid,
  user_id uuid,
  email text,
  amount_try numeric,
  currency text,
  status text,
  provider text,
  provider_payment_id text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return query
  select
    p.id,
    p.user_id,
    pr.email,
    p.amount_try,
    p.currency,
    p.status,
    p.provider,
    p.provider_payment_id,
    p.created_at
  from public.billing_payments p
  left join public.profiles pr on pr.id = p.user_id
  order by p.created_at desc
  limit 200;
end;
$$;

revoke all on function public.admin_list_payments() from public, anon;
grant execute on function public.admin_list_payments() to authenticated;
grant execute on function public.admin_review_student(uuid, text, text) to authenticated;
