import type { TutorIntent } from './aiTutor';

/** Maliyet: basit selamda ağır context yok. */
export type ZorroRoute =
  | 'simple_chat'
  | 'tutor'
  | 'question_solving'
  | 'review'
  | 'quiz'
  | 'exam_analysis'
  | 'performance'
  | 'plan'
  | 'planner'
  | 'goal'
  | 'task'
  | 'coach_context'
  | 'photo'
  | 'exam';

export function wantsDirectSolution(q: string) {
  const t = q.toLocaleLowerCase('tr-TR');
  return /direkt (çöz|cevap)|sadece cevap|cevabı söyle|cevap kaç|tam çözüm|hemen çöz/.test(t);
}

export function isSimpleGreeting(q: string) {
  const t = q.toLocaleLowerCase('tr-TR').trim();
  return /^(selam|merhaba|hey|sa|slm|naber|nasılsın|nasilsin)([!.? ]|$)/.test(t) && t.length < 40;
}

export function routeZorroMessage(q: string, hasImage: boolean): ZorroRoute {
  if (hasImage) return 'photo';
  const t = q.toLocaleLowerCase('tr-TR');
  if (isSimpleGreeting(q)) return 'simple_chat';
  if (/mod:\s*öğren|ders anlat/.test(t)) return 'tutor';
  if (/mod:\s*soru/.test(t)) return 'question_solving';
  if (/mod:\s*tekrar|hızlı tekrar|konu tekrar/.test(t)) return 'review';
  if (/mod:\s*plan|bugün ne çalış|40\s*dk plan|çalışma planı/.test(t)) return 'plan';
  if (/mod:\s*deneme|deneme analiz/.test(t)) return 'exam_analysis';
  if (/yanlışlarım|işaretli yanlış|hata tür/.test(t)) return 'performance';
  if (/yorgun|motiv|ertele|çalışamıyorum/.test(t)) return 'simple_chat';
  if (/performansım|eksiklerim|matematikte (neden )?kötü|neyim eksik/.test(t)) return 'performance';
  if (/görevlerim|ödev \+|ödevimi|göreve aktar/.test(t)) return 'task';
  if (/koçum kim|koçum|randevum/.test(t)) return 'coach_context';
  if (/hedefim/.test(t)) return 'goal';
  if (/(bana .*(soru) ver|mini test|quiz|bir tane .*soru)/.test(t)) return 'quiz';
  if (/(sadece cevap|direkt çöz|bu soruyu|adım adım çöz|şıkk[ıi])/.test(t) || /=\s*\d/.test(t)) return 'question_solving';
  if (/(anlat|öğret|nedir|ne demek|konuyu)\b/.test(t) && !/kaç gün|program|plan/.test(t)) return 'tutor';
  if (/kaç gün kald|sınava kaç/.test(t)) return 'exam';
  if (/programım|ders program|yarın ne çalış|kaç saat çalış/.test(t)) return 'planner';
  if (/son net|denemem|netim kaç|netti/.test(t)) return 'exam_analysis';
  if (/ne çalışmalıyım|bugün ne çalış|plan yap/.test(t)) return 'plan';
  if (/hedef sıra|bölümüm/.test(t)) return 'goal';
  if (t.length > 24) return 'tutor';
  return 'simple_chat';
}

export function routeToTutorIntent(route: ZorroRoute): TutorIntent {
  if (route === 'tutor') return 'teach';
  if (route === 'question_solving' || route === 'photo') return 'solve';
  if (route === 'review') return 'review';
  if (route === 'quiz') return 'quiz';
  if (route === 'exam_analysis' || route === 'performance') return 'analysis';
  if (route === 'plan' || route === 'planner' || route === 'task') return 'schedule';
  if (route === 'goal') return 'goal';
  if (route === 'exam') return 'exam';
  return 'chat';
}

export function historyLimit(route: ZorroRoute) {
  if (route === 'simple_chat') return 2;
  if (route === 'photo' || route === 'question_solving') return 4;
  return 6;
}
