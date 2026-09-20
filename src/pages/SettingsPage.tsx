import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { bundledManifest } from '../data/bankData';
import { supabase } from '../lib/supabase';
import { emptyData } from '../lib/types';
import { storageKey } from '../lib/storage';
import { GoalEditor } from '../components/GoalEditor';
import { LlmSettingsCard } from '../components/LlmSettingsCard';

export function SettingsPage() {
  const { data, setData, toast, theme, toggleTheme, user, cloudStatus } = useApp();
  const man = useMemo(() => bundledManifest(), []);
  const raw = (() => {
    try { return localStorage.getItem(storageKey(user?.id)) || ''; } catch { return ''; }
  })();

  return (
    <>
    <GoalEditor compact />
      <LlmSettingsCard />
      <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title"><h3>⚙ Ayarlar</h3></div>
      <div className="status-grid">
        <div className="status"><b>Soru grupları</b><span>{Object.keys(man.curriculum).length} seviye</span></div>
        <div className="status"><b>Soru kayıtları</b><span>{man.questionCount}</span></div>
        <div className="status"><b>Supabase</b><span>{supabase ? 'Hazır' : 'Yok'}</span></div>
        <div className="status"><b>Bulut</b><span>{cloudStatus}</span></div>
        <div className="status"><b>Yerel veri</b><span>{(raw.length / 1024).toFixed(1)} KB</span></div>
        <div className="status"><b>Görev / deneme</b><span>{data.tasks.length} / {data.exams.length}</span></div>
      </div>
      <div className="success" style={{ marginTop: 12 }}>Teknik kontroller: uygulama React + Vite iskeletinde çalışıyor.</div>
      <div className="switch">
        <div><b>Koyu tema</b><br /><small style={{ color: 'var(--muted)' }}>Gece görünümü</small></div>
        <button className={`toggle ${theme === 'dark' ? 'on' : ''}`} type="button" onClick={toggleTheme}><i /></button>
      </div>
      <div className="switch">
        <div><b>Verileri sıfırla</b><br /><small style={{ color: 'var(--muted)' }}>Bu cihazdaki görev, deneme ve süre kayıtlarını siler.</small></div>
        <button className="btn danger" type="button" onClick={() => {
          if (!confirm('Bu cihazdaki YKS verileri silinsin mi?')) return;
          setData(emptyData());
          toast('Veriler sıfırlandı');
        }}>Sıfırla</button>
      </div>
    </div>
    </>
  );
}
