import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dueExamNotices, showBrowserNotify } from '../lib/examNotify';
import { istanbulToday } from '../lib/meeting';

export function ExamNotifyWatcher() {
  const { data, setData, toast, profile } = useApp();
  const ran = useRef('');

  useEffect(() => {
    if (profile?.role === 'coach') return;
    const day = istanbulToday();
    const key = `${day}:${(data.examTargets || []).map((t) => t.id).join(',')}`;
    if (ran.current === key) return;
    const due = dueExamNotices(data, data.examTargets || []);
    if (!due.length) {
      ran.current = key;
      return;
    }
    ran.current = key;
    const log = { ...data.examNotifyLog };
    for (const n of due) {
      log[n.key] = day;
      toast(n.text);
      showBrowserNotify('Sınav', n.text);
    }
    setData({ ...data, examNotifyLog: log });
  }, [data, profile?.role, setData, toast]);

  return null;
}
