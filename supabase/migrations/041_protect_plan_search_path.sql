-- Trial kolonlarını client yazamaz. search_path sabitlenir. Satır verisi değişmez.
-- coach_directory: SECURITY DEFINER view kapatılır (satır yoksa bile tanım düzelir).

create or replace function public.protect_plan()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    new.plan := coalesce(old.plan, 'Ücretsiz');
    if new.plan is null or new.plan = '' then
      new.plan := 'Ücretsiz';
    end if;
    if tg_op = 'INSERT' then
      new.trial_started_at := null;
      new.trial_ends_at := null;
      new.subscription_status := null;
      new.subscription_started_at := null;
      new.subscription_ends_at := null;
    else
      new.trial_started_at := old.trial_started_at;
      new.trial_ends_at := old.trial_ends_at;
      new.subscription_status := old.subscription_status;
      new.subscription_started_at := old.subscription_started_at;
      new.subscription_ends_at := old.subscription_ends_at;
    end if;
  end if;
  return new;
end;
$function$;

create or replace view public.coach_directory
with (security_invoker = true) as
  select id, name, photo, track, focus, experience, bio, student_count, created_at
  from public.coaches
  where status = 'active';

revoke all on table public.coach_directory from public;
grant select on table public.coach_directory to anon, authenticated;
