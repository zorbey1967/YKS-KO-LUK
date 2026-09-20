import type { AppData, Schedule } from './types';
import { extractJsonObject, mergeSchoolWithStudy, parseSchoolPdfText, scheduleFromUnknown } from './schedule';
import { invokeScheduleAi } from './coachAi';
import { coachContext } from './coach';

const INSTRUCTION = 'Bu metin okul veya öğretmen ders programıdır. Okul derslerini koru; boş zamanlara kişisel çalışma blokları yerleştir. JSON olarak { "summary": "...", "schedule": { "days": [ { "day": "Pazartesi", "blocks": [ { "title": "...", "minutes": 40, "icon": "📚" } ] } ] } } döndür. Gün adları Türkçe olsun.';

export type AiScheduleResult = { schedule: Schedule; summary: string; usedAi: boolean };

export async function buildScheduleFromPdf(opts: {
  data: AppData;
  text: string;
  daily: number;
  focus: string;
  notes: string;
  filename: string;
}): Promise<AiScheduleResult> {
  const fallback = mergeSchoolWithStudy(
    parseSchoolPdfText(opts.text),
    opts.data,
    opts.daily,
    opts.focus,
    opts.notes,
    'school_pdf_local',
  );

  const cloud = await invokeScheduleAi({
    action: 'schedule',
    filename: opts.filename,
    pdf_text: opts.text.slice(0, 12000),
    context: coachContext(opts.data),
    instruction: `${INSTRUCTION} Öğrenci notu: ${opts.notes || 'yok'}. Günlük hedef ${opts.daily} dk. Odak: ${opts.focus}.`,
  });
  if (cloud.ok) {
    const rec = cloud.data as { schedule?: unknown; summary?: string; text?: string; reply?: string };
    const parsed = scheduleFromUnknown(rec, fallback)
      || scheduleFromUnknown(extractJsonObject(String(rec?.text || rec?.reply || rec?.summary || '')), fallback);
    if (parsed) {
      return {
        schedule: { ...parsed, pdfName: opts.filename, pdfSize: opts.data.schedule.pdfSize, source: 'school_teacher_ai' },
        summary: rec?.summary || 'PDF gerçek modelle incelendi.',
        usedAi: true,
      };
    }
  }
  return { schedule: fallback, summary: 'Model alınamadı; PDF metninden yerel program üretildi.', usedAi: false };
}

export async function buildScheduleWithAi(opts: {
  data: AppData;
  daily: number;
  focus: string;
  notes: string;
  makeLocal: () => Schedule;
}): Promise<AiScheduleResult> {
  const local = opts.makeLocal();
  const cloud = await invokeScheduleAi({
    action: 'schedule',
    context: coachContext(opts.data),
    instruction: `Haftalık çalışma programı üret. JSON {summary, schedule:{days:[{day,blocks:[{title,minutes,icon}]}]}} döndür. Odak: ${opts.focus}. Günlük ${opts.daily} dk. Not: ${opts.notes || 'yok'}.`,
  });
  if (cloud.ok) {
    const rec = cloud.data as { schedule?: unknown; summary?: string; text?: string; reply?: string };
    const parsed = scheduleFromUnknown(rec, local)
      || scheduleFromUnknown(extractJsonObject(String(rec?.text || rec?.reply || '')), local);
    if (parsed) {
      return {
        schedule: { ...parsed, source: 'ekoc_ai', pdfName: opts.data.schedule.pdfName, pdfSize: opts.data.schedule.pdfSize },
        summary: rec?.summary || 'AI programı hazır.',
        usedAi: true,
      };
    }
  }
  return { schedule: local, summary: 'Model alınamadı; yerel program kullanıldı. Giriş yaptığından ve student-ai fonksiyonunun yayında olduğundan emin ol.', usedAi: false };
}
