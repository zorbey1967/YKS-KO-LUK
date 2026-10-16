import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import { QUESTION_BANK_ENABLED } from './features';
import { curriculumForGrade } from './curriculum';
import { draftFromUnknown } from './examPhoto';
import { studentStateLines } from './studentProgress';
import {
  acceptPlanChange,
  appendLibrarySession,
  buildCapacity,
  buildStudentState,
  buildSubjectCards,
  buildTodayFocus,
  classifyExamKind,
  getStudentProgress,
  examPrepPlan,
  generateLivingPlan,
  inferredLevel,
  invalidateStudentProgress,
  levelFromStatus,
  liveLibraryMinutes,
  planChangeProposal,
  prioritizeSubjects,
  progressFingerprint,
  scheduleConflicts,
  setTopicProgress,
  statusFromLevel,
  writtenExamFeedback,
} from './studentProgress';
import { buildAnalyticsBoard } from './studentAnalytics';
import { istanbulDateKey } from './countdown';
import { LIBRARY_EMOJIS, emptyLibraryPrefs, pickLibraryEmoji } from './libraryPresence';

function base() {
  const d = emptyData();
  d.grade = '12. Sınıf';
  d.track = 'Eşit Ağırlık';
  d.dept = 'Hukuk';
  d.rank = 5000;
  return d;
}

describe('sınıf müfredatı ve konu durumu', () => {
  it('12. sınıf müfredatında matematik ve edebiyat vardır', () => {
    const curr = curriculumForGrade('12. Sınıf');
    expect(Object.keys(curr).some((s) => /matematik/i.test(s))).toBe(true);
    expect(Object.keys(curr).length).toBeGreaterThan(4);
  });

  it('EA alanında matematik/edebiyat öncelikli sıralanır', () => {
    const ordered = prioritizeSubjects(['Felsefe', 'Matematik', 'Biyoloji', 'Tarih'], 'Eşit Ağırlık');
    expect(ordered[0]).toBe('Matematik');
  });

  it('konu durumları yüzdeye map edilir', () => {
    expect(statusFromLevel(0)).toBe('not_started');
    expect(statusFromLevel(60)).toBe('in_progress');
    expect(statusFromLevel(100)).toBe('done');
    expect(levelFromStatus('done')).toBe(100);
    expect(levelFromStatus('in_progress', 60)).toBe(60);
  });

  it('ders kartı tamamlandı/devam/başlanmadı sayar', () => {
    let d = base();
    d = setTopicProgress(d, 'Matematik', 'Fonksiyonlar', 'done');
    const mathName = buildSubjectCards(d).find((c) => /matematik/i.test(c.subject))?.subject || 'Matematik';
    d = setTopicProgress(d, mathName, (curriculumForGrade(d.grade)[mathName] || ['Fonksiyonlar'])[0], 'done');
    const card = buildSubjectCards(d).find((c) => c.subject === mathName)!;
    expect(card.done).toBeGreaterThanOrEqual(1);
    expect(card.progress).toBeGreaterThan(0);
    expect(card.notStarted + card.inProgress + card.done).toBe(card.topics.length);
  });
});

describe('çalışma ve kütüphane süresi', () => {
  it('timer ve kütüphane dakikalarını ayırır', () => {
    const d = base();
    d.sessions = [
      { id: 'a', date: '2026-10-16', minutes: 72, seconds: 0, subject: 'Matematik', createdAt: '2026-10-16T10:00:00.000Z' },
      { id: 'b', date: '2026-10-16', minutes: 100, seconds: 0, subject: 'Sessiz Kütüphane', kind: 'library', createdAt: '2026-10-16T12:00:00.000Z' },
    ];
    const cap = buildCapacity(d, 0);
    expect(cap.todayTimer).toBe(72);
    expect(cap.todayLibrary).toBe(100);
    expect(cap.todayTotal).toBe(172);
    expect(cap.weekLibrary).toBeGreaterThanOrEqual(100);
  });

  it('kütüphane ayrılınca oturum yazar', () => {
    const start = new Date('2026-10-16T10:00:00.000Z').toISOString();
    const end = Date.parse('2026-10-16T11:40:00.000Z');
    const next = appendLibrarySession(base(), start, end);
    expect(next.sessions[0].kind).toBe('library');
    expect(next.sessions[0].minutes).toBe(100);
  });
});

describe('deneme fotoğrafı ve analiz verisi', () => {
  it('AI JSON taslağını onaylanacak draft’a çevirir', () => {
    const draft = draftFromUnknown('Sonuç: ```json{"tyt":88.5,"ayt":42,"subjects":[{"name":"Türkçe","net":32}]}```', 'Deneme');
    expect(draft?.tyt).toBe(88.5);
    expect(draft?.subjects[0].name).toBe('Türkçe');
    expect(draftFromUnknown('{"tyt":10,"correct":40,"wrong":8,"blank":2}', 'x')?.correct).toBe(40);
  });

  it('uydurma boş JSON’u reddeder', () => {
    expect(draftFromUnknown('{"hello":1}', 'x')).toBeNull();
  });
});

describe('Akıllı Plan birleşimi', () => {
  it('Hesabım sınıf/alan/hedefi duruma yazar; yaş sormaz', () => {
    const s = buildStudentState(base());
    expect(s.grade).toBe('12. Sınıf');
    expect(s.track).toBe('Eşit Ağırlık');
    expect(s.dept).toBe('Hukuk');
    expect(studentStateLines(base()).join(' ')).not.toMatch(/yaşın kaç/i);
  });

  it('çalışma oturumundan konu ilerlemesi çıkarır', () => {
    const d = base();
    d.sessions = [{ id: 's', date: '2026-10-01', minutes: 70, seconds: 0, subject: 'Matematik', topic: 'Polinomlar', createdAt: '2026-10-01T10:00:00Z' }];
    const inf = inferredLevel(d, 'Matematik', 'Polinomlar');
    expect(inf.level).toBeGreaterThanOrEqual(40);
    expect(inf.minutes).toBe(70);
  });

  it('Ders Programı varken çakışmayan plan üretir', () => {
    const d = base();
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    d.schedule = {
      days: days.map((day) => ({ day, blocks: [{ title: 'Matematik', minutes: 45, icon: '➗' }] })),
      source: 'manual',
      pdfName: '',
      pdfSize: 0,
      notes: '',
      updatedAt: '',
    };
    const plan = generateLivingPlan(d, 600);
    expect(plan.some((p) => /Matematik/.test(p.text))).toBe(true);
    expect(scheduleConflicts(plan, d)).toEqual([]);
  });

  it('tipik 3-4 saat çalışan öğrenciye 10 saatlik plan basmaz', () => {
    const d = base();
    d.sessions = [3, 2, 1].map((n, i) => ({
      id: String(i),
      date: new Date(Date.now() - n * 86400000).toISOString().slice(0, 10),
      minutes: 180 + i * 20,
      seconds: 0,
      subject: 'Mat',
      createdAt: '',
    }));
    const plan = generateLivingPlan(d, 600);
    expect(plan.reduce((a, b) => a + b.minutes, 0)).toBeLessThanOrEqual(Math.round(buildCapacity(d).typicalDayMinutes * 1.2) + 5);
  });

  it('net düşüşünde program değişikliği onayı ister; accept planı yazar', () => {
    const d = base();
    d.calcs = [
      { id: 1, date: '2026-09-01', type: 'TYT', correct: 80, wrong: 10, blank: 10, net: 70, subjects: [{ subject: 'Matematik', max: 40, correct: 30, wrong: 4, blank: 6, net: 29 }] },
      { id: 2, date: '2026-10-01', type: 'TYT', correct: 70, wrong: 20, blank: 10, net: 60, subjects: [{ subject: 'Matematik', max: 40, correct: 18, wrong: 12, blank: 10, net: 15 }] },
    ];
    const prop = planChangeProposal(d);
    expect(prop.needed).toBe(true);
    expect(prop.reason).toMatch(/Program değişikliği gerekli|Matematik/i);
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    d.schedule = {
      days: days.map((day) => ({ day, blocks: [{ title: 'Matematik', minutes: 40, icon: '➗' }] })),
      source: 'manual', pdfName: '', pdfSize: 0, notes: '', updatedAt: '',
    };
    const next = acceptPlanChange(d);
    expect(next.plan.length).toBeGreaterThan(0);
    expect(next.planDate).toBeTruthy();
    expect(next.schedule.days[0].blocks[0].minutes).toBe(55);
  });

  it('deneme yazısı veri yokken uydurmaz', () => {
    const empty = writtenExamFeedback(base());
    expect(empty.ready).toBe(false);
    expect(empty.text).toMatch(/en az 2 deneme/);
    expect(classifyExamKind('Cuma Matematik Yazılısı', 'okul')).toBe('yazili');
  });

  it('bugün önerisi devam eden konuyu gerekçeyle verir', () => {
    let d = setTopicProgress(base(), 'Matematik', 'Limit ve Süreklilik', 'in_progress', 60);
    const focus = buildTodayFocus(d);
    expect(focus.length).toBeGreaterThan(0);
    expect(focus.some((x) => /Limit|Matematik|Tekrar/.test(`${x.subject} ${x.topic} ${x.reason}`))).toBe(true);
  });

  it('yaklaşan yazılı için sınav hazırlık planı üretir', () => {
    const d = base();
    const exam = {
      id: 'x1',
      title: 'Matematik Yazılısı',
      kind: 'Yazılı',
      subject: 'Matematik',
      date: '2026-10-22',
      startTime: '09:00',
      endTime: '10:00',
      durationMin: 60,
      note: '',
      priority: 'yuksek' as const,
      isPrimary: false,
      notify: false,
      createdAt: '',
      updatedAt: '',
    };
    d.examTargets = [exam];
    const prep = examPrepPlan(d, exam);
    expect(prep.title).toMatch(/Matematik/);
    expect(prep.days.length).toBeGreaterThan(0);
    expect(prep.days.length).toBeLessThanOrEqual(5);
    expect(prep.kind).toBe('yazili');
    expect(prep.period).toMatch(/dönem/i);
  });

  it('AI içgörüsü ve koç görevi duruma eklenir', () => {
    const d = base();
    d.exams = [
      { id: 'e1', name: 'D1', date: '2026-09-01', tyt: 18, ayt: 12, note: '' },
      { id: 'e2', name: 'D2', date: '2026-10-01', tyt: 22, ayt: 10, note: '' },
    ];
    d.tasks = [{ id: 't1', title: '20 soru Problemler çöz', subject: 'Matematik', minutes: 40, priority: 'Normal', done: false, date: '2026-10-16', origin: 'coach' }];
    const s = buildStudentState(d);
    expect(s.coachTasks[0]).toMatch(/Problemler/);
    expect(s.lastExam?.delta).toBe(4);
  });

  it('ZORRO satırları Akıllı Plan ile aynı sınıf/hedefi kullanır', () => {
    const lines = studentStateLines(base()).join('\n');
    expect(lines).toContain('12. Sınıf');
    expect(lines).toContain('Hukuk');
    expect(lines).toContain('onay iste');
  });
});

describe('erişim ve feature flag', () => {
  it('QUESTION_BANK_ENABLED kapalı kalır', () => {
    expect(QUESTION_BANK_ENABLED).toBe(false);
  });

  it('getStudentProgress aynı parmak izinde cache döner', () => {
    const d = base();
    const a = getStudentProgress(d);
    const b = getStudentProgress(d);
    expect(a).toBe(b);
    d.exams = [{ id: 'e1', name: 'D', date: '2026-10-01', tyt: 20, ayt: 10, note: '', subjects: [{ name: 'Edebiyat', net: 8 }] }];
    const c = getStudentProgress(d);
    expect(c).not.toBe(a);
    expect(c.lastExam?.tyt).toBe(20);
  });

  it('öğrenci durumu yalnızca verilen AppData’dan üretilir (başka kullanıcı yok)', () => {
    const a = buildStudentState(base());
    const other = emptyData();
    other.grade = '9. Sınıf';
    expect(buildStudentState(other).grade).not.toBe(a.grade);
  });

  it('konu tamamlandı ve devam ediyor StudentProgress’e yazılır', () => {
    let d = setTopicProgress(base(), 'Matematik', 'Türev', 'in_progress', 60);
    let t = buildSubjectCards(d).find((c) => c.subject === 'Matematik')?.topics.find((x) => x.name === 'Türev');
    expect(t?.status).toBe('in_progress');
    expect(t?.level).toBe(60);
    d = setTopicProgress(d, 'Matematik', 'Türev', 'done');
    t = buildSubjectCards(d).find((c) => c.subject === 'Matematik')?.topics.find((x) => x.name === 'Türev');
    expect(t?.status).toBe('done');
    expect(getStudentProgress(d).gaps.every((g) => g.name !== 'Türev')).toBe(true);
  });

  it('deneme ekleme ve D/Y/B-ders neti StudentProgress ile Analiz’i günceller', () => {
    const d = base();
    d.exams = [{
      id: 'e1', name: 'TYT-1', date: '2026-10-01', tyt: 25, ayt: 10, note: '',
      correct: 80, wrong: 10, blank: 10,
      subjects: [{ name: 'Matematik', net: 25, correct: 30, wrong: 5, blank: 5 }],
    }];
    const s = getStudentProgress(d);
    expect(s.lastExam?.tyt).toBe(25);
    expect(s.lastExam?.correct).toBe(80);
    expect(s.lastExam?.subjects[0].net).toBe(25);
    d.exams[0] = { ...d.exams[0], correct: 70, wrong: 20, tyt: 22, subjects: [{ name: 'Matematik', net: 18 }] };
    invalidateStudentProgress();
    const next = getStudentProgress(d);
    expect(next.lastExam?.tyt).toBe(22);
    expect(next.lastExam?.correct).toBe(70);
    expect(next.lastExam?.subjects[0].net).toBe(18);
    const board = buildAnalyticsBoard(d);
    expect(board.subjects.find((x) => x.name === 'Matematik')?.last).toBe(18);
    expect(board.examRows[0].correct).toBe(70);
  });

  it('timer ve kütüphane süreleri plana kapasite olarak gider; çift sayılmaz', () => {
    const d = base();
    const day = istanbulDateKey();
    d.sessions = [
      { id: 't', date: day, minutes: 105, seconds: 0, subject: 'Matematik', topic: 'Türev', createdAt: '' },
      { id: 'l', date: day, minutes: 80, seconds: 0, subject: 'Sessiz Kütüphane', kind: 'library', createdAt: '' },
    ];
    const cap = buildCapacity(d, 0);
    expect(cap.todayTimer).toBe(105);
    expect(cap.todayLibrary).toBe(80);
    expect(cap.todayTotal).toBe(185);
    expect(buildStudentState(d).todayTopics.some((t) => /Türev/.test(t))).toBe(true);
    const planMins = generateLivingPlan(d).reduce((a, b) => a + b.minutes, 0);
    expect(planMins).toBeLessThanOrEqual(Math.round(cap.typicalDayMinutes * 1.2) + 5);
  });

  it('kütüphane katılınca süre başlar, ayrılınca durur; emoji kalıcıdır', () => {
    const d = base();
    d.libraryPrefs = { ...emptyLibraryPrefs(), joinedRoomId: 'r1', joinedAt: new Date(Date.now() - 42 * 60000).toISOString(), emoji: '🦊', nameMode: 'alias' };
    expect(liveLibraryMinutes(d)).toBeGreaterThanOrEqual(41);
    expect(LIBRARY_EMOJIS).toContain('🦊');
    expect(pickLibraryEmoji('u1', '🦊')).toBe('🦊');
    const left = appendLibrarySession({ ...d, libraryPrefs: emptyLibraryPrefs() }, d.libraryPrefs.joinedAt);
    expect(left.sessions[0].kind).toBe('library');
    expect(left.sessions[0].minutes).toBeGreaterThanOrEqual(41);
  });

  it('cache invalidate ve konu bitince plan önceliği değişir', () => {
    let d = setTopicProgress(base(), 'Matematik', 'Türev', 'in_progress', 40);
    d = setTopicProgress(d, 'Matematik', 'İntegral', 'not_started');
    const a = getStudentProgress(d);
    const fp = progressFingerprint(d);
    expect(progressFingerprint(d)).toBe(fp);
    d = setTopicProgress(d, 'Matematik', 'Türev', 'done');
    invalidateStudentProgress();
    const b = getStudentProgress(d);
    expect(b).not.toBe(a);
    const texts = generateLivingPlan(d).map((p) => p.text).join(' ');
    expect(texts).not.toMatch(/Türev/);
  });

  it('öğrenci programı ile koç programı ayrı tutulur', () => {
    const d = base();
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    d.schedule = {
      days: days.map((day) => ({ day, blocks: [{ title: 'Türkçe', minutes: 40, icon: '📖' }] })),
      source: 'self', pdfName: '', pdfSize: 0, notes: '', updatedAt: '1',
    };
    d.coachSchedule = {
      days: days.map((day) => ({ day, blocks: [{ title: 'Matematik', minutes: 50, icon: '➗' }] })),
      source: 'coach', pdfName: '', pdfSize: 0, notes: '', updatedAt: '2',
    };
    const s = buildStudentState(d);
    expect(s.scheduleToday.some((b) => b.title === 'Türkçe')).toBe(true);
    expect(s.coachToday.some((b) => b.title === 'Matematik')).toBe(true);
    const living = generateLivingPlan(d).map((p) => p.text).join(' ');
    expect(living).toMatch(/Türkçe/);
    expect(s.capacity.weekTimer).toBeGreaterThanOrEqual(0);
    expect(s.capacity.monthTotal).toBeGreaterThanOrEqual(s.capacity.weekMinutes);
    expect(s.activity.length).toBeGreaterThanOrEqual(0);
  });

  it('yeni deneme sonrası plan zayıf derse kayabilir', () => {
    const d = base();
    d.exams = [
      { id: 'a', name: '1', date: '2026-09-01', tyt: 40, ayt: 20, note: '', subjects: [{ name: 'Matematik', net: 25 }, { name: 'Tarih', net: 8 }] },
      { id: 'b', name: '2', date: '2026-10-01', tyt: 38, ayt: 18, note: '', subjects: [{ name: 'Matematik', net: 31 }, { name: 'Tarih', net: 3 }] },
    ];
    const prop = planChangeProposal(d);
    expect(prop.needed).toBe(true);
    expect(prop.subject).toMatch(/Tarih/i);
    const board = buildAnalyticsBoard(d);
    expect(board.subjects.find((s) => s.name === 'Matematik')?.trend).toBe('up');
    expect(board.subjects.find((s) => s.name === 'Tarih')?.trend).toBe('down');
  });
});
