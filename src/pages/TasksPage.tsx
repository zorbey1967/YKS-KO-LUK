import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskRows } from '../components/TaskRows';
import { today } from '../lib/util';
import { fetchMyCoachHomework, setCoachHomeworkDone } from '../lib/cloudPlatform';
import { applyCoachHomeworks } from '../lib/coachPlan';
import { tombstone } from '../lib/syncMerge';
import { type CoachHomework } from '../lib/coaches';

export function TasksPage({ onNewTask }: { onNewTask: () => void }) {
  const { data, setData, toast, user } = useApp();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'today' | 'open' | 'all'>('today');
  const [coachHw, setCoachHw] = useState<CoachHomework[]>([]);
  const [hwNote, setHwNote] = useState('');
  const td = today();

  useEffect(() => {
    if (!user) {
      setCoachHw([]);
      return;
    }
    let alive = true;
    void fetchMyCoachHomework().then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setCoachHw([]);
        setHwNote(res.missing ? 'Koç ödevi tablosu (014) yok. Sahte ödev gösterilmiyor.' : res.error);
        return;
      }
      setHwNote('');
      setCoachHw(res.rows);
      setData((d) => applyCoachHomeworks(d, res.rows));
    });
    return () => { alive = false; };
  }, [user]);

  const filtered = data.tasks.filter((x) => {
    if (tab === 'today' && (x.date !== td || x.done)) return false;
    if (tab === 'open' && x.done) return false;
    return `${x.title} ${x.subject} ${x.priority}`.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'));
  });
  const hwView = coachHw.filter((h) => {
    if (tab === 'today' && (h.due !== td || h.done)) return false;
    if (tab === 'open' && h.done) return false;
    return h.title.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'));
  });

  return (
    <div className="card">
      <div className="section-title">
        <h3>Görevler</h3>
        <button className="btn primary" type="button" onClick={onNewTask}>Yeni görev</button>
      </div>
      <p className="muted">Kendi görevlerin öğrenci kaydında. Koç ödevi hem aşağıda hem planında “Koç” etiketiyle görünür; ZORRO bu satırları değiştirmez.</p>
      {hwNote ? <p className="notice">{hwNote}</p> : null}
      {hwView.length ? (
        <>
          <div className="section-title"><h3>Koç ödevi</h3></div>
          {hwView.map((h) => (
            <div className="plan-item" key={h.id}>
              <span>{h.title}<br /><small className="muted">Koç • {h.due || 'tarih yok'}{h.updatedAt && h.createdAt && h.updatedAt !== h.createdAt ? ' • güncellendi' : ''}</small></span>
              <button className="btn secondary" type="button" onClick={() => {
                void setCoachHomeworkDone(h.id, !h.done).then((res) => {
                  if (!res.ok) return toast(res.error);
                  setCoachHw((rows) => rows.map((x) => x.id === h.id ? { ...x, done: !x.done } : x));
                });
              }}>{h.done ? 'Aç' : 'Tamam'}</button>
            </div>
          ))}
        </>
      ) : null}
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={`chip ${tab === 'today' ? 'on' : ''}`} type="button" onClick={() => setTab('today')}>Bugün</button>
        <button className={`chip ${tab === 'open' ? 'on' : ''}`} type="button" onClick={() => setTab('open')}>Açık</button>
        <button className={`chip ${tab === 'all' ? 'on' : ''}`} type="button" onClick={() => setTab('all')}>Tümü</button>
      </div>
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <input className="search" placeholder="Görev ara…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Görev ara" />
        <button className="btn secondary" type="button" onClick={() => {
          const items = data.tasks.filter((x) => x.date === td && !x.done);
          if (!items.length) return toast('Bugün tamamlanacak açık görev yok.');
          if (!confirm(`${items.length} açık görev tamamlansın mı?`)) return;
          setData({ ...data, tasks: data.tasks.map((t) => (t.date === td ? { ...t, done: true } : t)) });
        }}>Bugünü tamamla</button>
        <button className="btn secondary" type="button" onClick={() => {
          const n = data.tasks.filter((t) => t.done).length;
          if (!n) return toast('Silinecek tamamlanmış görev yok.');
          if (!confirm(`${n} tamamlanmış görev silinsin mi?`)) return;
          setData(data.tasks.filter((t) => t.done).reduce((d, t) => tombstone(d, 'task', t.id), data));
        }}>Tamamlananları sil</button>
      </div>
      {filtered.length ? <TaskRows tasks={filtered} /> : (
        <div className="empty">
          {data.tasks.length ? 'Bu süzgeçte görev yok.' : 'Henüz kendi görevin yok.'}
          {!data.tasks.length ? (
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn primary" type="button" onClick={onNewTask}>İlk görevini oluştur</button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
