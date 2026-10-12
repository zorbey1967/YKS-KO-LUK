import type { AppData, Session } from './types';
import { enqueueReview } from './spacedReview';

export function commitSession(data: AppData, rec: Session): { data: AppData; duplicate: boolean } {
  if (data.sessions.some((s) => s.id === rec.id)) {
    return { data, duplicate: true };
  }
  let next: AppData = { ...data, sessions: [...data.sessions, rec] };
  if (rec.taskId) {
    next = {
      ...next,
      tasks: next.tasks.map((t) => (t.id === rec.taskId ? { ...t, done: true } : t)),
    };
  }
  if (rec.kind === 'review' && rec.topic) {
    next = enqueueReview(next, {
      kind: 'topic',
      subject: rec.subject,
      topic: rec.topic,
      at: rec.endedAt || rec.createdAt,
    });
  }
  return { data: next, duplicate: false };
}

export function patchSession(data: AppData, id: string, patch: Partial<Session>): AppData {
  return {
    ...data,
    sessions: data.sessions.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)),
  };
}
