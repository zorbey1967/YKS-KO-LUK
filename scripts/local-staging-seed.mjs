/**
 * Yalnızca 127.0.0.1 yerel Auth/DB. Canlı URL reddedilir.
 * disable_non_owner_accounts çağırmaz.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIVE = 'naiakscryafhvcghjmzx';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pass = 'Passw0rd-local!';

function loadStatusEnv() {
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
  const s = String(api || '').toLowerCase();
  if (s.includes(LIVE) || (s.includes('supabase.co') && !s.includes('127.0.0.1'))) {
    throw new Error('LIVE_REFUSED');
  }
  const host = new URL(api).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('HOST_REFUSED');
}

const st = loadStatusEnv();
const api = (st.API_URL || 'http://127.0.0.1:54321').replace(/\/$/, '');
refuseLive(api);
const anon = st.ANON_KEY || st.PUBLISHABLE_KEY;
const service = st.SERVICE_ROLE_KEY || st.SECRET_KEY;
if (!anon || !service) throw new Error('local keys missing');

async function req(path, { method = 'POST', token, apikey, body, extraHeaders } = {}) {
  const headers = { ...(extraHeaders || {}) };
  const key = apikey || anon;
  headers.apikey = key;
  headers.Authorization = `Bearer ${token || key}`;
  if (body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* raw */ }
  return { status: res.status, json, text: text.slice(0, 400) };
}

async function signup(email) {
  const r = await req('/auth/v1/signup', { body: { email, password: pass } });
  if (r.status >= 400 && !/already/i.test(r.text)) {
    const login = await req('/auth/v1/token?grant_type=password', { body: { email, password: pass } });
    if (login.status >= 400) throw new Error(`auth ${email} ${r.status} ${login.status}`);
    return { id: login.json.user?.id, token: login.json.access_token, email };
  }
  let token = r.json.access_token;
  let id = r.json.user?.id;
  if (!token) {
    const login = await req('/auth/v1/token?grant_type=password', { body: { email, password: pass } });
    token = login.json.access_token;
    id = login.json.user?.id || id;
  }
  await req(`/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    token: service,
    apikey: service,
    body: { email_confirm: true },
  });
  const login = await req('/auth/v1/token?grant_type=password', { body: { email, password: pass } });
  return { id: login.json.user?.id || id, token: login.json.access_token || token, email };
}

const stamp = Date.now();
const student = await signup(`e2e.stu.${stamp}@local.test`);
const free = await signup(`e2e.free.${stamp}@local.test`);
const coach = await signup(`e2e.coa.${stamp}@local.test`);
const coachB = await signup(`e2e.coa2.${stamp}@local.test`);
const adminU = await signup(`e2e.adm.${stamp}@local.test`);
const susp = await signup(`e2e.sus.${stamp}@local.test`);

const results = [];
function log(name, status, extra = '') {
  results.push({ name, status, extra: String(extra).slice(0, 160) });
  console.log(`${name}\t${status}\t${String(extra).replace(/eyJ[A-Za-z0-9._-]+/g, '[JWT]').slice(0, 160)}`);
}

async function patchProfile(id, body) {
  return req(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', token: service, apikey: service, body });
}

log('student_patch', (await patchProfile(student.id, {
  role: 'student', account_status: 'active', subscription_status: 'active',
  plan: 'premium', subscription_ends_at: '2099-01-01T00:00:00Z', name: 'E2E Ogrenci',
})).status);
log('free_patch', (await patchProfile(free.id, {
  role: 'student', account_status: 'active', subscription_status: 'none', plan: 'Ücretsiz', name: 'E2E Ucretsiz',
})).status);
log('coach_patch', (await patchProfile(coach.id, { role: 'coach', account_status: 'active', name: 'E2E Koc A' })).status);
log('coachB_patch', (await patchProfile(coachB.id, { role: 'coach', account_status: 'active', name: 'E2E Koc B' })).status);
log('admin_patch', (await patchProfile(adminU.id, { role: 'admin', account_status: 'active', name: 'E2E Yonetici' })).status);
log('susp_patch', (await patchProfile(susp.id, { role: 'student', account_status: 'pasif', name: 'E2E Aski' })).status);

async function ensureCoach(user, name) {
  const ins = await req('/rest/v1/coaches', {
    token: user.token,
    body: { user_id: user.id, name, email: user.email, photo: 'x', track: 'YKS Sayısal', focus: 'E2E', status: 'pending' },
  });
  log(`coach_insert_${name}`, ins.status, ins.text);
  const set = await req('/rest/v1/rpc/admin_set_coach_status', {
    token: adminU.token,
    body: { p_id: ins.json?.id, p_status: 'active' },
  });
  if (ins.status >= 400 || !ins.json?.id) {
    const list = await req(`/rest/v1/coaches?user_id=eq.${user.id}&select=id,status`, {
      method: 'GET', token: service, apikey: service,
    });
    const row = Array.isArray(list.json) ? list.json[0] : null;
    if (row?.id) {
      const set2 = await req('/rest/v1/rpc/admin_set_coach_status', {
        token: adminU.token,
        body: { p_id: row.id, p_status: 'active' },
      });
      log(`coach_activate_${name}`, set2.status, set2.text);
      return row.id;
    }
  }
  log(`coach_activate_${name}`, set.status, set.text);
  return ins.json?.id;
}

const coachId = await ensureCoach(coach, 'E2E Koc A');
const coachIdB = await ensureCoach(coachB, 'E2E Koc B');

const start = new Date(Date.now() + 48 * 3600 * 1000);
start.setMinutes(0, 0, 0);
const slot = await req('/rest/v1/rpc/add_coach_slot', {
  token: coach.token,
  body: { p_starts_at: start.toISOString() },
});
log('add_slot', slot.status, slot.text);

const slots = await req('/rest/v1/rpc/list_open_slots', {
  token: student.token,
  body: { p_coach_id: coachId },
});
const slotId = Array.isArray(slots.json) ? slots.json[0]?.id : slots.json?.[0]?.id;
log('list_slots', slots.status, `n=${Array.isArray(slots.json) ? slots.json.length : 0}`);

const reqAppt = await req('/rest/v1/rpc/request_appointment', {
  token: student.token,
  body: { p_availability_id: slotId },
});
const apptId = reqAppt.json?.id;
log('request_appointment', reqAppt.status, apptId || reqAppt.text);

const otherSee = await req(`/rest/v1/appointments?select=id,student_id&id=eq.${apptId}`, {
  method: 'GET', token: coachB.token,
});
log('coachB_sees_foreign_appt', otherSee.status, `n=${Array.isArray(otherSee.json) ? otherSee.json.length : 'err'}`);

const accept = await req('/rest/v1/rpc/respond_appointment', {
  token: coach.token,
  body: { p_id: apptId, p_accept: true },
});
log('respond_accept', accept.status, accept.text);

const stuSee = await req(`/rest/v1/appointments?select=id,status&id=eq.${apptId}`, {
  method: 'GET', token: student.token,
});
log('student_sees_own', stuSee.status, JSON.stringify(stuSee.json)?.slice(0, 80));

const cancel = await req('/rest/v1/rpc/respond_appointment', {
  token: coach.token,
  body: { p_id: apptId, p_accept: false },
});
log('respond_cancel', cancel.status, cancel.text);

const start2 = new Date(start.getTime() + 2 * 3600 * 1000);
const slot2 = await req('/rest/v1/rpc/add_coach_slot', {
  token: coach.token,
  body: { p_starts_at: start2.toISOString() },
});
log('add_slot2', slot2.status);
const slots2 = await req('/rest/v1/rpc/list_open_slots', { token: student.token, body: { p_coach_id: coachId } });
const slotId2 = Array.isArray(slots2.json) ? slots2.json.find((s) => s.id !== slotId)?.id : null;
const req2 = await req('/rest/v1/rpc/request_appointment', {
  token: student.token,
  body: { p_availability_id: slotId2 },
});
log('request2', req2.status, req2.json?.id || req2.text);
const acc2 = await req('/rest/v1/rpc/respond_appointment', {
  token: coach.token,
  body: { p_id: req2.json?.id, p_accept: true },
});
log('respond_accept2', acc2.status);
const done = await req(`/rest/v1/appointments?id=eq.${req2.json?.id}`, {
  method: 'PATCH', token: coach.token, body: { status: 'tamamlandi' },
});
log('complete_appt', done.status, done.text);

const sd = await req('/rest/v1/rpc/push_student_data', {
  token: student.token,
  body: { p_expected_rev: 0, p_data: { secret: 'e2e-only', syncRev: 0 } },
});
log('push_student_data', sd.status, sd.text);
const steal = await req('/rest/v1/student_data?user_id=eq.' + student.id, {
  method: 'GET', token: coachB.token,
});
log('foreign_student_data', steal.status, `n=${Array.isArray(steal.json) ? steal.json.length : steal.text.slice(0, 80)}`);

const trialCoach = await req('/rest/v1/rpc/start_top_plan_trial', { token: coach.token, body: {} });
log('coach_trial', trialCoach.status, trialCoach.json?.message || trialCoach.text);
const trialFree = await req('/rest/v1/rpc/start_top_plan_trial', { token: free.token, body: {} });
log('free_trial', trialFree.status, trialFree.json?.status || trialFree.json?.message || trialFree.text);
const trialPaid = await req('/rest/v1/rpc/start_top_plan_trial', { token: student.token, body: {} });
log('paid_trial', trialPaid.status, trialPaid.json?.message || trialPaid.text);
const trialSusp = await req('/rest/v1/rpc/start_top_plan_trial', { token: susp.token, body: {} });
log('susp_trial', trialSusp.status, trialSusp.json?.message || trialSusp.text);

const packStu = await req('/functions/v1/bank-pack', { token: student.token, body: { action: 'manifest' } });
log('pack_student', packStu.status, packStu.json?.pack ? `n=${packStu.json.manifest?.questionCount}` : (packStu.json?.error || packStu.text));
const packCoach = await req('/functions/v1/bank-pack', { token: coach.token, body: { action: 'manifest' } });
log('pack_coach', packCoach.status, packCoach.json?.error || packCoach.text);
const packSusp = await req('/functions/v1/bank-pack', { token: susp.token, body: { action: 'manifest' } });
log('pack_susp', packSusp.status, packSusp.json?.error || packSusp.text);
const packFree = await req('/functions/v1/bank-pack', { token: free.token, body: { action: 'manifest' } });
log('pack_free', packFree.status, packFree.json?.error || packFree.text);
const packNone = await req('/functions/v1/bank-pack', { token: '', body: { action: 'manifest' } });
log('pack_none', packNone.status, packNone.json?.error || packNone.text);

const adminRpc = await req('/rest/v1/rpc/admin_set_account_status', {
  token: coach.token,
  body: { p_id: student.id, p_status: 'pasif' },
});
log('coach_admin_rpc', adminRpc.status, adminRpc.json?.message || adminRpc.text);

const previewJwt = await req('/rest/v1/rpc/preview_disable_non_owner_accounts', {
  token: adminU.token,
  body: { p_confirm_owner: adminU.id },
});
log('preview_jwt', previewJwt.status, previewJwt.json?.message || previewJwt.text);

writeFileSync(join(root, '.local-e2e-users.json'), `${JSON.stringify({
  api,
  student: { email: student.email },
  free: { email: free.email },
  coach: { email: coach.email },
  coachB: { email: coachB.email },
  admin: { email: adminU.email },
  suspended: { email: susp.email },
  passwordHint: 'same local password as script; not printed',
}, null, 2)}\n`);

const credPath = process.env.YKS_E2E_CREDS || join(process.env.TEMP || '/tmp', 'yks-e2e-creds.json');
writeFileSync(credPath, JSON.stringify({
  api,
  origin: process.env.YKS_E2E_ORIGIN || 'http://127.0.0.1:5180',
  password: pass,
  student: student.email,
  free: free.email,
  coach: coach.email,
  coachB: coachB.email,
  admin: adminU.email,
  suspended: susp.email,
}));
console.log('E2E_CREDS_WRITTEN (path not secrets)');
