import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import { clearStudentSmartPlan, getStudentProgress, invalidateStudentProgress } from './studentProgress';

describe('clearStudentSmartPlan', () => {
  it('plan ve zorro görevlerini siler; koç ödevi ve coachSchedule kalır', () => {
    invalidateStudentProgress();
    const d = emptyData();
    d.plan = [{ text: 'Matematik', minutes: 40, icon: '📚' }];
    d.planDate = '2026-10-16';
    d.tasks = [
      { id: 'z1', title: 'Plan işi', subject: 'Plan', minutes: 40, priority: 'Normal', done: false, date: '2026-10-16', origin: 'zorro' },
      { id: 'c1', title: 'Koç ödevi', subject: 'Koç ödevi', minutes: 40, priority: 'Yüksek', done: false, date: '2026-10-16', origin: 'coach' },
      { id: 's1', title: 'Kendi', subject: 'Türkçe', minutes: 30, priority: 'Normal', done: false, date: '2026-10-16', origin: 'student' },
    ];
    d.coachSchedule = {
      days: [{ day: 'Pazartesi', blocks: [{ title: 'Koç bloğu', minutes: 50, icon: '📘' }] }],
      notes: 'koç',
      source: 'coach',
      updatedAt: '2026-10-16T00:00:00.000Z',
      pdfName: '',
      pdfSize: 0,
    };
    const next = clearStudentSmartPlan(d);
    expect(next.plan).toEqual([]);
    expect(next.planDate).toBe('');
    expect(next.tasks.map((t) => t.id)).toEqual(['c1', 's1']);
    expect(next.coachSchedule.days[0]?.blocks[0]?.title).toBe('Koç bloğu');
    expect(getStudentProgress(next).planChange).toBeTruthy();
  });
});
