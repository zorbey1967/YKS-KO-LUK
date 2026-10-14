/**
 * Yerel coach_directory HTTP. Canlı URL reddedilir. Anahtar yazdırılmaz.
 *   YKS_STATUS_ENV=<supabase status -o env> node scripts/local-directory-security-test.mjs
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

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

function log(name, status, extra = '') {
  console.log(`${name}\t${status}\t${String(extra).slice(0, 160)}`);
}

function keysOf(rows) {
  const first = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return first ? Object.keys(first).sort().join(',') : '(empty)';
}

const FORBIDDEN = /email|user_id|score/i;
const PUBLIC_COLS = ['id', 'name', 'photo', 'track', 'focus', 'experience', 'bio', 'student_count', 'created_at'];

const st = loadEnv();
const api = (st.API_URL || 'http://127.0.0.1:54321').replace(/\/$/, '');
refuseLive(api);
const anon = st.ANON_KEY || st.PUBLISHABLE_KEY;
const service = st.SERVICE_ROLE_KEY || st.SECRET_KEY;
const pass = 'Passw0rd-local!';

async function req(path, { method = 'GET', token, body, headers = {} } = {}) {
  const h = { apikey: token && token === service ? service : anon, Authorization: `Bearer ${token || anon}`, ...headers };
  const res = await fetch(`${api}${path}`, { method, headers: h, body });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 220) };
}

async function signup(email) {
  const r = await req('/auth/v1/signup', {
    method: 'POST',
    token: anon,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  let id = r.json?.user?.id;
  let token = r.json?.access_token;
  await req(`/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    token: service,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_confirm: true }),
  });
  const login = await req('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  id = login.json?.user?.id || id;
  token = login.json?.access_token || token;
  if (!id || !token) throw new Error(`signup ${email} ${r.status}`);
  return { id, token, email };
}

const stamp = Date.now();
const student = await signup(`st.dir.${stamp}@local.test`);
const coachA = await signup(`co.a.${stamp}@local.test`);
const coachB = await signup(`co.b.${stamp}@local.test`);
const admin = await signup(`ad.dir.${stamp}@local.test`);

await req(`/rest/v1/profiles?id=eq.${student.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'student', account_status: 'active' }),
});
await req(`/rest/v1/profiles?id=eq.${coachA.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'coach', account_status: 'active' }),
});
await req(`/rest/v1/profiles?id=eq.${coachB.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'coach', account_status: 'active' }),
});
await req(`/rest/v1/profiles?id=eq.${admin.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'admin', account_status: 'active' }),
});

const adminPatch = await req(`/rest/v1/profiles?id=eq.${admin.id}&select=role,account_status`, {
  token: service,
});
log('admin_profile', adminPatch.status, JSON.stringify(adminPatch.json));

const seedSql = `
set session_replication_role = replica;
insert into public.coaches (user_id, name, email, track, status, score)
values
  ('${coachA.id}'::uuid, 'Koç A', 'secret-a@local.test', 'YKS Sayısal', 'active', 99),
  ('${coachB.id}'::uuid, 'Koç B', 'secret-b@local.test', 'YKS Eşit Ağırlık', 'active', 12);
`;
const seed = spawnSync('docker', ['exec', '-i', 'supabase_db_naiakscryafhvcghjmzx', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  input: seedSql,
  encoding: 'utf8',
});
if (seed.status !== 0) throw new Error(`seed ${seed.stderr || seed.stdout}`);
log('seed_coaches', 200, 'docker-replica');

function assertPublic(label, r) {
  const rows = Array.isArray(r.json) ? r.json : [];
  const cols = keysOf(rows);
  const leak = FORBIDDEN.test(cols) || JSON.stringify(rows).includes('secret-a@') || JSON.stringify(rows).includes('secret-b@');
  const extra = rows[0] ? Object.keys(rows[0]).filter((k) => !PUBLIC_COLS.includes(k)) : [];
  log(label, r.status, `n=${rows.length} cols=${cols} leak=${leak} extra=${extra.join(',') || '-'}`);
}

const dirAnon = await req('/rest/v1/coach_directory?select=*');
assertPublic('dir_anon', dirAnon);
const dirStu = await req('/rest/v1/coach_directory?select=*', { token: student.token });
assertPublic('dir_student', dirStu);
const dirCoach = await req('/rest/v1/coach_directory?select=*', { token: coachA.token });
assertPublic('dir_coach', dirCoach);
const dirAdmin = await req('/rest/v1/coach_directory?select=*', { token: admin.token });
assertPublic('dir_admin', dirAdmin);

const leakEmail = await req('/rest/v1/coach_directory?select=email,user_id,score', { token: student.token });
log('dir_select_forbidden_cols', leakEmail.status, leakEmail.text);

const rpcAnon = await req('/rest/v1/rpc/coach_directory_cards', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
assertPublic('rpc_cards_anon', rpcAnon);
const rpcStu = await req('/rest/v1/rpc/coach_directory_cards', {
  method: 'POST',
  token: student.token,
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
assertPublic('rpc_cards_student', rpcStu);

const tblStu = await req('/rest/v1/coaches?select=id,email,user_id,score', { token: student.token });
log('table_student', tblStu.status, `n=${Array.isArray(tblStu.json) ? tblStu.json.length : 'err'} ${tblStu.text}`);
const tblCoach = await req('/rest/v1/coaches?select=id,email,user_id,score', { token: coachA.token });
const coachRows = Array.isArray(tblCoach.json) ? tblCoach.json : [];
const onlyOwn = coachRows.length === 1 && coachRows[0].user_id === coachA.id;
log('table_coach_own', tblCoach.status, `n=${coachRows.length} only_own=${onlyOwn}`);
const tblAdmin = await req('/rest/v1/coaches?select=id,email,user_id,score', { token: admin.token });
log('table_admin', tblAdmin.status, `n=${Array.isArray(tblAdmin.json) ? tblAdmin.json.length : 'err'}`);
const tblAnon = await req('/rest/v1/coaches?select=id,email,user_id,score');
log('table_anon', tblAnon.status, `n=${Array.isArray(tblAnon.json) ? tblAnon.json.length : tblAnon.text}`);
