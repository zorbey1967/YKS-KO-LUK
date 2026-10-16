import { describe, expect, it } from 'vitest';
import { emptyData, type AppData, type Session, type Task } from './types';
import { lastWriteWinsReplace, mergeAppData, tombstone } from './syncMerge';
import { applyCoachHomeworks, appendGeneratedTasks, coachTasksUntouched, homeworkTaskId } from './coachPlan';
import { coachStudyBrief } from './coachBrief';

function session(partial: Partial<Session> & { id: string }): Session {
  return { date: '2026-10-12', minutes: 20, seconds: 1200, subject: 'Matematik', createdAt: '2026-10-12T10:00:00Z', ...partial };
}

function task(partial: Partial<Task> & { id: string }): Task {
  return { title: 'İş', subject: 'Türkçe', minutes: 20, priority: 'Normal', done: false, date: '2026-10-12', origin: 'student', ...partial };
}

describe('iki cihaz birleştirme', () => {
  it('son yazan kazanır diğer cihazın yeni oturumunu kaybeder', () => {
    const local: AppData = { ...emptyData(), sessions: [session({ id: 's_phone' })] };
    const cloud: AppData = { ...emptyData(), sessions: [session({ id: 's_laptop' })] };
    const lost = lastWriteWinsReplace(cloud, local);
    expect(lost.sessions.map((s) => s.id)).toEqual(['s_laptop']);
  });

  it('kimlik birleştirme her iki oturumu ve yanlışı korur', () => {
    const local: AppData = {
      ...emptyData(),
      sessions: [session({ id: 's_phone' })],
      mistakes: [{ id: 'q1', questionId: 'q1', subject: 'Fizik', topic: 'Hareket', wrongCount: 1, lastWrongAt: '2026-10-12T11:00:00Z', status: 'open' }],
    };
    const remote: AppData = {
      ...emptyData(),
      sessions: [session({ id: 's_laptop', subject: 'Kimya' })],
      mistakes: [{ id: 'q2', questionId: 'q2', subject: 'Kimya', topic: 'Gaz', wrongCount: 1, lastWrongAt: '2026-10-12T12:00:00Z', status: 'open' }],
    };
    const m = mergeAppData(local, remote);
    expect(m.sessions.map((s) => s.id).sort()).toEqual(['s_laptop', 's_phone']);
    expect(m.mistakes.map((x) => x.id).sort()).toEqual(['q1', 'q2']);
  });

  it('silinen oturumu geri getirmez', () => {
    const local = tombstone({ ...emptyData(), sessions: [] }, 'session', 's_old', '2026-10-12T15:00:00Z');
    const remote: AppData = { ...emptyData(), sessions: [session({ id: 's_old' })] };
    expect(mergeAppData(local, remote).sessions).toEqual([]);
  });

  it('tamamlanmış görevi eski kopyadan açık yapmaz', () => {
    const local: AppData = { ...emptyData(), tasks: [task({ id: 't1', done: true, updatedAt: '2026-10-12T18:00:00Z' })] };
    const remote: AppData = { ...emptyData(), tasks: [task({ id: 't1', done: false, updatedAt: '2026-10-12T10:00:00Z' })] };
    expect(mergeAppData(local, remote).tasks[0].done).toBe(true);
  });

  it('kayıp güncelleme: düşük rev skaler diğer cihazın hedefini ezmemeli', () => {
    const phone: AppData = { ...emptyData(), syncRev: 2, dept: 'Tıp', sessions: [session({ id: 's1' })] };
    const laptop: AppData = { ...emptyData(), syncRev: 1, dept: '', sessions: [session({ id: 's2' })] };
    const m = mergeAppData(laptop, phone);
    expect(m.dept).toBe('Tıp');
    expect(m.sessions).toHaveLength(2);
  });
});

describe('koç planı ve yetki modeli (istemci)', () => {
  it('aynı ödev id ikinci görev açmaz', () => {
    const hw = [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', studentId: 's', title: 'Paragraf', due: '2026-10-13', done: false }];
    const once = applyCoachHomeworks(emptyData(), hw);
    const twice = applyCoachHomeworks(once, hw);
    expect(twice.tasks.filter((t) => t.origin === 'coach')).toHaveLength(1);
    expect(twice.tasks[0].id).toBe(homeworkTaskId(hw[0].id));
  });

  it('ZORRO koç görevini değiştirmez', () => {
    const before = applyCoachHomeworks(emptyData(), [{ id: 'h1', studentId: 's', title: 'Koç işi', due: '2026-10-13', done: false }]);
    const after = appendGeneratedTasks(before, [{
      id: 'z1', title: 'AI blok', subject: 'ZORRO', minutes: 40, priority: 'Normal', done: false, date: '2026-10-12', origin: 'zorro',
    }]);
    expect(coachTasksUntouched(before, after)).toBe(true);
    expect(after.tasks.some((t) => t.origin === 'zorro')).toBe(true);
  });
});

describe('kütüphane birleştirme', () => {
  it('yerelde ayrılmış odayı buluttaki eski katılımla geri açmaz', () => {
    const local: AppData = {
      ...emptyData(),
      libraryPrefs: { nameMode: 'alias', joinedRoomId: null, joinedAt: null, emoji: '🦊' },
    };
    const remote: AppData = {
      ...emptyData(),
      libraryPrefs: { nameMode: 'alias', joinedRoomId: 'r1', joinedAt: '2026-10-16T10:00:00.000Z', emoji: '🦊' },
    };
    const m = mergeAppData(local, remote);
    expect(m.libraryPrefs.joinedRoomId).toBeNull();
    expect(m.libraryPrefs.joinedAt).toBeNull();
    expect(m.libraryPrefs.emoji).toBe('🦊');
  });
});

describe('koç özeti uydurmaz', () => {
  it('oturum yokken çalışmadı demez; süre null', () => {
    const b = coachStudyBrief(emptyData(), '2026-10-12');
    expect(b.empty).toBe(true);
    expect(b.todayMinutes).toBeNull();
    expect(b.weekMinutes).toBeNull();
    expect(b.agenda).toEqual([]);
  });

  it('kayıt varsa süre ve geciken görevi gösterir', () => {
    const d: AppData = {
      ...emptyData(),
      sessions: [session({ id: 's', minutes: 40, date: '2026-10-12' })],
      tasks: [task({ id: 't', title: 'Eski', date: '2026-10-01', done: false })],
    };
    const b = coachStudyBrief(d, '2026-10-12');
    expect(b.todayMinutes).toBe(40);
    expect(b.tasksOverdue).toBe(1);
    expect(b.agenda.some((x) => x.includes('Eski'))).toBe(true);
  });
});
