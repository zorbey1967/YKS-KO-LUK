/**
 * Yerel Auth Google sağlayıcı yoklaması. Sır yazdırılmaz. Canlı URL reddedilir.
 *   YKS_STATUS_ENV=<supabase status -o env> node scripts/local-google-oauth-test.mjs
 */
import { readFileSync } from 'node:fs';

const LIVE = 'naiakscryafhvcghjmzx';

function loadEnv() {
  const p = process.env.YKS_STATUS_ENV;
  if (!p) throw new Error('YKS_STATUS_ENV yok');
  const env = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return env;
}

function refuseLive(api) {
  const s = String(api).toLowerCase();
  if (s.includes(LIVE) || (s.includes('supabase.co') && !s.includes('127.0.0.1'))) {
    throw new Error('LIVE_REFUSED');
  }
  const host = new URL(api).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('HOST_REFUSED');
}

const st = loadEnv();
const api = (st.API_URL || 'http://127.0.0.1:54321').replace(/\/$/, '');
refuseLive(api);
const anon = st.ANON_KEY || st.PUBLISHABLE_KEY;
const redirect = 'http://127.0.0.1:5173/';
const url = `${api}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
const res = await fetch(url, { redirect: 'manual', headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
const loc = res.headers.get('location') || '';
if (/accounts\.google\.com/i.test(loc)) {
  console.log('GOOGLE_AUTHORIZE_REDIRECT', res.status, 'accounts.google.com (istemci yapılandırılmış; canlı doğrulama değil)');
  process.exit(0);
}
console.log('GOOGLE_PROVIDER_NOT_LIVE', res.status, 'yerel Google OAuth kapalı veya Client ID yok');
if (res.status >= 500) process.exit(1);
process.exit(0);
