import { describe, expect, it } from 'vitest';
import { emptyData } from './types';
import {
  EXAM_DOC_UNREADABLE,
  analyzeExamDocumentFiles,
  buildExamDocumentAnalysisFromAi,
  clearExamDocumentAnalysisForUser,
  mergeExamDocumentAnalyses,
  parseExamDocumentAiPayload,
  resetExamDocumentAnalysisCache,
  summarizeExamQuestions,
} from './examDocumentAnalysis';

describe('examDocumentAnalysis', () => {
  it('okunamayan dosyada uydurma soru üretmez', () => {
    const out = buildExamDocumentAnalysisFromAi(
      { unreadable: true, message: EXAM_DOC_UNREADABLE, questions: [] },
      { fingerprint: 'a', data: emptyData() },
    );
    expect(out.unreadable).toBe(true);
    expect(out.empty).toBe(true);
    expect(out.questions).toEqual([]);
    expect(out.message).toBe(EXAM_DOC_UNREADABLE);
  });

  it('soru → ders → konu eşlemesi ve yanlış gruplaması', () => {
    const parsed = parseExamDocumentAiPayload({
      questions: [
        { number: 1, subject: 'Matematik', topic: 'Fonksiyonlar', verdict: 'yanlis', readable: true },
        { number: 2, subject: 'Matematik', topic: 'Polinomlar', verdict: 'dogru', readable: true },
        { number: 3, subject: 'Türkçe', topic: 'Paragraf', verdict: 'yanlis', readable: true },
        { number: 4, subject: '', topic: '', verdict: 'maybe', readable: true },
      ],
    });
    expect(parsed.questions[3].subject).toBe('Belirlenemedi');
    expect(parsed.questions[3].topic).toBe('Konusu belirlenemedi');
    expect(parsed.questions[3].verdict).toBe('belirlenemedi');
    const agg = summarizeExamQuestions(parsed.questions);
    const mat = agg.bySubject.find((s) => s.subject === 'Matematik');
    expect(mat?.topics.find((t) => t.topic === 'Fonksiyonlar')?.wrong).toBe(1);
    expect(mat?.topics.find((t) => t.topic === 'Polinomlar')?.correct).toBe(1);
    expect(agg.mostWrongTopics.some((t) => /Fonksiyonlar|Paragraf/.test(t))).toBe(true);
    expect(agg.strongTopics.some((t) => /Polinomlar/.test(t))).toBe(true);
  });

  it('dosya olmadan analiz hata verir; cache kullanıcıya özeldir', async () => {
    resetExamDocumentAnalysisCache();
    const noFiles = await analyzeExamDocumentFiles([], emptyData(), 'u1', 'fp', async () => ({ path: 'x' }), async () => ({ ok: true, analysis: {} }));
    expect('error' in noFiles).toBe(true);

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'a.jpg', { type: 'image/jpeg' });
    const res = await analyzeExamDocumentFiles(
      [file],
      emptyData(),
      'user-a',
      'p1',
      async () => ({ path: 'user-a/1.jpg' }),
      async () => ({
        ok: true,
        analysis: {
          questions: [
            { number: 1, subject: 'Matematik', topic: 'Fonksiyonlar', verdict: 'yanlis', readable: true },
          ],
        },
      }),
    );
    expect('error' in res).toBe(false);
    if ('error' in res) return;
    expect(res.questions[0].topic).toBe('Fonksiyonlar');

    const cached = await analyzeExamDocumentFiles(
      [file],
      emptyData(),
      'user-a',
      'p1',
      async () => ({ error: 'should-not-upload' }),
      async () => ({ ok: false, error: 'should-not-scan' }),
    );
    expect('error' in cached).toBe(false);
    if (!('error' in cached)) expect(cached.source).toBe('cache');

    clearExamDocumentAnalysisForUser('user-a');
    const other = await analyzeExamDocumentFiles(
      [file],
      emptyData(),
      'user-b',
      'p1',
      async () => ({ path: 'user-b/1.jpg' }),
      async () => ({
        ok: true,
        analysis: { unreadable: true, message: EXAM_DOC_UNREADABLE, questions: [] },
      }),
    );
    expect('error' in other).toBe(false);
    if (!('error' in other)) {
      expect(other.unreadable).toBe(true);
      expect(other.questions).toEqual([]);
    }
  });

  it('birleştirmede uydurma konu eklemez', () => {
    const a = buildExamDocumentAnalysisFromAi(
      { questions: [{ number: 1, subject: 'Matematik', topic: 'Fonksiyonlar', verdict: 'yanlis', readable: true }] },
      { fingerprint: 'f', data: emptyData() },
    );
    const b = buildExamDocumentAnalysisFromAi(
      { unreadable: true, message: EXAM_DOC_UNREADABLE, questions: [] },
      { fingerprint: 'f', data: emptyData() },
    );
    const merged = mergeExamDocumentAnalyses([a, b], { fingerprint: 'f', data: emptyData() });
    expect(merged.questions).toHaveLength(1);
    expect(merged.bySubject[0]?.topics[0]?.topic).toBe('Fonksiyonlar');
  });
});
