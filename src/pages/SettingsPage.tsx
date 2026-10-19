import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { loadManifest } from '../lib/bank';
import { QUESTION_BANK_ENABLED } from '../lib/features';
import { SUPABASE_UNAVAILABLE, isSupabaseConfigured } from '../lib/supabase';
import { emptyData } from '../lib/types';
import { storageKey } from '../lib/storage';

export function SettingsPage() {
  const { data, setData, toast, theme, toggleTheme, user, cloudStatus, go } = useApp();
  const [man, setMan] = useState<{ questionCount: number; curriculum: Record<string, unknown> } | null>(null);
  useEffect(() => {
    // Soru bankası kapalıyken her Ayarlar açılışında bank-pack çağrılmaz.
    if (!QUESTION_BANK_ENABLED) return;
    void loadManifest().then((m) => setMan(m)).catch(() => setMan({ questionCount: 0, curriculum: {} }));
  }, []);
  const raw = (() => {
    try { return localStorage.getItem(storageKey(user?.id)) || ''; } catch { return ''; }
  })();

  return (
    <>
      <div className="card">
      <div className="section-title"><h3>Ayarlar</h3></div>
      <p className="muted">Bu cihazdaki kayıt boyutu ve bağlantı durumu. Model anahtarı tarayıcıda tutulmaz.</p>
      <div className="status-grid">
        {QUESTION_BANK_ENABLED ? (
          <>
            <div className="status"><b>Soru grupları</b><span>{man ? Object.keys(man.curriculum).length : '—'} seviye</span></div>
            <div className="status"><b>Soru kayıtları</b><span>{man ? man.questionCount : '—'}</span></div>
          </>
        ) : null}
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
