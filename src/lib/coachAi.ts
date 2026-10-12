import type { AppData, PlanBlock } from './types';
import { chatReply, generatePlan, iconForTopic, planToText } from './coach';
import { detectExamBand, detectSubject, tutorUserPrompt } from './aiTutor';
import { findBankQuestions } from './bank';
import { packAiResult, extractJsonObject } from './llmPrompt';
import { localTeachLesson, publicCoachBrand, sanitizeZoroReply } from './zoroText';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import { routeToTutorIntent, routeZorroMessage, wantsDirectSolution, historyLimit, type ZorroRoute } from './zorroIntent';
import { selectZorroContext } from './zorroContext';
import { zorroActions, type ZorroUiAction } from './zorroSuggest';
import { extractLearningSignal } from './zorroMemory';
import type { LearningNote } from './types';

export type CoachSource = 'ai' | 'local';
export type CoachAnswer = {
  text: string;
  source: CoachSource;
  model?: string;
  plan?: PlanBlock[];
  error?: string;
  route?: ZorroRoute;
  actions?: ZorroUiAction[];
  learning?: LearningNote | null;
};

type ChatTurn = { who: 'user' | 'bot'; text: string };
export type TutorImage = { b64: string; mime: string };

const USER_FAIL = 'ZORRO şu anda yanıt veremiyor. Lütfen biraz sonra tekrar dene.';

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
  const txt = sanitizeZoroReply(String(packed.reply || packed.summary || packed.text || '').trim());
  const plan = blocksFromUnknown(packed.plan) || fallbackPlan;
  return { txt, plan, model: publicCoachBrand() };
}

async function invokeAi(body: Record<string, unknown>, ms: number): Promise<{ ok: true; data: unknown; model: string } | { ok: false; error: string; debug?: string }> {
  if (!supabaseUrl || !supabaseAnonKey || !supabase) {
    return { ok: false, error: USER_FAIL, debug: 'supabase_config' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { ok: false, error: 'Gerçek Zorro için Hesabım’dan giriş yap.', debug: 'no_session' };
  }

  try {
    const ctrl = new AbortController();
    const msCap = Math.min(ms, 28000);
    const timer = window.setTimeout(() => ctrl.abort(), msCap);
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl}/functions/v1/student-ai`, {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
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
      return { ok: true, data: rec, model: publicCoachBrand() };
    }
    if (res.status === 401) return { ok: false, error: 'Oturum doğrulanamadı. Hesabım’dan tekrar giriş yap.', debug: '401' };
    if (res.status === 402) return { ok: false, error: String(rec?.error || 'Deneme veya üyelik gerekli.'), debug: '402' };
    if (res.status === 404) return { ok: false, error: USER_FAIL, debug: '404' };
    console.warn('student-ai', res.status, rec?.error || rawText.slice(0, 120));
    return { ok: false, error: USER_FAIL, debug: String(res.status) };
  } catch (e) {
    console.warn('student-ai network', e);
    return { ok: false, error: USER_FAIL, debug: 'network' };
  }
}

function bankSnippet(q: string, data: AppData, route: ZorroRoute) {
  if (route !== 'quiz' && route !== 'tutor' && route !== 'review') return '';
  const t = q.toLocaleLowerCase('tr-TR');
  const diff = t.includes('zor') ? 'Zor' : t.includes('kolay') ? 'Kolay' : t.includes('orta') ? 'Orta' : undefined;
  const topic = (t.match(/türev|limit|integral|paragraf|basınç|osmanlı|fonksiyon|denklem/) || [])[0] || detectSubject(q);
  const bank = findBankQuestions({
    topic: topic || undefined,
    difficulty: diff,
    examHint: detectExamBand(q, data),
    limit: route === 'quiz' ? 3 : 1,
  });
  if (!bank.length) return '\nSoru bankasında eşleşen madde yok. Uydurma ID verme. AI ile uydurduğun soruyu “banka sorusu” diye sunma.';
  return `\nGERÇEK SORU BANKASI (cevap gizli, AI üretimi değil):\n${bank.map((b, i) => `${i + 1}. ${b.q}\nŞıklar: ${b.o.map((o, n) => `${String.fromCharCode(65 + n)}) ${o}`).join(' / ')}`).join('\n')}`;
}

export async function askCoach(q: string, data: AppData, history: ChatTurn[], image?: TutorImage | null): Promise<CoachAnswer> {
  const local = chatReply(q, data);
  const route = routeZorroMessage(q, Boolean(image));
  const intent = image ? 'solve' as const : routeToTutorIntent(route);
  const lesson = !image ? localTeachLesson(q) : '';
  let context = selectZorroContext(data, q, route);
  context += bankSnippet(q, data, route);
  if (route === 'question_solving' && !wantsDirectSolution(q)) {
    context += '\nPedagoji: önce verilenleri ayır, bir ipucu ver, öğrencinin denemesini iste. Direkt çözüm istemedikçe cevabı başa koyma.';
  }
  if (wantsDirectSolution(q)) {
    context += '\nÖğrenci tam çözüm istedi; direnme, açık çöz.';
  }
  const histN = historyLimit(route);
  const payload: Record<string, unknown> = {
    action: 'chat',
    intent,
    q: tutorUserPrompt(q, intent),
    context,
    history: history.slice(-histN).map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 800) })),
    ...(image ? { image_b64: image.b64, image_mime: image.mime } : {}),
  };
  const cloud = await invokeAi(payload, image ? 28000 : 25000);
  const actions = zorroActions(data, route);
  const learning = extractLearningSignal(q);
  if (cloud.ok) {
    const hit = fromPacked(cloud.data, local.plan);
    if (hit.txt) {
      const text = hit.plan && !/dk/.test(hit.txt) ? `${hit.txt}\n${planToText(hit.plan)}` : hit.txt;
      return { text: sanitizeZoroReply(text), source: 'ai', model: publicCoachBrand(), plan: hit.plan, route, actions, learning };
    }
  }
  if (lesson) {
    return { text: lesson, source: 'local', model: publicCoachBrand(), route, actions, learning };
  }
  return {
    text: USER_FAIL,
    source: 'local',
    model: publicCoachBrand(),
    plan: local.plan,
    error: cloud.ok ? 'empty' : cloud.debug,
    route,
    actions,
    learning,
  };
}

export async function askZorroPlain(q: string, context: string): Promise<CoachAnswer> {
  const cloud = await invokeAi({
    action: 'chat',
    intent: 'chat',
    q,
    context,
    history: [],
  }, 20000);
  if (cloud.ok) {
    const hit = fromPacked(cloud.data);
    if (hit.txt) return { text: sanitizeZoroReply(hit.txt), source: 'ai', model: publicCoachBrand() };
  }
  return { text: USER_FAIL, source: 'local', error: cloud.ok ? 'empty' : cloud.debug };
}

export async function askDailyPlan(data: AppData, minutes: number, focus: string): Promise<{ blocks: PlanBlock[]; summary: string; source: CoachSource; model?: string }> {
  const local = generatePlan(data, minutes, focus);
  const cloud = await invokeAi({
    action: 'plan',
    minutes,
    focus,
    context: selectZorroContext(data, `${minutes} dk ${focus}`, 'plan'),
    instruction: `Günlük çalışma planı üret. JSON: { "summary": "...", "plan": [ { "text": "...", "minutes": 40, "icon": "📚" } ] }. Toplam yaklaşık ${minutes} dk. Odak: ${focus}. Kayıtsız zayıf konu uydurma. Programı uygulamadan öner.`,
  }, 40000);
  if (cloud.ok) {
    const hit = fromPacked(cloud.data);
    if (hit.plan?.length) {
      return { blocks: hit.plan, summary: hit.txt || 'Zorro günlük planı hazır.', source: 'ai', model: publicCoachBrand() };
    }
  }
  return { blocks: local, summary: USER_FAIL, source: 'local' };
}

export async function invokeScheduleAi(body: Record<string, unknown>) {
  return invokeAi(body, 45000);
}

export async function askExamPlan(data: AppData, instruction: string) {
  const cloud = await invokeAi({
    action: 'chat',
    q: instruction,
    context: selectZorroContext(data, instruction, 'plan'),
  }, 40000);
  if (!cloud.ok) return { ok: false as const, error: cloud.error };
  const rec = asRecord(cloud.data) || {};
  const parsed = extractJsonObject(String(rec.text || rec.reply || rec.summary || '')) || rec;
  const stagesRaw = parsed.stages;
  const stages = Array.isArray(stagesRaw)
    ? stagesRaw.map((s) => {
      const r = asRecord(s);
      return { title: String(r?.title || '').trim(), body: String(r?.body || r?.text || '').trim() };
    }).filter((s) => s.title || s.body)
    : [];
  const summary = String(parsed.summary || rec.summary || rec.reply || '').trim();
  if (!summary && !stages.length) return { ok: false as const, error: USER_FAIL };
  return {
    ok: true as const,
    model: publicCoachBrand(),
    summary,
    weekHint: String(parsed.weekHint || '').trim(),
    advice: String(parsed.advice || '').trim(),
    stages,
    lastWeek: String(parsed.lastWeek || '').trim(),
  };
}


