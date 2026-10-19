-- Google OAuth sonrası koç/öğrenci intent: 027 handle_new_user signup_intent’i düşürdü.
-- E-posta ile otomatik admin YOK. İstemci metadata veya claim RPC ile intent yazar.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text;
  intent text;
begin
  full_name := trim(concat_ws(' ',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'));
  if full_name = '' then
    full_name := trim(coalesce(new.raw_user_meta_data->>'name', ''));
  end if;
  if public.person_name_blocked(full_name) then
    full_name := '';
  end if;

  intent := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'intent'), ''), 'student'));
  if intent not in ('student', 'coach') then
    intent := 'student';
  end if;

  insert into public.profiles (
    id, email, name, role, account_status,
    signup_intent, signup_grade, signup_track, signup_exam
  )
  values (
    new.id,
    new.email,
    full_name,
    'student',
    'pending',
    intent,
    left(coalesce(new.raw_user_meta_data->>'grade', ''), 40),
    left(coalesce(new.raw_user_meta_data->>'track', ''), 40),
    left(coalesce(new.raw_user_meta_data->>'exam', ''), 40)
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when public.profiles.role = 'admin' then 'admin'
          else public.profiles.role
        end,
        name = case
          when nullif(trim(public.profiles.name), '') is not null then public.profiles.name
          else excluded.name
        end,
        -- Intent yalnızca hâlâ varsayılan öğrenci iken ve meta gelmişse güncellenir.
        signup_intent = case
          when public.profiles.role = 'admin' then public.profiles.signup_intent
          when public.profiles.signup_intent = 'student'
            and excluded.signup_intent in ('student', 'coach')
            then excluded.signup_intent
          else public.profiles.signup_intent
        end;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- OAuth dönüşünde sessionStorage pending → sunucu (metadata OAuth’ta yok).
-- role asla admin yapılamaz; mevcut admin dokunulmaz.
create or replace function public.claim_signup_prefs(
  p_intent text,
  p_grade text default '',
  p_track text default '',
  p_exam text default '',
  p_first_name text default '',
  p_last_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  intent text := lower(coalesce(nullif(trim(p_intent), ''), 'student'));
  full_name text;
  cur record;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'oturum gerekli');
  end if;
  if intent not in ('student', 'coach') then
    return jsonb_build_object('ok', false, 'error', 'geçersiz intent');
  end if;

  select p.id, p.role, p.signup_intent, p.name, u.created_at as created_at
    into cur
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = uid
  for update of p;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profil yok');
  end if;
  if cur.role = 'admin' then
    return jsonb_build_object('ok', true, 'skipped', 'admin');
  end if;

  -- Yalnızca yeni / henüz koç intent’i yokken; eski hesapta öğrenci→koç yükseltme yok (24s).
  if cur.signup_intent = 'coach' and intent = 'student' then
    return jsonb_build_object('ok', true, 'skipped', 'already_coach_intent');
  end if;
  if cur.signup_intent = 'student' and intent = 'coach'
     and cur.created_at < now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'error', 'intent süresi doldu');
  end if;

  full_name := trim(concat_ws(' ', nullif(trim(p_first_name), ''), nullif(trim(p_last_name), '')));
  if full_name <> '' and public.person_name_blocked(full_name) then
    full_name := '';
  end if;

  update public.profiles
  set
    signup_intent = intent,
    signup_grade = case when nullif(trim(p_grade), '') is null then signup_grade else left(trim(p_grade), 40) end,
    signup_track = case when nullif(trim(p_track), '') is null then signup_track else left(trim(p_track), 40) end,
    signup_exam = case when nullif(trim(p_exam), '') is null then signup_exam else left(trim(p_exam), 40) end,
    name = case
      when nullif(trim(name), '') is not null then name
      when full_name <> '' then full_name
      else name
    end,
    updated_at = now()
  where id = uid;

  return jsonb_build_object('ok', true, 'signup_intent', intent);
end;
$$;

revoke all on function public.claim_signup_prefs(text, text, text, text, text, text) from public, anon;
grant execute on function public.claim_signup_prefs(text, text, text, text, text, text) to authenticated;
