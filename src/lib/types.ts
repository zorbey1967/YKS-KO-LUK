import { isNavPageVisible } from './features';

export type PageId = 'home' | 'questionbank' | 'coaches' | 'meetings' | 'library' | 'goal' | 'schedule' | 'tasks' | 'plan' | 'exams' | 'calculator' | 'topics' | 'questions' | 'calendar' | 'timer' | 'analytics' | 'membership' | 'account' | 'settings' | 'admin' | 'meeting';

export type TaskOrigin = 'student' | 'zorro' | 'coach';

export type Task = {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  priority: string;
  done: boolean;
  date: string;
  origin?: TaskOrigin;
  updatedAt?: string;
  homeworkId?: string;
};

export type Tombstone = {
  /** examTarget: Takvim / Sınav Merkezi kaydı (exam: deneme sonucu). */
  kind: 'session' | 'task' | 'mistake' | 'review' | 'exam' | 'examTarget';
  id: string;
  at: string;
};

export type LibraryPrefs = {
  nameMode: 'real' | 'alias' | null;
  joinedRoomId: string | null;
  joinedAt: string | null;
  emoji: string | null;
};

export type SupportPrefs = {
  nameConsent: 'yes' | 'no' | null;
};

export type LearningNote = {
  topic: string;
  subject: string;
  errorKind?: string;
  note: string;
  at: string;
};

export type ExamSubjectNet = {
  name: string;
  net: number;
  correct?: number;
  wrong?: number;
  blank?: number;
};

export type Exam = {
  id: string;
  name: string;
  date: string;
  tyt: number;
  ayt: number;
  note: string;
  correct?: number;
  wrong?: number;
  blank?: number;
  subjects?: ExamSubjectNet[];
  /** Bağlı sınav hedefi (Sınav Merkezi). */
  targetId?: string;
  kind?: string;
};

export type ExamPriority = 'dusuk' | 'normal' | 'yuksek';

export type ExamOrigin = 'official' | 'user';

export type ExamTarget = {
  id: string;
  title: string;
  kind: string;
  subject?: string;
  origin?: ExamOrigin;
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  note: string;
  /** Sınavda çıkacak konular (isteğe bağlı; eski kayıtlarda yok). */
  topics?: string[];
  priority: ExamPriority;
  isPrimary: boolean;
  notify: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExamNotifyPrefs = {
  exams: boolean;
  ai: boolean;
  tasks: boolean;
};

export type ExamPlanStage = { title: string; body: string };

export type ExamPlanRecord = {
  examId: string;
  examDate: string;
  summary: string;
  weekHint: string;
  advice: string;
  stages: ExamPlanStage[];
  lastWeek: string;
  source: 'ai' | 'local';
  model?: string;
  createdAt: string;
  pendingSchedule?: Schedule | null;
};

export type Topic = {
  id: string;
  name: string;
  subject: string;
  level: number;
  grade?: string;
};

export type ScheduleBlock = { title: string; minutes: number; icon: string; start?: string; topic?: string; note?: string };
export type ScheduleDay = { day: string; blocks: ScheduleBlock[] };
export type Schedule = {
  days: ScheduleDay[];
  source: string;
  pdfName: string;
  pdfSize?: number;
  notes: string;
  updatedAt: string;
};

export function emptySchedule(): Schedule {
  return { days: [], source: '', pdfName: '', pdfSize: 0, notes: '', updatedAt: '' };
}

export type CalcSubject = {
  subject: string;
  max: number;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
};

export type QuestionSet = {
  date: string;
  subject: string;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
};

export type Session = {
  id: string;
  date: string;
  minutes: number;
  seconds: number;
  subject: string;
  createdAt: string;
  kind?: string;
  plannedMinutes?: number;
  topic?: string;
  startedAt?: string;
  endedAt?: string;
  asked?: number;
  correctCount?: number;
  difficulty?: 'kolay' | 'orta' | 'zor';
  source?: string;
  taskId?: string;
};

export type MistakeReason = 'bilgi' | 'islem' | 'sure' | 'dikkatsizlik';

export type MistakeEntry = {
  id: string;
  questionId: string;
  subject: string;
  topic: string;
  level?: string;
  reason?: MistakeReason | '';
  wrongCount: number;
  lastWrongAt: string;
  lastCorrectAt?: string;
  status: 'open' | 'reviewing' | 'resolved';
};

export type ReviewStatus = 'due' | 'waiting' | 'done' | 'snoozed';

export type ReviewItem = {
  id: string;
  kind: 'mistake' | 'topic';
  questionId?: string;
  subject: string;
  topic: string;
  level?: string;
  intervalIndex: number;
  dueDate: string;
  status: ReviewStatus;
  snoozeUntil?: string;
  lastResult?: 'correct' | 'wrong';
  completedOnce?: boolean;
};

export type PlanBlock = {
  text: string;
  minutes: number;
  icon: string;
};

export type CalcRecord = {
  id: number;
  date: string;
  type: string;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  subjects?: CalcSubject[];
};

export type QuestionStat = {
  attempts: number;
  correct: number;
  wrong: number;
  lastAnswer: number | null;
  lastSeen: string | null;
};

export type TopicProgress = {
  key: string;
  answered: number;
  correct: number;
  wrong: number;
  index: number;
  completed: boolean;
  answeredIds: string[];
  updatedAt: string;
};

export type AppData = {
  dept: string;
  rank: number;
  weekHours: number;
  track: string;
  grade: string;
  age: number;
  examDate: string;
  examTargets: ExamTarget[];
  examNotifyPrefs: ExamNotifyPrefs;
  examNotifyLog: Record<string, string>;
  examPlan: ExamPlanRecord | null;
  examPlanDraft: ExamPlanRecord | null;
  tasks: Task[];
  exams: Exam[];
  topics: Topic[];
  questions: QuestionSet[];
  sessions: Session[];
  plan: PlanBlock[];
  planDate?: string;
  calcs: CalcRecord[];
  schedule: Schedule;
  coachSchedule: Schedule;
  qb: Record<string, TopicProgress>;
  questionStats: Record<string, QuestionStat>;
  qbMarks: string[];
  learningNotes: LearningNote[];
  mistakes: MistakeEntry[];
  reviews: ReviewItem[];
  tombstones: Tombstone[];
  syncRev: number;
  libraryPrefs: LibraryPrefs;
  supportPrefs: SupportPrefs;
  meetingAiConsent: boolean;
};

export type BankQuestion = {
  id: string;
  q: string;
  o: string[];
  a: number;
  e: string;
  difficulty?: string;
  /** `osym` üretim/sınıflama etiketidir; doğrulanmış ÖSYM maddesi anlamına gelmez. */
  kind?: string;
  _bankKey?: string;
};

export type BankManifest = {
  version: number;
  generatedAt: string;
  questionCount: number;
  levels: { name: string; slug: string; subjects: number; topics: number }[];
  curriculum: Record<string, Record<string, string[]>>;
  topicCounts?: Record<string, number>;
};

export type ProfileRole = 'student' | 'coach' | 'admin';
export type AccountStatus = 'active' | 'pasif' | 'pending' | 'rejected';
export type SignupIntent = 'student' | 'coach';

export type Profile = {
  id?: string;
  name: string;
  email: string;
  plan: string;
  role?: ProfileRole;
  account_status?: AccountStatus;
  signup_intent?: SignupIntent;
  signup_grade?: string;
  signup_track?: string;
  signup_exam?: string;
  coach_status?: 'pending' | 'active' | 'rejected' | 'pasif';
  target_department?: string;
  target_rank?: number;
  score?: number;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
  subscription_started_at?: string | null;
  subscription_ends_at?: string | null;
};

export const UNSET_LABEL = 'belirtilmedi';

export function displayText(value: string | null | undefined) {
  const s = String(value || '').trim();
  return s || UNSET_LABEL;
}

export function displayAge(age: number) {
  return age > 0 ? `${age} yaş` : UNSET_LABEL;
}

export function displayRank(rank: number) {
  return rank > 0 ? rank.toLocaleString('tr-TR') : UNSET_LABEL;
}

export const emptyData = (): AppData => ({
  dept: '',
  rank: 0,
  weekHours: 0,
  track: '',
  grade: '',
  age: 0,
  examDate: '',
  examTargets: [],
  examNotifyPrefs: { exams: true, ai: false, tasks: false },
  examNotifyLog: {},
  examPlan: null,
  examPlanDraft: null,
  tasks: [],
  exams: [],
  topics: [],
  questions: [],
  sessions: [],
  plan: [],
  calcs: [],
  schedule: emptySchedule(),
  coachSchedule: emptySchedule(),
  qb: {},
  questionStats: {},
  qbMarks: [],
  learningNotes: [],
  mistakes: [],
  reviews: [],
  tombstones: [],
  syncRev: 0,
  libraryPrefs: { nameMode: null, joinedRoomId: null, joinedAt: null, emoji: null },
  supportPrefs: { nameConsent: null },
  meetingAiConsent: false,
});

export const NAV: { id: PageId; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: 'Ana Sayfa' },
  { id: 'coaches', icon: '🎓', label: 'Koçlar' },
  { id: 'meetings', icon: '📹', label: 'Görüşmelerim' },
  { id: 'library', icon: '📚', label: 'Sessiz Kütüphane' },
  { id: 'questionbank', icon: '🧠', label: 'Soru Bankası' },
  { id: 'analytics', icon: '📊', label: 'Analiz' },
  { id: 'schedule', icon: '🗓️', label: 'Ders Programı' },
  { id: 'calendar', icon: '📅', label: 'Takvim' },
  { id: 'tasks', icon: '✅', label: 'Görevler' },
  { id: 'goal', icon: '🎯', label: 'Hedefim' },
  { id: 'plan', icon: '🤖', label: 'Akıllı Plan' },
  { id: 'exams', icon: '📝', label: 'Denemeler' },
  { id: 'calculator', icon: '🧮', label: 'Net Hesapla' },
  { id: 'topics', icon: '📚', label: 'Konular' },
  { id: 'questions', icon: '❓', label: 'Sorular' },
  { id: 'timer', icon: '⏱', label: 'Çalışma Saati' },
  { id: 'membership', icon: '💎', label: 'Üyelik' },
  { id: 'account', icon: '👤', label: 'Hesabım' },
  { id: 'settings', icon: '⚙', label: 'Ayarlar' },
];

const STUDENT_NAV_IDS: PageId[] = [
  'home',
  'coaches',
  'meetings',
  'library',
  'questionbank',
  'analytics',
  'schedule',
  'calendar',
  'tasks',
  'goal',
  'plan',
  'exams',
  'calculator',
  'questions',
  'timer',
  'membership',
  'account',
];
const COACH_NAV_IDS: PageId[] = ['coaches', 'account', 'settings'];

function navItem(id: PageId, role?: Profile['role']) {
  const n = NAV.find((x) => x.id === id);
  if (!n) return null;
  if (id === 'coaches' && (role === 'coach' || role === 'admin')) return { ...n, label: 'Koçluk' };
  return n;
}

/** Kenar menü. */
export function sidebarNav(
  role: Profile['role'] | undefined,
  isAdmin: boolean,
  restrictedIds?: PageId[] | null,
) {
  const ids = isAdmin
    ? NAV.map((n) => n.id)
    : role === 'coach' || role === 'admin'
      ? COACH_NAV_IDS
      : STUDENT_NAV_IDS;
  let items = ids.map((id) => navItem(id, role)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (restrictedIds) {
    items = items.filter((x) => restrictedIds.includes(x.id));
    if (!items.some((x) => x.id === 'account')) {
      const acc = navItem('account', role);
      if (acc) items.push(acc);
    }
    if (!items.some((x) => x.id === 'coaches') && restrictedIds.includes('coaches')) {
      const c = navItem('coaches', role);
      if (c) items.unshift(c);
    }
    return items.filter((x) => isNavPageVisible(x.id));
  }
  if (isAdmin) {
    if (!items.some((x) => x.id === 'admin')) {
      const home = items[0] || NAV[0];
      const rest = items.filter((x) => x.id !== home.id);
      return [home, ADMIN_NAV, ...rest].filter((x) => isNavPageVisible(x.id));
    }
  }
  return items.filter((x) => isNavPageVisible(x.id));
}

/** Ctrl+K: kenar menüde olmayan çalışma sayfaları da (Konular, Sorular vb.) bulunur. */
export function commandNav(
  role: Profile['role'] | undefined,
  isAdmin: boolean,
  restrictedIds?: PageId[] | null,
) {
  if (restrictedIds) return sidebarNav(role, isAdmin, restrictedIds);
  if (isAdmin) return sidebarNav(role, true, null);
  if (role === 'coach' || role === 'admin') return sidebarNav(role, isAdmin, restrictedIds);
  return NAV.map((n) => navItem(n.id, role)).filter((x): x is NonNullable<typeof x> => x != null && isNavPageVisible(x.id));
}

/** Öğrenci menüsünde yok; hash ve yetkili menü için. */
export const ADMIN_NAV = { id: 'admin' as const, icon: '🛡', label: 'Yönetici' };

export const MEETING_NAV = { id: 'meeting' as const, icon: '📹', label: 'Görüşme' };

export function isKnownPage(id: string): id is PageId {
  return id === 'admin' || id === 'meeting' || id === 'meetings' || id === 'library' || NAV.some((n) => n.id === id);
}
