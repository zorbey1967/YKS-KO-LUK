/**
 * Yerel randevu: bekleyen red ≠ onaylı iptal. Satır silinmez. Canlı URL reddedilir.
 *   YKS_STATUS_ENV=<supabase status -o env> node scripts/local-appointment-rules-test.mjs
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
  console.log(`${name}\t${status}\t${String(extra).slice(0, 180)}`);
}

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
  return { status: res.status, json, text: text.slice(0, 240) };
}

async function signup(email) {
  const r = await req('/auth/v1/signup', {
    method: 'POST',
    token: anon,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  let id = r.json?.user?.id;
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
  const token = login.json?.access_token;
  if (!id || !token) throw new Error(`signup ${email}`);
  return { id, token, email };
}

const stamp = Date.now();
const student = await signup(`st.ap.${stamp}@local.test`);
const coachU = await signup(`co.ap.${stamp}@local.test`);

await req(`/rest/v1/profiles?id=eq.${student.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'student', account_status: 'active' }),
});
await req(`/rest/v1/profiles?id=eq.${coachU.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'coach', account_status: 'active' }),
});

const future = new Date(Date.now() + 3 * 24 * 3600 * 1000);
const date = future.toISOString().slice(0, 10);
const coachId = crypto.randomUUID();
const seedSql = `
set session_replication_role = replica;
insert into public.coaches (id, user_id, name, email, status)
values ('${coachId}'::uuid, '${coachU.id}'::uuid, 'Koç Randevu', 'coach-ap@local.test', 'active');
insert into public.appointments (id, coach_id, student_id, student_name, date, time, minutes, status, starts_at)
values
  ('pend-${stamp}', '${coachId}'::uuid, '${student.id}'::uuid, 'Öğrenci', '${date}', '12:00', 40, 'bekliyor', '${date}T12:00:00Z'),
  ('onay-${stamp}', '${coachId}'::uuid, '${student.id}'::uuid, 'Öğrenci', '${date}', '14:00', 40, 'onay', '${date}T14:00:00Z');
`;
const seed = spawnSync('docker', ['exec', '-i', 'supabase_db_naiakscryafhvcghjmzx', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  input: seedSql,
  encoding: 'utf8',
});
if (seed.status !== 0) throw new Error(`appt seed ${seed.stderr || seed.stdout}`);
log('seed_coach', 200, 'docker-replica');
log('seed_pending', 200, `pend-${stamp}`);
log('seed_approved', 200, `onay-${stamp}`);


const rejectPending = await req('/rest/v1/rpc/respond_appointment', {
  method: 'POST',
  token: coachU.token,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_id: `pend-${stamp}`, p_accept: false }),
});
log('reject_pending', rejectPending.status, JSON.stringify(rejectPending.json || rejectPending.text));

const cancelApproved = await req('/rest/v1/rpc/respond_appointment', {
  method: 'POST',
  token: coachU.token,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_id: `onay-${stamp}`, p_accept: false }),
});
log('cancel_approved_unsupported', cancelApproved.status, cancelApproved.text);

const delCoach = await req(`/rest/v1/appointments?id=eq.onay-${stamp}`, {
  method: 'DELETE',
  token: coachU.token,
});
const remain = await req(`/rest/v1/appointments?id=eq.onay-${stamp}&select=id,status`, { token: coachU.token });
log('delete_coach_onay', delCoach.status, `remain=${Array.isArray(remain.json) ? remain.json.length : 0} status=${remain.json?.[0]?.status || '-'}`);

const delPending = await req(`/rest/v1/appointments?id=eq.pend-${stamp}`, {
  method: 'DELETE',
  token: coachU.token,
});
const remainP = await req(`/rest/v1/appointments?id=eq.pend-${stamp}&select=id,status`, { token: coachU.token });
log('delete_coach_rejected', delPending.status, `remain=${Array.isArray(remainP.json) ? remainP.json.length : 0} status=${remainP.json?.[0]?.status || '-'}`);
