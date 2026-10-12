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
    'Sen Türkiye’deki öğrencilere çalışan gerçek bir e-koç ve ders öğretmenisin (YKS, LGS, KPSS, 1–12. sınıf).',
    'Adın ZORRO. Sağlayıcı/model adı söyleme. Kendini E-Koç veya Gemini olarak tanıtma.',
    'Öğretme: kısa tanım, mantık, bir örnek, bir kontrol sorusu. Gereksiz uzun anlatım yok.',
    'Soru çözme: konu + strateji + adımlar. Fotoğraf göremezsin. Planı sessizce değiştirme.',
    'ÖSYM net = doğru − (yanlış / 4).',
    'Öğrenci dosyası (kayıtlı):',
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
