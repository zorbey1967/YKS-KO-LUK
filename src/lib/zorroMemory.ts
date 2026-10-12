import type { AppData, LearningNote } from './types';
import { detectSubject } from './aiTutor';

const SKIP = /yorgun|uykusu|merhaba|selam|naber|hava|şaka|meme|oyun/;

const ERROR_KINDS: [RegExp, string][] = [
  [/işlem|hesap|işaret|artı eksi|payda/i, 'işlem hatası'],
  [/formül|unut|ezber/i, 'formül unutma'],
  [/kavram|nedir|anlamad/i, 'kavram yanılgısı'],
  [/paragraf|yorum|metin/i, 'paragrafı yanlış yorumlama'],
  [/süre|zaman|yetiş/i, 'zaman baskısı'],
  [/bilgi|konu eksi/i, 'bilgi eksikliği'],
];

export function classifyErrorKind(text: string) {
  for (const [re, kind] of ERROR_KINDS) {
    if (re.test(text)) return kind;
  }
  return '';
}

/** Geçici sohbeti kalıcı hafızaya yazmaz. */
export function extractLearningSignal(userText: string): LearningNote | null {
  const t = userText.toLocaleLowerCase('tr-TR');
  if (t.length < 12 || SKIP.test(t)) return null;
  if (!/(yanlış|hata|anlamad|karıştır|zorlan|kaçır|bilemed)/.test(t)) return null;
  const subject = detectSubject(userText);
  const topic = (t.match(/türev|limit|integral|fonksiyon|paragraf|osmanlı|basınç|denklem|üçgen/) || [])[0] || subject;
  if (!topic) return null;
  const kind = classifyErrorKind(userText);
  return {
    topic,
    subject: subject || '',
    errorKind: kind,
    note: userText.replace(/\s+/g, ' ').trim().slice(0, 180),
    at: new Date().toISOString(),
  };
}

export function mergeLearningNote(data: AppData, note: LearningNote | null): AppData {
  if (!note) return data;
  const prev = data.learningNotes || [];
  const next = [note, ...prev.filter((n) => !(n.topic === note.topic && n.note === note.note))].slice(0, 24);
  return { ...data, learningNotes: next };
}

export function learningLines(data: AppData, topicHint = '', limit = 3) {
  const hint = topicHint.toLocaleLowerCase('tr-TR');
  const rows = (data.learningNotes || []).filter((n) => {
    if (!hint) return true;
    return `${n.topic} ${n.subject} ${n.note}`.toLocaleLowerCase('tr-TR').includes(hint);
  });
  return rows.slice(0, limit).map((n) => {
    const k = n.errorKind ? ` [${n.errorKind}]` : '';
    return `${n.subject ? `${n.subject} / ` : ''}${n.topic}${k}: ${n.note}`;
  });
}
