# İzole PostgreSQL güvenlik testleri

Canlı Supabase URL’si (`db.*.supabase.co`) kullanılmaz. `YKS_PG_TEST_URL` yoksa Vitest PG senaryoları **atlanır** (başarı sayılmaz).

## Docker (önerilen)

Throwaway `postgres:16-alpine`. Host’ta gizli anahtar gerekmez.

```
npm run test:pg:security
```

Betik: bootstrap → 029 → 030 → 032 → `pg_security_matrix.sql` (ROLLBACK) → eşzamanlı `disable_non_owner_accounts` ve `start_top_plan_trial`.

## Elle throwaway Postgres

1. Boş veritabanı oluştur (canlı değil).
2. `YKS_PG_TEST_URL` yalnızca bu URL olsun.
3. Sıra:

```
psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pg_security_bootstrap.sql
psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/029_account_suspend.sql
psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/030_owner_trial_weekplan_exam.sql
psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/032_disable_non_owner_accounts.sql
psql "$YKS_PG_TEST_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pg_security_matrix.sql
```

`pg_security_matrix.sql` `BEGIN/ROLLBACK` kullanır; kalıcı hesap silmez. 032 fonksiyonları satır **silmez**.

`npm test` dört PG dosyasını `YKS_PG_TEST_URL` yoksa atlar. Bu atlama gizleme değildir: `npm run test:pg:security` 027/030/032 SQL’ini throwaway konteynerde çalıştırır. `020_entitlement_pg.sql` ayrı bootstrap ister (`npm run test:pg:docker`). Canlı `db.*.supabase.co` bağlanılmaz.
