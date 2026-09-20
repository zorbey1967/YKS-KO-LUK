import type { Task } from '../lib/types';
import { useApp } from '../context/AppContext';

export function TaskRows({ tasks }: { tasks: Task[] }) {
  const { setData, toast } = useApp();
  if (!tasks.length) return <div className="empty">Görev yok.</div>;
  return (
    <>
      {tasks.map((x) => (
        <div key={x.id} className={`task ${x.done ? 'done' : ''}`} role="button" onClick={() => {
          setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === x.id ? { ...t, done: !t.done } : t)) }));
        }}>
          <div className={`check ${x.done ? 'done' : ''}`}>{x.done ? '✓' : ''}</div>
          <div className="task-main">
            <strong>{x.title}</strong>
            <small>{x.subject} • {x.minutes} dk • {x.priority}</small>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== x.id) }));
              toast('Görev silindi');
            }}
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}
