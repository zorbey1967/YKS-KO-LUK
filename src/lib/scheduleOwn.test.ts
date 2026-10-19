import { describe, expect, it } from 'vitest';
import { emptyData, emptySchedule } from './types';
import { coachOwnedSchedule, saveOwnSchedule, studentOwnedSchedule } from './studentProgress';

describe('Ders Programım tek kopya', () => {
  it('öğrenci programı yazılır; boş satırlar atılır; süre sınırlanır', () => {
    const d = saveOwnSchedule(emptyData(), [
      { day: 'Pazartesi', blocks: [{ title: ' Matematik ', minutes: 999, icon: '📐', start: '18:00' }, { title: '', minutes: 30, icon: '📚' }] },
      { day: 'Salı', blocks: [] },
    ]);
    expect(studentOwnedSchedule(d).days).toEqual([{ day: 'Pazartesi', blocks: [{ title: 'Matematik', minutes: 300, icon: '📐', start: '18:00' }] }]);
    expect(d.schedule.source).toBe('self');
    expect(d.schedule.updatedAt).toBeTruthy();
  });

  it('eski kayıtta koç programı data.schedule içindeyse kaybolmaz, koç programına taşınır', () => {
    const base = emptyData();
    base.schedule = { ...emptySchedule(), source: 'coach', days: [{ day: 'Cuma', blocks: [{ title: 'Koç: Fizik', minutes: 60, icon: '🔬' }] }] };
    const d = saveOwnSchedule(base, [{ day: 'Pazartesi', blocks: [{ title: 'Türkçe', minutes: 40, icon: '📖' }] }]);
    expect(coachOwnedSchedule(d).days[0].blocks[0].title).toBe('Koç: Fizik');
    expect(studentOwnedSchedule(d).days[0].blocks[0].title).toBe('Türkçe');
  });

  it('koç programı ayrıysa öğrenci kaydı ona dokunmaz', () => {
    const base = emptyData();
    base.coachSchedule = { ...emptySchedule(), source: 'coach', days: [{ day: 'Cuma', blocks: [{ title: 'Kimya', minutes: 45, icon: '🧪' }] }] };
    const d = saveOwnSchedule(base, []);
    expect(d.coachSchedule).toBe(base.coachSchedule);
    expect(studentOwnedSchedule(d).days).toEqual([]);
  });
});
