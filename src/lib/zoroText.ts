/** Kullanıcıya giden Zorro metni: ham model/JSON/sağlayıcı sızmasın. */

const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB = '₀₁₂₃₄₅₆₇₈₉';

function digitsTo(map: string, n: string) {
  return n.replace(/\d/g, (d) => map[Number(d)] || d);
}

export function publicCoachBrand() {
  return 'ZORRO';
}

/** Kullanıcıya gösterilen kaynak etiketi. Ham model adı (Gemini vb.) basılmaz. */
export function publicSourceLabel(_raw?: string) {
  return 'ZORRO';
}

export function stripProviderNames(text: string) {
  return text
    .replace(/\bgoogle\s*gemini\b/gi, 'ZORRO')
    .replace(/\bgemini[-.\w]*/gi, 'ZORRO')
    .replace(/\b(openai|chatgpt|gpt-?\d|claude|anthropic)\b/gi, 'ZORRO')
    .replace(/\bE-Koç(?:\s*Zorro)?\b/gi, 'ZORRO')
    .replace(/\bZoro\b/gi, 'ZORRO');
}

function latexToPlain(src: string) {
  let t = src;
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  t = t.replace(/\$([^$\n]+)\$/g, '$1');
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
  t = t.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  t = t.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  t = t.replace(/\\cdot|\\times/g, '×');
  t = t.replace(/\\div/g, '÷');
  t = t.replace(/\\pm/g, '±');
  t = t.replace(/\\infty/g, '∞');
  t = t.replace(/\\rightarrow|\\to/g, '→');
  t = t.replace(/\\left|\\right|\\,|\\;|\\!|\\quad|\\qquad/g, '');
  t = t.replace(/\^\{([0-9]+)\}/g, (_, n) => digitsTo(SUPER, n));
  t = t.replace(/\^([0-9])/g, (_, n) => digitsTo(SUPER, n));
  t = t.replace(/_\{([0-9]+)\}/g, (_, n) => digitsTo(SUB, n));
  t = t.replace(/_([0-9])/g, (_, n) => digitsTo(SUB, n));
  t = t.replace(/\\(?:mathrm|mathbf|mathit|text)\{([^{}]+)\}/g, '$1');
  t = t.replace(/\\[a-zA-Z]+/g, '');
  t = t.replace(/[{}]/g, '');
  return t;
}

function tryWholeJson(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return null;
  try {
    const v = JSON.parse(t);
    return v && typeof v === 'object' ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function looksInternal(text: string) {
  return /tutorContext|student_data|intent\s*:|function_call|tool_call|system prompt|GEMINI_API|AIza[0-9A-Za-z_-]{10,}/i.test(text);
}

function looksBrokenMathDump(text: string) {
  const slashes = (text.match(/\\[a-zA-Z]{2,}/g) || []).length;
  const braces = (text.match(/[{}]/g) || []).length;
  return slashes >= 6 || (braces >= 10 && /\\frac|\\left/.test(text));
}

export function sanitizeZoroReply(raw: string, fallback = 'Şu an net bir cevap üretemedim. Soruyu bir kez daha, daha kısa yaz.') {
  let t = String(raw || '').replace(/\u0000/g, '').trim();
  if (!t) return fallback;

  const whole = tryWholeJson(t);
  if (whole) {
    t = String(whole.reply || whole.summary || whole.text || '').trim() || fallback;
  }

  t = t.replace(/```(?:json)?[\s\S]*?```/g, (block) => {
    if (/[{[]/.test(block) && /"(reply|plan|schedule|intent)"/.test(block)) return '';
    return block.replace(/```(?:json)?/g, '').replace(/```/g, '');
  });
  t = t.replace(/\{[^{}]{0,400}"(reply|intent|plan|tutorContext|student_data|action)"[^{}]{0,400}\}/g, '');
  t = t.replace(/^\s*\[(?:plans?|schedule|context|intent)\]\s*/gim, '');
  t = t.replace(/\((?:S|s)\)\s*\(/g, 'f(');
  t = latexToPlain(t);
  t = stripProviderNames(t);
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (looksInternal(t) || looksBrokenMathDump(t) || t.length < 2) return fallback;
  if (/ben (google )?gemini|i am (google )?gemini|ben zoro\b|ben e-ko[cç]/i.test(t)) {
    t = t.replace(/ben (google )?gemini[^.]*\.?/gi, 'Ben ZORRO.');
    t = t.replace(/ben e-ko[cç](?:\s*zorro)?[^.]*\.?/gi, 'Ben ZORRO.');
    t = t.replace(/\bZoro\b/gi, 'ZORRO');
  }
  return t.slice(0, 8000);
}

export function formatZoroHtml(text: string) {
  const clean = sanitizeZoroReply(text);
  const escaped = clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const withCode = escaped.replace(/```([\s\S]*?)```/g, '<pre class="chat-code">$1</pre>');
  const withInline = withCode.replace(/`([^`]+)`/g, '<code>$1</code>');
  const withBold = withInline.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withHead = withBold.replace(/^###?\s+(.+)$/gm, '<strong>$1</strong>');
  const withLi = withHead.replace(/^(?:[-*]|•)\s+(.+)$/gm, '• $1');
  return withLi.replace(/\n/g, '<br />');
}

export function localTeachLesson(q: string) {
  const t = q.toLocaleLowerCase('tr-TR');
  if (/türe[v]/.test(t)) {
    return [
      'Türev, bir fonksiyonun değişim hızını ölçer: x biraz değiştiğinde y ne kadar değişir?',
      '',
      'Örnek: f(x) = x²',
      'Kural: kuvveti öne al, üssü 1 azalt → f′(x) = 2x',
      '',
      'x = 3 noktasında eğim f′(3) = 6’dır. Yani o noktada grafik, eğimi 6 olan bir doğruya benzer.',
      '',
      'İstersen grafikte ne anlama geldiğini veya çarpım/bölüm kurallarını anlatabilirim. Şimdilik bir kontrol: f(x) = x³ için f′(x) nedir?',
    ].join('\n');
  }
  if (/limit/.test(t)) {
    return [
      'Limit, bir fonksiyonun x belirli bir değere yaklaşırken y’nin hangi değere yaklaştığını söyler. Fonksiyon o noktada tanımsız olsa bile limit var olabilir.',
      '',
      'Örnek: lim(x→2) (x² − 4)/(x − 2) = lim(x→2) (x−2)(x+2)/(x−2) = 4',
      '',
      'Kontrol: lim(x→0) (x+5) kaçtır?',
    ].join('\n');
  }
  if (/integral/.test(t)) {
    return [
      'Belirsiz integral, türevin ters işlemidir: hangisinin türevi bu fonksiyonu verir?',
      '',
      'Örnek: ∫ 2x dx = x² + C  (çünkü x² türevi 2x’dir; C sabit kaybolur).',
      '',
      'Kontrol: ∫ 3 dx nedir?',
    ].join('\n');
  }
  return '';
}

export function parseExamAddIntent(q: string): { title: string; date: string; time: string } | null {
  const t = q.trim();
  if (!/(deneme|sınav|ayt|tyt|lgs|kpss|yks)/i.test(t)) return null;
  const months: Record<string, string> = {
    ocak: '01', şubat: '02', subat: '02', mart: '03', nisan: '04', mayıs: '05', mayis: '05',
    haziran: '06', temmuz: '07', ağustos: '08', agustos: '08', eylül: '09', eylul: '09',
    ekim: '10', kasım: '11', kasim: '11', aralık: '12', aralik: '12',
  };
  let iso = '';
  const isoHit = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  const dmy = t.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?/);
  const named = t.toLocaleLowerCase('tr-TR').match(/(\d{1,2})\s*(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+(\d{4}))?/);
  if (isoHit) iso = isoHit[0];
  else if (dmy) {
    iso = `${dmy[3] || '2026'}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  } else if (named) {
    iso = `${named[3] || '2026'}-${months[named[2]]}-${named[1].padStart(2, '0')}`;
  } else return null;
  const timeM = t.match(/\b(\d{1,2})[:.](\d{2})\b/);
  const time = timeM ? `${timeM[1].padStart(2, '0')}:${timeM[2]}` : '';
  const title = t
    .replace(/\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{4})?|\d{1,2}\s*(?:ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+\d{4})?|\bsaat\b|\d{1,2}[:.]\d{2}/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Deneme';
  return { title: title.slice(0, 80), date: iso, time };
}

export function isAffirmative(q: string) {
  const t = q.toLocaleLowerCase('tr-TR').trim();
  return /^(evet|olur|ekle|tamam|aynen|ok|oke|onayla)\b/.test(t) || /ekle(meni)? isterim|evet ekle/.test(t);
}
