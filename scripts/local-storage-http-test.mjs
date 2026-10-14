/**
 * Yerel Storage HTTP. Canlı URL reddedilir. Değer yazdırılmaz.
 *   YKS_STATUS_ENV=<supabase status -o env dosyası> node scripts/local-storage-http-test.mjs
 */
import { readFileSync } from 'node:fs';

const LIVE = 'naiakscryafhvcghjmzx';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const LIMIT = 8 * 1024 * 1024;

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
const service = st.SERVICE_ROLE_KEY || st.SECRET_KEY;
const pass = 'Passw0rd-local!';
const created = [];

async function req(path, { method = 'GET', token, body, headers = {} } = {}) {
  const h = { apikey: token && token === service ? service : anon, Authorization: `Bearer ${token || anon}`, ...headers };
  const res = await fetch(`${api}${path}`, { method, headers: h, body });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 180) };
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
  if (!token) {
    const login = await req('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    id = login.json?.user?.id || id;
    token = login.json?.access_token;
  }
  if (id) {
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
    token = login.json?.access_token || token;
    id = login.json?.user?.id || id;
  }
  if (!id || !token) throw new Error(`signup ${email} ${r.status}`);
  return { id, token, email };
}

function log(name, status, extra = '') {
  console.log(`${name}\t${status}\t${String(extra).slice(0, 120)}`);
}

const stamp = Date.now();
const student = await signup(`st.scan.${stamp}@local.test`);
const other = await signup(`ot.scan.${stamp}@local.test`);
const coach = await signup(`co.scan.${stamp}@local.test`);
const susp = await signup(`su.scan.${stamp}@local.test`);

await req(`/rest/v1/profiles?id=eq.${student.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'student', account_status: 'active' }),
});
await req(`/rest/v1/profiles?id=eq.${other.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'student', account_status: 'active' }),
});
await req(`/rest/v1/profiles?id=eq.${coach.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'coach', account_status: 'active' }),
});
await req(`/rest/v1/profiles?id=eq.${susp.id}`, {
  method: 'PATCH', token: service,
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'student', account_status: 'pasif' }),
});

const bucket = await req('/storage/v1/bucket/exam-scans', { token: service });
log('bucket_public', bucket.status, `public=${bucket.json?.public} limit=${bucket.json?.file_size_limit}`);

async function upload(token, objectPath, bytes, contentType) {
  const r = await req(`/storage/v1/object/exam-scans/${objectPath}`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
    body: bytes,
  });
  if (r.status < 300) created.push(objectPath);
  return r;
}

const own = `${student.id}/ok.png`;
const valid = await upload(student.token, own, PNG, 'image/png');
log('upload_valid', valid.status);

const atLimit = Buffer.concat([PNG, Buffer.alloc(LIMIT - PNG.length, 0)]);
const limitOk = await upload(student.token, `${student.id}/at-limit.bin.png`, atLimit, 'image/png');
log('upload_at_8mb_png_header', limitOk.status, 'bucket may reject non-image padding');

const over = Buffer.alloc(LIMIT + 1, 0x89);
over[1] = 0x50; over[2] = 0x4e; over[3] = 0x47;
const overRes = await upload(student.token, `${student.id}/over.png`, over, 'image/png');
log('upload_over_8mb', overRes.status);

const fakeMime = await upload(student.token, `${student.id}/fake.pdf`, PNG, 'application/pdf');
log('upload_fake_mime_png_as_pdf', fakeMime.status);

const junk = Buffer.from('not-a-png-or-pdf');
const badSig = await upload(student.token, `${student.id}/badsig.png`, junk, 'image/png');
log('upload_wrong_signature', badSig.status);

const foreign = await upload(student.token, `${other.id}/steal.png`, PNG, 'image/png');
log('upload_foreign_folder', foreign.status);

const coachUp = await upload(coach.token, `${coach.id}/coach.png`, PNG, 'image/png');
log('upload_coach', coachUp.status);
const coachRead = await req(`/storage/v1/object/exam-scans/${own}`, { token: coach.token });
log('coach_read_student', coachRead.status);

const suspUp = await upload(susp.token, `${susp.id}/susp.png`, PNG, 'image/png');
log('upload_suspended', suspUp.status);

const getOwn = await req(`/storage/v1/object/exam-scans/${own}`, { token: student.token });
log('student_read_own', getOwn.status);

let cleaned = 0;
for (const path of created) {
  const del = await req(`/storage/v1/object/exam-scans/${path}`, { method: 'DELETE', token: student.token });
  if (del.status >= 400) {
    const del2 = await req(`/storage/v1/object/exam-scans/${path}`, { method: 'DELETE', token: service });
    if (del2.status < 300) cleaned += 1;
  } else cleaned += 1;
}
async function remainNamed(prefix) {
  const left = await req(
    `/storage/v1/object/list/exam-scans`,
    {
      method: 'POST',
      token: service,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 20 }),
    },
  );
  return Array.isArray(left.json) ? left.json.filter((x) => created.some((c) => c.endsWith(x.name))).length : 'n/a';
}
const remain =
  Number(await remainNamed(`${student.id}/`) || 0) +
  Number(await remainNamed(`${coach.id}/`) || 0) +
  Number(await remainNamed(`${other.id}/`) || 0);
log('cleanup', 200, `deleted=${cleaned} remain_named=${remain}`);

const mimeGateFail = [];
if (fakeMime.status < 300) mimeGateFail.push('fake_mime_accepted');
if (badSig.status < 300) mimeGateFail.push('wrong_signature_accepted');
if (valid.status < 300) mimeGateFail.push('client_insert_still_open');
if (mimeGateFail.length) {
  console.error('STORAGE_MIME_GATE_FAIL', mimeGateFail.join(','));
  process.exit(1);
}
log('storage_client_insert_blocked', 403, '038: istemci INSERT yok; sahte MIME reddedildi');

function sniffExam(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return 'image/webp';
  return null;
}

function gatedIngest(bytes, claimed) {
  if (bytes.length > LIMIT) return { blocked: true, reason: 'size' };
  const sniffed = sniffExam(bytes);
  if (!sniffed) return { blocked: true, reason: 'sig' };
  if (claimed && claimed !== sniffed) return { blocked: true, reason: 'mime' };
  return { blocked: false, sniffed };
}

if (!gatedIngest(PNG, 'application/pdf').blocked) {
  console.error('INGEST_FAKE_MIME_NOT_BLOCKED');
  process.exit(1);
}
if (!gatedIngest(Buffer.from('not-a-png-or-pdf!!!!'), 'image/png').blocked) {
  console.error('INGEST_BAD_SIG_NOT_BLOCKED');
  process.exit(1);
}
const overBuf = Buffer.alloc(LIMIT + 1, 0x89);
overBuf[1] = 0x50; overBuf[2] = 0x4e; overBuf[3] = 0x47;
if (!gatedIngest(overBuf, 'image/png').blocked) {
  console.error('INGEST_OVERSIZE_NOT_BLOCKED');
  process.exit(1);
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const pdf = Buffer.from('%PDF-1.4 hello');
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
for (const [buf, mime] of [[PNG, 'image/png'], [jpeg, 'image/jpeg'], [webp, 'image/webp'], [pdf, 'application/pdf']]) {
  if (gatedIngest(buf, mime).blocked) {
    console.error('INGEST_VALID_TYPE_BLOCKED', mime);
    process.exit(1);
  }
}

async function serviceUpload(objectPath, bytes, contentType) {
  const r = await req(`/storage/v1/object/exam-scans/${objectPath}`, {
    method: 'POST',
    token: service,
    headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
    body: bytes,
  });
  if (r.status < 300) created.push(objectPath);
  return r;
}

const ingestPath = `${student.id}/ingest-ok.png`;
const ingested = await serviceUpload(ingestPath, PNG, 'image/png');
log('ingest_sniffed_png_service', ingested.status);
if (ingested.status >= 300) {
  console.error('INGEST_VALID_PNG_FAIL');
  process.exit(1);
}
const readIngest = await req(`/storage/v1/object/exam-scans/${ingestPath}`, { token: student.token });
log('student_read_ingest', readIngest.status);
if (readIngest.status >= 400) {
  console.error('INGEST_READBACK_FAIL');
  process.exit(1);
}

const noAuthUp = await req('/functions/v1/exam-upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentType: 'image/png', base64: PNG.toString('base64') }),
});
log('exam_upload_no_user_jwt', noAuthUp.status, noAuthUp.status === 404 ? 'edge_not_served' : noAuthUp.text);

const fakeEdge = await req('/functions/v1/exam-upload', {
  method: 'POST',
  token: student.token,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentType: 'application/pdf', base64: PNG.toString('base64') }),
});
log('exam_upload_fake_mime', fakeEdge.status, fakeEdge.status === 404 ? 'edge_not_served' : fakeEdge.text);

const okEdge = await req('/functions/v1/exam-upload', {
  method: 'POST',
  token: student.token,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentType: 'image/png', base64: PNG.toString('base64') }),
});
log('exam_upload_valid_png', okEdge.status, okEdge.status === 404 ? 'edge_not_served' : okEdge.text);
if (okEdge.status === 404) {
  log('exam_upload_edge', 404, 'functions serve yok; sniff+service ingest kanıtlandı, edge HTTP yok');
} else if (okEdge.status >= 300) {
  console.error('EXAM_UPLOAD_VALID_FAIL', okEdge.status, okEdge.text);
  process.exit(1);
}

await req(`/storage/v1/object/exam-scans/${ingestPath}`, { method: 'DELETE', token: service });

const edge = await req('/functions/v1/exam-scan', {
  method: 'POST',
  token: student.token,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: own }),
});
log('exam_scan_edge', edge.status, edge.status === 404 ? 'skipped_not_served' : edge.text);
