import type { AppData, PlanBlock } from './types';
import { chatReply, coachContext, generatePlan, iconForTopic, planToText } from './coach';
import { packAiResult } from './llmPrompt';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type CoachSource = 'ai' | 'local';
export type CoachAnswer = { text: string; source: CoachSource; model?: string; plan?: PlanBlock[]; error?: string };

type ChatTurn = { who: 'user' | 'bot'; text: string };

try {
  localStorage.removeItem('yks_llm_v1');
  sessionStorage.removeItem('yks_gemini_model');
} catch { /* ignore */ }

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' ? x as Record<string, unknown> : null;
}

function blocksFromUnknown(raw: unknown): PlanBlock[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: PlanBlock[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    if (!r) continue;
    const text = String(r.text || r.title || '').trim();
    const minutes = Number(r.minutes) || 0;
    if (!text || minutes <= 0) continue;
    out.push({ text, minutes: Math.min(180, minutes), icon: String(r.icon || iconForTopic(text)) });
  }
  return out.length ? out : undefined;
}

function fromPacked(raw: unknown, fallbackPlan?: PlanBlock[]) {
  const rec = asRecord(raw) || {};
  const packed = rec.reply || rec.plan || rec.schedule || rec.text
    ? rec
    : packAiResult('chat', String(rec.text || rec.reply || ''));
  const txt = String(packed.reply || packed.summary || packed.text || '').trim();
  const plan = blocksFromUnknown(packed.plan) || fallbackPlan;
  const model = String(rec.model || '');
  return { txt, plan, model };
}

function safeModelError(raw: string, status?: number) {
  const msg = raw.trim();
  if (!msg) return status ? `Model yanıt vermedi (HTTP ${status}).` : 'Model yanıt vermedi.';
  if (/AIza|sk-|Bearer\s|api[_-]?key/i.test(msg)) {
    return status ? `Model yanıt vermedi (HTTP ${status}).` : 'Model yanıt vermedi.';
  }
  return msg.length > 180 ? `${msg.slice(0, 177)}…` : msg;
}

async function invokeAi(body: Record<string, unknown>, ms: number): Promise<{ ok: true; data: unknown; model: string } | { ok: false; error: string }> {
  if (!supabaseUrl && !supabaseAnonKey) {
    return { ok: false, error: 'Supabase ayarı yok: VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY build’de boş. Gerçek model çağrılamaz.' };
  }
  if (!supabaseUrl) {
    return { ok: false, error: 'Supabase URL eksik (VITE_SUPABASE_URL). Vercel Production’a ekleyip yeniden yayınla.' };
  }
  if (!supabaseAnonKey) {
    return { ok: false, error: 'Supabase anon key eksik (VITE_SUPABASE_ANON_KEY). Vercel Production’a ekleyip yeniden yayınla.' };
  }
  if (!supabase) {
    return { ok: false, error: 'Supabase istemcisi oluşmadı. URL ve anon key’i kontrol et.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { ok: false, error: 'Oturum yok. Gerçek model için Hesabım’dan giriş yap; yerel koç yedek çalışır.' };
  }

  try {
    const ctrl = new AbortController();
    const msCap = Math.min(ms, 28000);
    const timer = window.setTimeout(() => ctrl.abort(), msCap);
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl}/functions/v1/student-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
    const rawText = await res.text();
    let rec: Record<string, unknown> | null = null;
    try { rec = rawText ? JSON.parse(rawText) as Record<string, unknown> : null; } catch { rec = null; }
    if (res.ok && rec && (rec.reply || rec.plan || rec.schedule)) {
      return { ok: true, data: rec, model: String(rec.model || 'Bulut koç') };
    }
    if (res.status === 401) return { ok: false, error: 'Oturum doğrulanamadı. Hesabım’dan tekrar giriş yap.' };
    if (res.status === 404) return { ok: false, error: 'student-ai fonksiyonu bulunamadı (HTTP 404). Supabase Edge Function yayında olmayabilir.' };
    if (res.status === 503) return { ok: false, error: safeModelError(String(rec?.error || 'Sunucu model anahtarı yok'), 503) };
    if (rec?.error) return { ok: false, error: safeModelError(String(rec.error), res.status) };
    if (!res.ok) return { ok: false, error: `student-ai yanıt vermedi (HTTP ${res.status}).` };
    return { ok: false, error: 'Model boş yanıt döndü.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Bulut koç hata';
    if (msg.toLowerCase().includes('abort')) return { ok: false, error: 'İstek zaman aşımına uğradı (student-ai).' };
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      return { ok: false, error: 'student-ai adresine ağ bağlantısı kurulamadı.' };
    }
    return { ok: false, error: safeModelError(msg) };
  }
}

export async function askCoach(q: string, data: AppData, history: ChatTurn[]): Promise<CoachAnswer> {
  const local = chatReply(q, data);
  const cloud = await invokeAi({
    action: 'chat',
    q,
    context: coachContext(data),
    grade: data.grade,
    age: data.age,
    track: data.track,
    dept: data.dept,
    history: history.slice(-8).map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })),
  }, 25000);
  if (cloud.ok) {
    const hit = fromPacked(cloud.data, local.plan);
    if (hit.txt) {
      const text = hit.plan && !/dk/.test(hit.txt) ? `${hit.txt}\n${planToText(hit.plan)}` : hit.txt;
      return { text, source: 'ai', model: hit.model || cloud.model, plan: hit.plan };
    }
  }
  const err = !cloud.ok ? cloud.error : 'Boş model yanıtı';
  return {
    text: `Gerçek model bağlanamadı.\n${err}\n\nYedek (yerel):\n${local.text}`,
    source: 'local',
    model: 'Yerel koç',
    plan: local.plan,
    error: err,
  };
}

export async function askDailyPlan(data: AppData, minutes: number, focus: string): Promise<{ blocks: PlanBlock[]; summary: string; source: CoachSource; model?: string }> {
  const local = generatePlan(data, minutes, focus);
  const cloud = await invokeAi({
    action: 'plan',
    minutes,
    focus,
    context: coachContext(data),
    instruction: `Günlük çalışma planı üret. JSON: { "summary": "...", "plan": [ { "text": "...", "minutes": 40, "icon": "📚" } ] }. Toplam yaklaşık ${minutes} dk. Odak: ${focus}.`,
  }, 40000);
  if (cloud.ok) {
    const hit = fromPacked(cloud.data);
    if (hit.plan?.length) {
      return { blocks: hit.plan, summary: hit.txt || 'AI günlük planı hazır.', source: 'ai', model: hit.model || cloud.model };
    }
  }
  const err = !cloud.ok ? cloud.error : 'Plan JSON gelmedi';
  return { blocks: local, summary: `Model yok/hata: ${err}`, source: 'local' };
}

export async function invokeScheduleAi(body: Record<string, unknown>) {
  return invokeAi(body, 45000);
}
