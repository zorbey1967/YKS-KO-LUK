import type { AppData, TopicProgress } from './types';

const JUMP_KEY = 'yks_qb_jump';

export type BankJump = { level: string; subject?: string | null; topic?: string | null };

export function setBankJump(jump: BankJump) {
  try {
    sessionStorage.setItem(JUMP_KEY, JSON.stringify(jump));
  } catch {
    /* ignore */
  }
}

export function takeBankJump(): BankJump | null {
  try {
    const raw = sessionStorage.getItem(JUMP_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(JUMP_KEY);
    const v = JSON.parse(raw) as BankJump;
    return v?.level ? v : null;
  } catch {
    return null;
  }
}

export function parseBankKey(key: string) {
  const [level = '', subject = '', topic = ''] = key.split('|');
  return { level, subject, topic, key };
}

export type WeakBankTopic = TopicProgress & {
  levelName: string;
  subject: string;
  topic: string;
  acc: number;
};

export function weakBankTopics(data: AppData, limit = 5): WeakBankTopic[] {
  return Object.values(data.qb)
    .map((m) => {
      const p = parseBankKey(m.key);
      const acc = m.answered ? Math.round((m.correct / m.answered) * 100) : 0;
      return { ...m, levelName: p.level, subject: p.subject, topic: p.topic, acc };
    })
    .filter((x) => x.topic && (x.wrong > 0 || (x.answered > 0 && x.acc < 70) || (!x.completed && x.answered > 0)))
    .sort((a, b) => (b.wrong - a.wrong) || (a.acc - b.acc) || (b.answered - a.answered))
    .slice(0, limit);
}

export function lastBankTopic(data: AppData): WeakBankTopic | null {
  const rows = Object.values(data.qb)
    .map((m) => {
      const p = parseBankKey(m.key);
      const acc = m.answered ? Math.round((m.correct / m.answered) * 100) : 0;
      return { ...m, levelName: p.level, subject: p.subject, topic: p.topic, acc };
    })
    .filter((x) => x.topic && x.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows[0] || null;
}

export function suggestedBankLevels(grade: string): string[] {
  if (grade.includes('KPSS')) return ['KPSS Genel Yetenek', 'KPSS Genel Kültür', 'KPSS Eğitim Bilimleri'];
  if (grade.includes('Mezun')) return ['YKS TYT', 'YKS AYT'];
  const n = Number((grade.match(/^(\d+)/) || [])[1] || 0);
  if (n === 11 || n === 12) return ['YKS TYT', 'YKS AYT', grade];
  if (n >= 1 && n <= 12) return [grade];
  return [];
}

export function defaultBankLevel(grade: string) {
  if (!grade.trim()) return '';
  if (grade.includes('KPSS')) return 'KPSS Genel Yetenek';
  if (grade.includes('Mezun') || grade.startsWith('11') || grade.startsWith('12')) return 'YKS TYT';
  return grade;
}

export function jumpFromTracker(grade: string, subject: string, topic: string): BankJump {
  const s = subject.trim();
  if (s.startsWith('TYT ')) {
    return { level: 'YKS TYT', subject: s.slice(4), topic };
  }
  if (s === 'AYT Edebiyat') return { level: 'YKS AYT', subject: 'Türk Dili ve Edebiyatı', topic };
  if (s === 'AYT Tarih-1' || s === 'AYT Tarih') return { level: 'YKS AYT', subject: 'Tarih', topic };
  if (s === 'AYT Coğrafya-1' || s === 'AYT Coğrafya') return { level: 'YKS AYT', subject: 'Coğrafya', topic };
  if (s === 'AYT Sosyal-2') return { level: 'YKS AYT', subject: 'Felsefe Grubu', topic };
  if (s === 'AYT Felsefe Grubu') return { level: 'YKS AYT', subject: 'Felsefe Grubu', topic };
  if (s === 'AYT Din Kültürü') return { level: 'YKS AYT', subject: 'Din Kültürü', topic };
  if (s.startsWith('AYT ')) return { level: 'YKS AYT', subject: s.slice(4), topic };
  if (s.startsWith('Genel Yetenek')) return { level: 'KPSS Genel Yetenek', subject: s, topic };
  if (s === 'Eğitim Bilimleri') return { level: 'KPSS Eğitim Bilimleri', subject: s, topic };
  if (s === 'Vatandaşlık' || s === 'Güncel' || s.startsWith('Genel Kültür')) {
    return { level: 'KPSS Genel Kültür', subject: s, topic };
  }
  return { level: /^\d/.test(grade) ? grade : defaultBankLevel(grade), subject: s, topic };
}
