import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskRows } from '../components/TaskRows';
import { today } from '../lib/util';

export function TasksPage({ onNewTask }: { onNewTask: () => void }) {
  const { data, setData, toast } = useApp();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'today' | 'open' | 'all'>('today');
  const td = today();
  const filtered = data.tasks.filter((x) => {
    if (tab === 'today' && x.date !== td) return false;
    if (tab === 'open' && x.done) return false;
    return `${x.title} ${x.subject} ${x.priority}`.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'));
  });
  return (
    <div className="card">
      <div className="section-title">
        <h3>✅ Görevler</h3>
        <button className="btn primary" type="button" onClick={onNewTask}>＋ Yeni görev</button>
      </div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={`chip ${tab === 'today' ? 'on' : ''}`} type="button" onClick={() => setTab('today')}>Bugün</button>
        <button className={`chip ${tab === 'open' ? 'on' : ''}`} type="button" onClick={() => setTab('open')}>Açık</button>
        <button className={`chip ${tab === 'all' ? 'on' : ''}`} type="button" onClick={() => setTab('all')}>Tümü</button>
      </div>
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <input className="search" placeholder="Görev ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn secondary" type="button" onClick={() => {
          const items = data.tasks.filter((x) => x.date === td && !x.done);
          if (!items.length) return toast('Bugün tamamlanacak açık görev yok.');
          if (!confirm(`${items.length} açık görev tamamlansın mı?`)) return;
          setData({ ...data, tasks: data.tasks.map((t) => (t.date === td ? { ...t, done: true } : t)) });
        }}>✓ Bugünü tamamla</button>
        <button className="btn secondary" type="button" onClick={() => {
          const n = data.tasks.filter((t) => t.done).length;
          if (!n) return toast('Silinecek tamamlanmış görev yok.');
          if (!confirm(`${n} tamamlanmış görev silinsin mi?`)) return;
          setData({ ...data, tasks: data.tasks.filter((t) => !t.done) });
        }}>Temizle</button>
      </div>
      <TaskRows tasks={filtered} />
    </div>
  );
}
