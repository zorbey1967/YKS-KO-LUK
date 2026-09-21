import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { CoachChat } from './components/CoachChat';
import { CommandPalette } from './components/CommandPalette';
import { HomePage } from './pages/HomePage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { CoachesPage } from './pages/CoachesPage';
import { GoalPage } from './pages/GoalPage';
import { SchedulePage } from './pages/SchedulePage';
import { TasksPage } from './pages/TasksPage';
import { PlanPage } from './pages/PlanPage';
import { ExamsPage } from './pages/ExamsPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { TopicsPage } from './pages/TopicsPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { CalendarPage } from './pages/CalendarPage';
import { TimerPage } from './pages/TimerPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { MembershipPage } from './pages/MembershipPage';
import { AccountPage } from './pages/AccountPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminGate, AdminPage } from './pages/AdminPage';
import { MeetingPage } from './pages/MeetingPage';
import { today, uid } from './lib/util';
import { STUDY_SUBJECTS } from './lib/insights';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}

function Shell() {
  const { page, setMenuOpen, menuOpen, isAdmin } = useApp();
  const [taskOpen, setTaskOpen] = useState(false);
  const [cmd, setCmd] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmd(true);
        return;
      }
      if (e.key === 'Escape') {
        setCmd(false);
        setTaskOpen(false);
        setMenuOpen(false);
      }
      if (['input', 'textarea', 'select'].includes(tag)) return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMenuOpen]);

  return (
    <Layout>
      <ErrorBoundary key={page}>
      {page === 'home' && <HomePage onNewTask={() => setTaskOpen(true)} />}
      {page === 'questionbank' && <QuestionBankPage />}
      {page === 'coaches' && <CoachesPage />}
      {page === 'goal' && <GoalPage />}
      {page === 'schedule' && <SchedulePage />}
      {page === 'tasks' && <TasksPage onNewTask={() => setTaskOpen(true)} />}
      {page === 'plan' && <PlanPage />}
      {page === 'exams' && <ExamsPage />}
      {page === 'calculator' && <CalculatorPage />}
      {page === 'topics' && <TopicsPage />}
      {page === 'questions' && <QuestionsPage />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'timer' && <TimerPage />}
      {page === 'analytics' && <AnalyticsPage />}
      {page === 'membership' && <MembershipPage />}
      {page === 'account' && <AccountPage />}
      {page === 'settings' && <SettingsPage />}
      {page === 'admin' && (isAdmin ? <AdminPage /> : <AdminGate />)}
      {page === 'meeting' && <MeetingPage />}
      </ErrorBoundary>
      {taskOpen && <TaskModal onClose={() => setTaskOpen(false)} />}
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
      <CoachChat />
    </Layout>
  );
}

function TaskModal({ onClose }: { onClose: () => void }) {
  const { setData, toast } = useApp();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Matematik');
  const [minutes, setMinutes] = useState(40);
  const [priority, setPriority] = useState('Normal');

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <h3>Yeni görev</h3>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </div>
        <div className="form-grid" style={{ marginTop: 15 }}>
          <div className="field"><label>Görev</label><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AYT matematik 40 soru" /></div>
          <div className="field">
            <label>Ders</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {STUDY_SUBJECTS.filter((s) => s !== 'Odak').map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Süre (dk)</label><input type="number" value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 0)} /></div>
          <div className="field">
            <label>Öncelik</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>Normal</option><option>Yüksek</option><option>Düşük</option>
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => {
            if (!title.trim()) return toast('Görev adı gerekli.');
            setData((d) => ({
              ...d,
              tasks: [{ id: uid('t_'), title: title.trim(), subject, minutes, priority, done: false, date: today() }, ...d.tasks],
            }));
            toast('Görev eklendi');
            onClose();
          }}>Görevi ekle</button>
        </div>
      </div>
    </div>
  );
}
