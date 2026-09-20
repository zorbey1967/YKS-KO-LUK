import type { AppData, PlanBlock } from './types';
import { chatReply, coachContext, generatePlan, iconForTopic, planToText } from './coach';
import { packAiResult } from './llmPrompt';
import { supabase, supabaseAnonKey, supabaseUrl, withTimeout } from './supabase';

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

async function invokeAi(body: Record<string, unknown>, ms: number): Promise<{ ok: true; data: unknown; model: string } | { ok: false; error: string }> {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: 'Sunucu bağlantısı yok. Hesabım’dan giriş yapıp tekrar dene.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { ok: false, error: 'Gerçek koç için Hesabım’dan giriş yap.' };
  }

  try {
    const res = await withTimeout(
      fetch(`${supabaseUrl}/functions/v1/student-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }),
      Math.min(ms, 28000),
    );
    const rec = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (res.ok && rec && (rec.reply || rec.plan || rec.schedule)) {
      return { ok: true, data: rec, model: String(rec.model || 'Bulut koç') };
    }
    if (rec?.error) return { ok: false, error: String(rec.error) };
    if (res.status === 401) return { ok: false, error: 'Oturum doğrulanamadı. Hesabım’dan tekrar giriş yap.' };
    return { ok: false, error: `Model yanıt vermedi (HTTP ${res.status}).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Bulut koç hata' };
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
