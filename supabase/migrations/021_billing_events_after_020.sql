-- Yalnızca 020 sonrası. PRODUCTION’A otomatik uygulanmaz.
-- 013/017/018/019 UYGULAMA: 013 NULL üyelik + oracle GRANT; 017 account_status=pending/rejected (002 CHECK kırılır).
-- Hedef: 020 (randevu/üyelik kapısı) → bu dosya (billing_events + is_admin anon REVOKE) → 016 (ödeme tabloları).
-- student_entitled / request_appointment / admin_review_student değiştirilmez.

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, public, authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
