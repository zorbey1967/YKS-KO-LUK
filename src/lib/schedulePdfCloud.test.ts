import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterCoachSchedulePdfsForStudents, filterOwnSchedulePdfs } from './schedulePdfCloud';

describe('schedule PDF koça gönder izolasyonu', () => {
  it('A kendi satırını görür, B A’nın satırını görmez; koç yalnızca bağlı öğrencileri görür', () => {
    const studentA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const studentB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const rows = [
      { id: '1', student_id: studentA, file_name: 'A.pdf' },
      { id: '2', student_id: studentB, file_name: 'B.pdf' },
    ];
    expect(filterOwnSchedulePdfs(rows, studentA).map((r) => r.file_name)).toEqual(['A.pdf']);
    expect(filterOwnSchedulePdfs(rows, studentB).map((r) => r.file_name)).toEqual(['B.pdf']);
    expect(filterOwnSchedulePdfs(rows, studentB).some((r) => r.file_name === 'A.pdf')).toBe(false);
    expect(filterOwnSchedulePdfs(rows, null)).toEqual([]);
    expect(filterCoachSchedulePdfsForStudents(rows, [studentA]).map((r) => r.file_name)).toEqual(['A.pdf']);
    expect(filterCoachSchedulePdfsForStudents(rows, [studentB]).some((r) => r.file_name === 'A.pdf')).toBe(false);
  });

  it('migration path kullanıcı klasörü + RLS; SchedulePage haftalık üretmez', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/046_schedule_pdf_to_coach.sql'), 'utf8');
    expect(sql).toContain('schedule-pdfs');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('coach_linked_to_student');
    expect(sql).toContain("(storage.foldername(name))[1] = (select auth.uid()::text)");
    expect(sql).toContain('storage_path like (student_id::text || \'/%\')');
    expect(sql).not.toMatch(/drop table/i);
    const page = readFileSync(join(process.cwd(), 'src/pages/SchedulePage.tsx'), 'utf8');
    expect(page).toContain('Koça Gönder');
    expect(page).toContain('PDF’yi Analiz Et');
    expect(page).toContain('PDF’yi görüntüle');
    expect(page).toContain('sendSchedulePdfToCoach');
    expect(page).not.toContain('ExamCenter');
    expect(page).not.toContain('<h3>Ders Programım</h3>');
    expect(page).not.toContain('Yerel üret');
    expect(page).not.toContain('Haftalık program');
    const coach = readFileSync(join(process.cwd(), 'src/pages/CoachesPage.tsx'), 'utf8');
    expect(coach).toContain('Öğrencinin Ders Programları');
    expect(coach).toContain('listCoachSchedulePdfSubmissions');
  });
});
