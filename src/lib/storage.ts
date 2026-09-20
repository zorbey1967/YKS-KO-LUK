import type { AppData, Topic } from './types';
import { emptyData } from './types';

export function storageKey(userId?: string | null) {
  return userId ? `yks_v7_${userId}` : 'yks_v7_guest';
}

export function normalizeData(raw: unknown): AppData {
  const d = emptyData();
  if (!raw || typeof raw !== 'object') return d;
  const x = raw as Partial<AppData>;
  d.dept = x.dept == null ? d.dept : String(x.dept);
  d.rank = x.rank === undefined || x.rank === null || Number.isNaN(Number(x.rank)) ? d.rank : Math.max(0, Number(x.rank));
  d.weekHours = Number(x.weekHours) > 0 ? Number(x.weekHours) : d.weekHours;
  d.track = x.track == null ? d.track : String(x.track);
  d.grade = x.grade == null ? d.grade : String(x.grade);
  d.age = Number(x.age) > 0 ? Number(x.age) : 0;
  d.examDate = x.examDate == null ? d.examDate : String(x.examDate);
  d.tasks = Array.isArray(x.tasks) ? x.tasks.filter((t) => t && t.title) : [];
  d.exams = Array.isArray(x.exams) ? x.exams.filter((e) => e && e.date) : [];
  d.topics = Array.isArray(x.topics) ? x.topics.filter((t) => t && t.name) : [];
  d.questions = Array.isArray(x.questions) ? x.questions.filter(Boolean) : [];
  d.sessions = Array.isArray(x.sessions) ? x.sessions.filter((s) => s && s.date) : [];
  d.plan = Array.isArray(x.plan) ? x.plan.filter(Boolean) : [];
  d.planDate = x.planDate;
  d.calcs = Array.isArray(x.calcs) ? x.calcs.filter(Boolean) : [];
  const sch = x.schedule;
  d.schedule = {
    days: Array.isArray(sch?.days) ? sch.days : [],
    source: String(sch?.source || ''),
    pdfName: String(sch?.pdfName || ''),
    pdfSize: Number(sch?.pdfSize) || 0,
    notes: String(sch?.notes || ''),
    updatedAt: String(sch?.updatedAt || ''),
  };
  d.qb = x.qb && typeof x.qb === 'object' ? x.qb : {};
  d.questionStats = x.questionStats && typeof x.questionStats === 'object' ? x.questionStats : {};
  d.qbMarks = Array.isArray(x.qbMarks) ? [...new Set(x.qbMarks.map(String))] : [];
  return d;
}

export function loadData(userId?: string | null): AppData {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return normalizeData(JSON.parse(raw));
    const legacy = localStorage.getItem(userId ? `yks_v6_${userId}` : 'yks_v6_guest');
    if (legacy) return normalizeData(JSON.parse(legacy));
  } catch {
    /* ignore */
  }
  return emptyData();
}

export function saveData(data: AppData, userId?: string | null) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(data));
  } catch (e) {
    console.warn('Yerel kayıt yazılamadı', e);
  }
}

export const SAMPLE_TOPICS: Omit<Topic, 'id'>[] = [
  { name: 'Fonksiyonlar', subject: 'Matematik', level: 80 },
  { name: 'Polinomlar', subject: 'Matematik', level: 65 },
  { name: 'Türev', subject: 'Matematik', level: 45 },
  { name: 'İntegral', subject: 'Matematik', level: 35 },
  { name: 'Divan Edebiyatı', subject: 'Edebiyat', level: 70 },
  { name: 'Cumhuriyet Dönemi', subject: 'Edebiyat', level: 50 },
  { name: 'TYT Problemler', subject: 'Matematik', level: 55 },
  { name: 'Harita Bilgisi', subject: 'Coğrafya', level: 40 },
  { name: 'İnkılap Tarihi', subject: 'Tarih', level: 75 },
];
