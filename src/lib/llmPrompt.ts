export type StudentAiBody = {
  action?: string;
  q?: string;
  context?: unknown;
  instruction?: string;
  history?: { role?: string; content?: string }[];
  minutes?: number;
  focus?: string;
  pdf_text?: string;
  filename?: string;
  grade?: string;
  age?: number;
  track?: string;
  dept?: string;
};

export function coachSystemPrompt(ctx: string) {
  return [
    'Sen Türkiye’deki öğrencilere çalışan gerçek bir e-koçsun (YKS, KPSS, 1–12. sınıf).',
    'Adın E-Koç. Sıcak, net, kısa cevap ver. Uydurma sıralama / puan / üniversite şansı söyleme.',
    'ÖSYM net = doğru − (yanlış / 4). Yaşa uygun blok: ilkokul 15–20 dk, ortaokul 30–40, lise/YKS 40–70, KPSS 40–60.',
    'Sınav temposu: zamanlı set, yanlış etiketleme (bilgi/işlem/süre/dikkatsizlik), TYT tabanı oturmadan AYT’ye yığılma.',
    'Somut sonraki adım ver (süre + konu + nasıl). Ezber slogan ve sıralama tahmini yok.',
    'Öğrenci dosyası:',
    ctx || 'Dosya boş.',
    'Çalışma planı verdiğinde yanıtın sonunda YALNIZCA şu JSON bloğu olsun:',
    '{"plan":[{"text":"konu","minutes":40,"icon":"📚"}]}',
  ].join('\n');
}

export function buildUserPrompt(body: StudentAiBody) {
  const action = body.action || 'chat';
  const ctx = typeof body.context === 'string' ? body.context : JSON.stringify(body.context || {});
  if (action === 'schedule') {
    return `${body.instruction || 'Haftalık program üret.'}\nPDF/metin:\n${(body.pdf_text || '').slice(0, 14000)}\nSadece JSON: {"summary":"...","schedule":{"days":[{"day":"Pazartesi","blocks":[{"title":"...","minutes":40,"icon":"📚"}]}]}}`;
  }
  if (action === 'plan') {
    return `${body.instruction || 'Günlük plan üret.'}\nToplam ~${body.minutes || 120} dk. Odak: ${body.focus || 'eksik konular'}.\nSadece JSON: {"summary":"...","plan":[{"text":"...","minutes":40,"icon":"📚"}]}`;
  }
  return body.q || body.instruction || `Bu öğrenciye bugün ne çalışacağını 3 adımda söyle.\n${ctx}`;
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(raw.slice(start, end + 1));
    return v && typeof v === 'object' ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function packAiResult(action: string, text: string) {
  const parsed = extractJsonObject(text) || {};
  const reply = String(parsed.reply || '').trim() || (action === 'chat' ? text.replace(/```[\s\S]*```/g, '').trim() : text.slice(0, 500));
  return {
    reply,
    summary: String(parsed.summary || ''),
    plan: parsed.plan,
    schedule: parsed.schedule,
    text,
  };
}
