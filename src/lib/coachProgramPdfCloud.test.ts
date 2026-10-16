import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterCoachProgramPdfsForStudents, filterOwnCoachProgramPdfs } from './coachProgramPdfCloud';

describe('koç programı PDF izolasyonu', () => {
  it('A kendi PDF’sini görür; B A’nınkini görmez; koç yalnızca bağlı öğrencileri', () => {
    const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const rows = [
      { id: '1', student_id: a, file_name: 'A.pdf' },
      { id: '2', student_id: b, file_name: 'B.pdf' },
    ];
    expect(filterOwnCoachProgramPdfs(rows, a).map((r) => r.file_name)).toEqual(['A.pdf']);
    expect(filterOwnCoachProgramPdfs(rows, b).some((r) => r.file_name === 'A.pdf')).toBe(false);
    expect(filterCoachProgramPdfsForStudents(rows, [a]).map((r) => r.file_name)).toEqual(['A.pdf']);
  });

  it('migration ve UI: PDF yükle/görüntüle; WeekPlanEditor yok', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/047_coach_program_pdfs.sql'), 'utf8');
    expect(sql).toContain('coach-program-pdfs');
    expect(sql).toContain('coach_linked_to_student');
    expect(sql).toContain('force row level security');
    const coaches = readFileSync(join(process.cwd(), 'src/pages/CoachesPage.tsx'), 'utf8');
    expect(coaches).toContain('Program Yükle');
    expect(coaches).toContain('uploadCoachProgramPdf');
    expect(coaches).not.toContain('WeekPlanEditor');
    expect(coaches).not.toContain('saveStudentWeekPlan');
    const plan = readFileSync(join(process.cwd(), 'src/pages/PlanPage.tsx'), 'utf8');
    expect(plan).toContain('clearStudentSmartPlan');
    expect(plan).toContain('listMyCoachProgramPdfs');
    expect(plan).toContain('Koçun Programı');
  });
});
