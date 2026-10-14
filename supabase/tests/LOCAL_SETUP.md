# Yerel Supabase kurulum (tekrarlanabilir)

Canlı `naiakscryafhvcghjmzx` hedef değildir. `db push` / `link` / uzak SQL yok.

## Önkoşul

Docker Desktop, repo kökünde Supabase CLI (`npx supabase`).

```
npx supabase start
```

Yalnızca `127.0.0.1` (API 54321, DB 54322, Studio 54323).

## Temiz kurulum

```
npx supabase db reset --local
npx supabase migration list --local
```

Beklenen: **001–005 ve 007–038**. Depoda **006 dosyası yoktur**; CLI sayı boşluğunu hata saymaz, `005` ardından `007` uygulanır. Varsayılan “eksik 006 kırık zincir” değildir.

Güvenlik paketi: 027 → 038. 038 istemci `exam-scans` / `meeting-recordings` INSERT’i kapatır.

## Dört Vitest PostgreSQL atlaması

`npm test` içindeki `describe.skipIf(!YKS_PG_TEST_URL)` **canlıyı korumak için** atlar; başarı sayılmaz.

Eşdeğer SQL `npm run test:pg:security` throwaway Docker’da çalışır (027 / 030 / 032). `020` için:

```
npm run test:pg:docker
```

Dört senaryoyu host `psql` olmadan:

```
npm run test:pg:four
```

Throwaway Docker; `020` / `027` / `030` / `032` SQL ROLLBACK. `*.supabase.co` kullanılmaz.

Elle `YKS_PG_TEST_URL` (yalnız 127.0.0.1 veya throwaway; `*.supabase.co` yok):

1. Host’ta `psql` veya Docker `postgres:16-alpine`.
2. `supabase/tests/pg_security_bootstrap.sql` + 029–032 **veya** `020_local_pg_bootstrap.sql` + 018–020.
3. `set YKS_PG_TEST_URL=postgresql://postgres:…@127.0.0.1:PORT/db` (parolayı sohbete yapıştırma).
4. `npm test` — dört senaryo artık atlanmaz.

Canlı DB URL asla verilmez.

## Banka (istemci bundle değil)

```
npm run pack:bank
npm run verify:bank
npx supabase functions serve --no-verify-jwt
```

`pack.json` gitignore. Canlı deploy yok.

## Storage HTTP

```
npx supabase status -o env > %TEMP%\yks-status.env
set YKS_STATUS_ENV=%TEMP%\yks-status.env
node scripts/local-storage-http-test.mjs
node scripts/local-directory-security-test.mjs
node scripts/local-appointment-rules-test.mjs
node scripts/local-google-oauth-test.mjs
```

Canlı URL reddedilir. Test kullanıcıları yalnızca yerel Auth’tadır.

## Randevu kuralı

`respond_appointment`: yalnız `bekliyor` → onay veya red (`iptal`). Onaylı satır: `talep açık değil`. Geçmiş satır silinmez.

Onaylı iptal (039+040, yerel taslak): taraf `request_cancel_approved_appointment`; koç/yönetici `decide_approved_appointment_cancel`. Yinelenen talep `duplicate`. Satır silinmez. Production’a bu turda uygulanmaz.

## Yasak

Canlı SQL, canlı migration, `disable_non_owner_accounts` otomatik çağrı, commit/push/deploy bu belgede yoktur.
