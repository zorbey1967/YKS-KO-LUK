import type { Task } from '../lib/types';
import { useApp } from '../context/AppContext';
import { tombstone } from '../lib/syncMerge';

export function TaskRows({ tasks }: { tasks: Task[] }) {
  const { setData, toast, go } = useApp();
  if (!tasks.length) return <div className="empty">Henüz bir kayıt yok.</div>;
  return (
    <>
      {tasks.map((x) => (
        <div
          key={x.id}
          className={`task ${x.done ? 'done' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={x.done}
          aria-label={`${x.title}${x.done ? ', tamamlandı' : ''}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === x.id ? { ...t, done: !t.done, updatedAt: new Date().toISOString() } : t)) }));
            }
          }}
          onClick={() => {
              setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === x.id ? { ...t, done: !t.done, updatedAt: new Date().toISOString() } : t)) }));
          }}
        >
          <div className={`check ${x.done ? 'done' : ''}`}>{x.done ? '✓' : ''}</div>
          <div className="task-main">
            <strong>{x.title}</strong>
            <small>{x.origin === 'zorro' ? 'ZORRO' : x.origin === 'coach' ? 'Koç' : 'Sen'} • {x.subject} • {x.minutes} dk{x.date ? ` • ${x.date}` : ''}</small>
          </div>
          {!x.done ? (
            <button
              className="btn primary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go('timer');
              }}
            >
              Başla
            </button>
          ) : null}
          <button
            className="btn secondary"
            type="button"
            aria-label="Görevi sil"
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm('Bu görev silinsin mi?')) return;
              setData((d) => tombstone(d, 'task', x.id));
              toast('Görev silindi');
            }}
          >
            Sil
          </button>
        </div>
      ))}
    </>
  );
}
