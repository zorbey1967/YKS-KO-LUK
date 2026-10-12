import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { bundledManifest } from '../data/bankData';
import { SUPABASE_UNAVAILABLE, isSupabaseConfigured } from '../lib/supabase';
import { emptyData } from '../lib/types';
import { storageKey } from '../lib/storage';
import { GoalEditor } from '../components/GoalEditor';
import { LlmSettingsCard } from '../components/LlmSettingsCard';

export function SettingsPage() {
  const { data, setData, toast, theme, toggleTheme, user, cloudStatus, go } = useApp();
  const man = useMemo(() => bundledManifest(), []);
  const raw = (() => {
    try { return localStorage.getItem(storageKey(user?.id)) || ''; } catch { return ''; }
  })();

  return (
    <>
    <GoalEditor compact />
      <LlmSettingsCard />
      <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title"><h3>Ayarlar</h3></div>
      <p className="muted">Bu cihazdaki kayıt boyutu ve bağlantı durumu. Model anahtarı tarayıcıda tutulmaz.</p>
      <div className="status-grid">
        <div className="status"><b>Soru grupları</b><span>{Object.keys(man.curriculum).length} seviye</span></div>
        <div className="status"><b>Soru kayıtları</b><span>{man.questionCount}</span></div>
        <div className="status"><b>Supabase</b><span>{isSupabaseConfigured() ? 'Hazır' : 'Yapılandırılmadı'}</span></div>
        <div className="status"><b>Bulut</b><span>{cloudStatus}</span></div>
        <div className="status"><b>Yerel veri</b><span>{(raw.length / 1024).toFixed(1)} KB</span></div>
        <div className="status"><b>Görev / deneme</b><span>{data.tasks.length} / {data.exams.length}</span></div>
      </div>
      {!isSupabaseConfigured() ? <div className="notice" role="alert" style={{ marginTop: 12 }}>{SUPABASE_UNAVAILABLE}</div> : null}
      <div className="switch">
        <div>
          <b>Güvenlik</b>
          <br />
          <small className="muted">Model anahtarı tarayıcıda yok. Şifre değişimi Hesabım’da. Çıkış tüm cihazları kapatır.</small>
        </div>
        {user ? (
          <button className="btn secondary" type="button" onClick={() => go('account')}>Hesabım</button>
        ) : (
          <button className="btn primary" type="button" onClick={() => go('account')}>Giriş</button>
        )}
      </div>
      <div className="switch">
        <div><b>Koyu tema</b><br /><small className="muted">Gece görünümü</small></div>
        <button className={`toggle ${theme === 'dark' ? 'on' : ''}`} type="button" aria-pressed={theme === 'dark'} aria-label="Koyu tema" onClick={toggleTheme}><i /></button>
      </div>
      <div className="switch">
        <div><b>Verileri sıfırla</b><br /><small className="muted">Bu cihazdaki görev, deneme ve süre kayıtlarını siler.</small></div>
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
