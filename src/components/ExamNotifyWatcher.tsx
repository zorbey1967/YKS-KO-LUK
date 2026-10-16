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
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false }).format(new Date());
    const key = `${day}:${hour}:${(data.examTargets || []).map((t) => `${t.id}:${data.examNotifyLog?.[`${t.id}:1`] || data.examNotifyLog?.[`${t.id}:3`] || ''}`).join(',')}`;
    if (ran.current === key) return;
    const due = dueExamNotices(data, data.examTargets || []);
    if (!due.length) {
      ran.current = key;
      return;
    }
    ran.current = key;
    const log = { ...data.examNotifyLog };
    for (const n of due) {
      log[n.key] = new Date().toISOString();
      toast(n.text);
      showBrowserNotify('Sınav', n.text);
    }
    setData({ ...data, examNotifyLog: log });
  }, [data, profile?.role, setData, toast]);

  return null;
}
