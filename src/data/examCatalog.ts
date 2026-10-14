/** Platforma ait alıştırma anahtarları. ÖSYM/yayınevi kopyası yok; bulunamayan sınav uydurulmaz. */

export type CatalogExam = {
  id: string;
  name: string;
  kind: 'TYT' | 'AYT' | 'LGS' | 'KPSS';
  published: string;
  licensed: true;
  questions: { n: number; subject: string; topic: string; answer: number }[];
};

export const EXAM_CATALOG: CatalogExam[] = [
  {
    id: 'ekoc-tyt-mat-a',
    name: 'E-Koçluk TYT Matematik Alıştırması A',
    kind: 'TYT',
    published: '2026 alıştırma (platform)',
    licensed: true,
    questions: [
      { n: 1, subject: 'Matematik', topic: 'Denklemler', answer: 1 },
      { n: 2, subject: 'Matematik', topic: 'Üslü sayılar', answer: 3 },
      { n: 3, subject: 'Matematik', topic: 'Yüzde', answer: 2 },
      { n: 4, subject: 'Matematik', topic: 'Problemler', answer: 0 },
      { n: 5, subject: 'Matematik', topic: 'Köklü sayılar', answer: 4 },
    ],
  },
];

export function searchExamCatalog(q: string) {
  const s = q.trim().toLocaleLowerCase('tr-TR');
  if (s.length < 3) return [];
  return EXAM_CATALOG.filter((e) => e.name.toLocaleLowerCase('tr-TR').includes(s) || e.id.toLocaleLowerCase('tr-TR').includes(s));
}

export function examById(id: string) {
  return EXAM_CATALOG.find((e) => e.id === id) || null;
}
