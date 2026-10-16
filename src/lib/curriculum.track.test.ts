import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  curriculumForStudent,
  filterCurriculumByTrack,
  normalizeStudentTrack,
} from './curriculum';
import { emptyData } from './types';
import { buildSubjectCards, generateLivingPlan, progressFingerprint, studentStateLines } from './studentProgress';

const TYT = ['TYT Türkçe', 'TYT Matematik', 'TYT Geometri', 'TYT Sosyal', 'TYT Fen'];
const SAY_ONLY = ['AYT Fizik', 'AYT Kimya', 'AYT Biyoloji'];
const EA_ONLY = ['AYT Edebiyat', 'AYT Tarih-1', 'AYT Coğrafya-1'];
const SOZ_EXTRA = ['AYT Sosyal-2', 'AYT Felsefe Grubu', 'AYT Din Kültürü'];

function withTrack(track: string) {
  const d = emptyData();
  d.grade = 'Mezun / YKS';
  d.track = track;
  return d;
}

describe('alan bazlı müfredat (regresyon A–C)', () => {
  it('normalizeStudentTrack EA/SAY/SÖZ/DİL eşdeğerlerini tanır', () => {
    expect(normalizeStudentTrack('Eşit Ağırlık')).toBe('ea');
    expect(normalizeStudentTrack('EA')).toBe('ea');
    expect(normalizeStudentTrack('Sayısal')).toBe('say');
    expect(normalizeStudentTrack('SAY')).toBe('say');
    expect(normalizeStudentTrack('Sözel')).toBe('soz');
    expect(normalizeStudentTrack('SÖZ')).toBe('soz');
    expect(normalizeStudentTrack('Dil')).toBe('dil');
    expect(normalizeStudentTrack('DİL')).toBe('dil');
  });

  it('A) EA öğrencisi → SAY alan dışı AYT konusu görünmez', () => {
    const keys = Object.keys(curriculumForStudent('Mezun / YKS', 'Eşit Ağırlık'));
    for (const s of SAY_ONLY) expect(keys).not.toContain(s);
    expect(keys).toContain('AYT Matematik');
    expect(keys).toContain('AYT Edebiyat');
    const cards = buildSubjectCards(withTrack('Eşit Ağırlık')).map((c) => c.subject);
    for (const s of SAY_ONLY) expect(cards).not.toContain(s);
  });

  it('B) SAY öğrencisi → EA/alan dışı AYT konusu görünmez', () => {
    const keys = Object.keys(curriculumForStudent('Mezun / YKS', 'Sayısal'));
    for (const s of EA_ONLY) expect(keys).not.toContain(s);
    for (const s of SOZ_EXTRA) expect(keys).not.toContain(s);
    expect(keys).toContain('AYT Matematik');
    expect(keys).toContain('AYT Fizik');
    const cards = buildSubjectCards(withTrack('Sayısal')).map((c) => c.subject);
    for (const s of EA_ONLY) expect(cards).not.toContain(s);
  });

  it('C) TYT ortak konular EA/SAY/SÖZ/DİL için kaybolmaz', () => {
    for (const track of ['Eşit Ağırlık', 'Sayısal', 'Sözel', 'Dil']) {
      const keys = Object.keys(curriculumForStudent('Mezun / YKS', track));
      for (const t of TYT) expect(keys).toContain(t);
    }
  });

  it('10. sınıf öğrencisine YKS/AYT konu ağacı ana sistem olarak gelmez', () => {
    const keys = Object.keys(curriculumForStudent('10. Sınıf', 'Eşit Ağırlık'));
    expect(keys.some((k) => /^TYT\b|^AYT\b|^YDT\b/.test(k))).toBe(false);
    expect(keys.length).toBeGreaterThan(3);
  });

  it('SÖZ ve DİL alan dersleri doğru filtrelenir', () => {
    const soz = Object.keys(curriculumForStudent('Mezun / YKS', 'Sözel'));
    expect(soz).toContain('AYT Edebiyat');
    expect(soz).toContain('AYT Sosyal-2');
    expect(soz).not.toContain('AYT Fizik');
    expect(soz).not.toContain('AYT Matematik');

    const dil = Object.keys(curriculumForStudent('Mezun / YKS', 'Dil'));
    expect(dil).toContain('YDT İngilizce');
    expect(dil).not.toContain('AYT Fizik');
    expect(dil).not.toContain('AYT Matematik');
    expect(dil).not.toContain('AYT Edebiyat');
  });

  it('topicProgress silinmez; alan değişince liste yeniden filtrelenir', () => {
    let d = withTrack('Sayısal');
    d.topics = [{ id: 'tp1', name: 'Hareket ve kuvvet', subject: 'AYT Fizik', level: 80, grade: d.grade }];
    expect(buildSubjectCards(d).some((c) => c.subject === 'AYT Fizik')).toBe(true);
    expect(d.topics).toHaveLength(1);
    d = { ...d, track: 'Eşit Ağırlık' };
    expect(buildSubjectCards(d).some((c) => c.subject === 'AYT Fizik')).toBe(false);
    expect(d.topics).toHaveLength(1);
    expect(d.topics[0].subject).toBe('AYT Fizik');
  });

  it('Akıllı Plan / Analiz / ZORRO aynı alan filtresini kullanır', () => {
    const ea = withTrack('Eşit Ağırlık');
    const planText = generateLivingPlan(ea, 300).map((p) => p.text).join(' ');
    expect(planText).not.toMatch(/AYT Fizik|AYT Kimya|AYT Biyoloji/i);
    const lines = studentStateLines(ea).join('\n');
    expect(lines).toMatch(/Eşit Ağırlık/);
    const say = withTrack('Sayısal');
    const sayPlan = generateLivingPlan(say, 300).map((p) => p.text).join(' ');
    expect(sayPlan).not.toMatch(/AYT Edebiyat|AYT Tarih-1/i);
  });

  it('alan değişince fingerprint değişir (eski snapshot kullanılmaz)', () => {
    const a = withTrack('Eşit Ağırlık');
    const b = { ...a, track: 'Sayısal' };
    expect(progressFingerprint(a)).not.toBe(progressFingerprint(b));
  });

  it('figür/emoji fingerprint’e dahil değildir', () => {
    const a = withTrack('Sayısal');
    a.libraryPrefs = { ...a.libraryPrefs, emoji: '🦁' };
    const b = { ...a, libraryPrefs: { ...a.libraryPrefs, emoji: '🐸' } };
    expect(progressFingerprint(a)).toBe(progressFingerprint(b));
  });

  it('filterCurriculumByTrack TYT’yi korur, AYT’yi süzer', () => {
    const raw = {
      'TYT Matematik': ['Sayılar'],
      'AYT Fizik': ['Optik'],
      'AYT Edebiyat': ['Şiir'],
      Matematik: ['Türev'],
    };
    const ea = filterCurriculumByTrack(raw, 'EA');
    expect(Object.keys(ea).sort()).toEqual(['AYT Edebiyat', 'Matematik', 'TYT Matematik'].sort());
  });
});

describe('TRACKS Dil seçeneği', () => {
  it('Account/Goal TRACKS listesinde Dil vardır', () => {
    const goal = readFileSync(join(process.cwd(), 'src/lib/goal.ts'), 'utf8');
    expect(goal).toMatch(/'Dil'/);
  });
});
