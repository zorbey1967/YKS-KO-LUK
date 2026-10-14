/**
 * Staging ön kontrol. Varsayılan dry-run.
 * Canlı project_id / supabase.co URL kabul etmez.
 * disable_non_owner_accounts çağırmaz. Deploy/migration çalıştırmaz
 * (STAGING_EXEC=1 + onay + staging ref olsa bile bu turda exec kapalı).
 *
 *   node scripts/staging-cutover.mjs
 *   node scripts/staging-cutover.mjs --apply
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_PROJECT = 'naiakscryafhvcghjmzx';
const apply = process.argv.includes('--apply');
const confirm = String(process.env.STAGING_CONFIRM || '');
const stagingRef = String(process.env.YKS_STAGING_PROJECT_REF || '').trim();
const dbUrl = String(process.env.YKS_STAGING_DB_URL || process.env.YKS_PG_TEST_URL || '').trim();
const PREVIEW_KEYS = [
  'total_profiles',
  'would_suspend_profiles',
  'would_pasif_coaches',
  'coach_rows',
  'appointment_count',
  'meeting_count',
  'payment_count',
];
const EDGE_ENV = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY (admin-account-status, billing-checkout, billing-webhook)',
  'GEMINI_API_KEY (student-ai, exam-scan)',
  'GEMINI_MODEL (isteğe bağlı)',
  'SHOPIER_PAT',
  'SHOPIER_WEBHOOK_TOKEN',
  'SHOPIER_PRODUCT_IMAGE_URL',
  'LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET (meeting-token)',
];

const migrations = [
  '027_live010_no_email_admin.sql',
  '028_coach_directory_security_invoker.sql',
  '029_account_suspend.sql',
  '030_owner_trial_weekplan_exam.sql',
  '031_exam_scans_storage.sql',
  '032_disable_non_owner_accounts.sql',
  '033_appointment_starts_at_grant.sql',
  '034_coach_directory_public_cards.sql',
  '035_appointments_no_client_delete.sql',
  '036_owner_meetings_security.sql',
  '037_study_rooms.sql',
  '038_storage_ingest_recording_gate.sql',
  '039_approved_appointment_cancel.sql',
  '040_approved_cancel_audit.sql',
];
const edges = [
  'admin-account-status',
  'student-ai',
  'exam-scan',
  'exam-upload',
  'bank-pack',
];

function isLiveUrl(u) {
  const s = u.toLowerCase();
  if (!s) return false;
  if (s.includes(LIVE_PROJECT)) return true;
  if (s.includes('supabase.co') && !s.includes('localhost')) return true;
  return false;
}

function missingEnv() {
  const miss = [];
  if (!stagingRef) miss.push('YKS_STAGING_PROJECT_REF');
  if (!process.env.SUPABASE_ACCESS_TOKEN) miss.push('SUPABASE_ACCESS_TOKEN (değer yazdırılmaz)');
  return miss;
}

const cfg = existsSync(join(root, 'supabase/config.toml'))
  ? readFileSync(join(root, 'supabase/config.toml'), 'utf8')
  : '';
const cfgId = (cfg.match(/project_id\s*=\s*"([^"]+)"/) || [])[1] || '';
if (cfgId === LIVE_PROJECT) {
  console.log('CONFIG_TOML_PROJECT_ID_LIVE yerel konteyner adı; uzak apply hedefi olamaz');
}

console.log('STAGING_MODE', apply ? 'apply-requested' : 'dry-run');
console.log('LIVE_PROJECT_REF_BLOCKED', LIVE_PROJECT);
if (stagingRef && stagingRef === LIVE_PROJECT) {
  console.error('STAGING_REF_IS_LIVE');
  if (apply) process.exit(1);
}

for (const file of migrations) {
  const p = join(root, 'supabase/migrations', file);
  if (!existsSync(p)) {
    console.error('MIGRATION_MISSING', file);
    process.exit(1);
  }
}
console.log('MIGRATION_ORDER', migrations.join(' → '));
console.log('EDGE_ORDER', [...edges, '(bank-pack pack.json ile)'].join(' → '));
console.log('DISABLE_RPC', 'otomatik çağrılmaz; preview + p_expect zorunlu');
console.log('PREVIEW_REQUIRED_KEYS', PREVIEW_KEYS.join(','));
console.log('EDGE_ENV_NAMES', EDGE_ENV.join(' | '));
console.log('BANK_LIVE_DEPLOYED', 'false');

const verify = spawnSync(process.execPath, [join(root, 'scripts/verify-bank-pack.mjs')], {
  encoding: 'utf8',
  cwd: root,
});
process.stdout.write(verify.stdout || '');
process.stderr.write(verify.stderr || '');
if (verify.status !== 0) process.exit(verify.status || 1);

if (apply && (isLiveUrl(dbUrl) || stagingRef === LIVE_PROJECT || !stagingRef)) {
  console.error('STAGING_REFUSED canlı URL / config.toml project_id veya staging ref yok');
  process.exit(1);
}
if (!apply && (isLiveUrl(dbUrl) || stagingRef === LIVE_PROJECT)) {
  console.log('DRY_RUN_NOTE canlı URL görüldü; apply reddedilir');
}

const miss = missingEnv();
if (miss.length) console.log('ENV_MISSING_FOR_STAGING', miss.join(', '));

const plan = [
  '1. npm run pack:bank && npm run verify:bank',
  '2. Staging projede 027→040 (onaysız çalışmaz; canlı katalog 001–010)',
  '3. Edge: admin-account-status, student-ai, exam-scan, exam-upload, bank-pack (pack.json fonksiyon klasöründe)',
  '4. platform_owner UUID (e-posta yok)',
  '5. preview_disable_non_owner_accounts(uuid) — sayıları kaydet',
  '6. disable yalnızca preview JSON p_expect ile, bu betikte yok',
];
console.log('PLAN');
for (const line of plan) console.log(' ', line);

if (!apply) {
  console.log('DRY_RUN_OK dağıtım yapılmadı');
  process.exit(0);
}

if (confirm !== 'I_UNDERSTAND_STAGING') {
  console.error('APPLY_BLOCKED STAGING_CONFIRM=I_UNDERSTAND_STAGING gerekli');
  process.exit(1);
}
if (!stagingRef) {
  console.error('APPLY_BLOCKED YKS_STAGING_PROJECT_REF yok');
  process.exit(1);
}

console.log('APPLY_COMMANDS_ONLY (exec kapalı; canlıya gitmez)');
console.log(`  npx supabase link --project-ref ${stagingRef}`);
for (const file of migrations) {
  console.log(`  npx supabase db query --linked -f supabase/migrations/${file}`);
}
console.log('  npx supabase functions deploy admin-account-status --no-verify-jwt');
console.log('  npx supabase functions deploy student-ai --no-verify-jwt');
console.log('  npx supabase functions deploy exam-scan --no-verify-jwt');
console.log('  npx supabase functions deploy bank-pack --no-verify-jwt');
console.log('APPLY_NOT_EXECUTED');
