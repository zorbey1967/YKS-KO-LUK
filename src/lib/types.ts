export type PageId = 'home' | 'questionbank' | 'goal' | 'schedule' | 'tasks' | 'plan' | 'exams' | 'calculator' | 'topics' | 'questions' | 'calendar' | 'timer' | 'analytics' | 'membership' | 'account' | 'settings';

export type Task = {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  priority: string;
  done: boolean;
  date: string;
};

export type Exam = {
  id: string;
  name: string;
  date: string;
  tyt: number;
  ayt: number;
  note: string;
};

export type Topic = {
  id: string;
  name: string;
  subject: string;
  level: number;
  grade?: string;
};

export type ScheduleBlock = { title: string; minutes: number; icon: string };
export type ScheduleDay = { day: string; blocks: ScheduleBlock[] };
export type Schedule = {
  days: ScheduleDay[];
  source: string;
  pdfName: string;
  pdfSize?: number;
  notes: string;
  updatedAt: string;
};

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
  tasks: Task[];
  exams: Exam[];
  topics: Topic[];
  questions: QuestionSet[];
  sessions: Session[];
  plan: PlanBlock[];
  planDate?: string;
  calcs: CalcRecord[];
  schedule: Schedule;
  qb: Record<string, TopicProgress>;
  questionStats: Record<string, QuestionStat>;
  qbMarks: string[];
};

export type BankQuestion = {
  id: string;
  q: string;
  o: string[];
  a: number;
  e: string;
  difficulty?: string;
  _bankKey?: string;
};

export type BankManifest = {
  version: number;
  generatedAt: string;
  questionCount: number;
  levels: { name: string; slug: string; subjects: number; topics: number }[];
  curriculum: Record<string, Record<string, string[]>>;
};

export type Profile = {
  id?: string;
  name: string;
  email: string;
  plan: string;
  target_department?: string;
  target_rank?: number;
};

export const emptyData = (): AppData => ({
  dept: 'Hukuk',
  rank: 5000,
  weekHours: 10,
  track: 'Eşit Ağırlık',
  grade: '12. Sınıf',
  age: 17,
  examDate: '2027-06-19',
  tasks: [],
  exams: [],
  topics: [],
  questions: [],
  sessions: [],
  plan: [],
  calcs: [],
  schedule: { days: [], source: '', pdfName: '', pdfSize: 0, notes: '', updatedAt: '' },
  qb: {},
  questionStats: {},
  qbMarks: [],
});

export const NAV: { id: PageId; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: 'Ana Sayfa' },
  { id: 'questionbank', icon: '🧠', label: 'Soru Bankası' },
  { id: 'goal', icon: '🎯', label: 'Hedefim' },
  { id: 'schedule', icon: '🗓️', label: 'Ders Programım' },
  { id: 'tasks', icon: '✅', label: 'Görevler' },
  { id: 'plan', icon: '🤖', label: 'Akıllı Plan' },
  { id: 'exams', icon: '📝', label: 'Denemeler' },
  { id: 'calculator', icon: '🧮', label: 'Net Hesapla' },
  { id: 'topics', icon: '📚', label: 'Konular' },
  { id: 'questions', icon: '❓', label: 'Sorular' },
  { id: 'calendar', icon: '📅', label: 'Takvim' },
  { id: 'timer', icon: '⏱', label: 'Çalışma Saati' },
  { id: 'analytics', icon: '📊', label: 'Analiz' },
  { id: 'membership', icon: '💎', label: 'Üyelik' },
  { id: 'account', icon: '👤', label: 'Hesabım' },
  { id: 'settings', icon: '⚙', label: 'Ayarlar' },
];
