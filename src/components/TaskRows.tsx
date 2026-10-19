import type { Task } from '../lib/types';
import { useApp } from '../context/AppContext';
import { tombstone } from '../lib/syncMerge';
import { setCoachHomeworkDone } from '../lib/cloudPlatform';

function homeworkIdOf(task: Task) {
  if (task.homeworkId) return task.homeworkId;
  if (task.id.startsWith('hw:')) return task.id.slice(3);
  return '';
}

/** hideStart: Ana Sayfa'da tek "Başla" üstteki öneride; listede tekrar edilmez. */
export function TaskRows({ tasks, hideStart = false }: { tasks: Task[]; hideStart?: boolean }) {
  const { setData, toast, go } = useApp();
  if (!tasks.length) return <div className="empty">Henüz bir kayıt yok.</div>;

  function toggleDone(x: Task) {
    const nextDone = !x.done;
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === x.id ? { ...t, done: nextDone, updatedAt: new Date().toISOString() } : t)),
    }));
    const hw = homeworkIdOf(x);
    if (hw) {
      void setCoachHomeworkDone(hw, nextDone).then((res) => {
        if (!res.ok) toast(res.error || 'Koç paneline yazılamadı.');
      });
    }
  }

  return (
    <>
      {tasks.map((x) => (
        <div
          key={x.id}
          className={`task ${x.done ? 'done' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={x.done}
          aria-label={`${x.title}${x.done ? ', yapıldı' : ', yapılmadı'}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDone(x);
            }
          }}
          onClick={() => toggleDone(x)}
        >
          <div className={`check ${x.done ? 'done' : ''}`} aria-hidden>{x.done ? '☑' : '☐'}</div>
          <div className="task-main">
            <strong>{x.title}</strong>
            <small>
              {x.origin === 'zorro' ? 'ZORRO' : x.origin === 'coach' ? 'Koç' : 'Sen'}
              {x.subject ? ` • ${x.subject}` : ''}
              {x.minutes ? ` • ${x.minutes} dk` : ''}
              {x.date ? ` • ${x.date}` : ''}
              {' · '}
              {x.done ? 'Yapıldı' : 'Yapılmadı'}
            </small>
          </div>
          {!x.done && !hideStart ? (
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
