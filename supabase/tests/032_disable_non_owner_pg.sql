-- İzole PG. Production’da çalıştırılmaz. Canlı hesap değiştirilmez.
-- Tam matris: supabase/tests/pg_security_matrix.sql + npm run test:pg:security
-- Önkoşul: 030 + 032.
--   psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/032_disable_non_owner_pg.sql

begin;

do $$
declare
  preview jsonb;
  bogus uuid := '00000000-0000-4000-8000-000000000001';
begin
  if to_regprocedure('public.preview_disable_non_owner_accounts(uuid)') is null then
    raise notice '032 yok; atlandı';
    return;
  end if;
  preview := public.preview_disable_non_owner_accounts(bogus);
  if coalesce((preview->>'skipped')::boolean, false) is not true then
    raise exception 'yanlış UUID skip etmeli';
  end if;
  if coalesce((preview->>'would_suspend_profiles')::integer, -1) is distinct from 0 then
    raise exception 'yanlış UUID hesap kapatmamalı';
  end if;
end
$$;

rollback;
