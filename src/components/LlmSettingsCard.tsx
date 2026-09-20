import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { askCoach } from '../lib/coachAi';

export function LlmSettingsCard() {
  const { data, toast, user, go } = useApp();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');

  async function test() {
    setBusy(true);
    setLog('');
    try {
      const ans = await askCoach('Selam. Bir cümleyle kim olduğunu söyle. Gerçek bir dil modeli olduğunu belirt.', data, []);
      if (ans.source === 'ai') {
        setLog(ans.text.slice(0, 280));
        toast(`Bağlandı: ${ans.model || 'model'}`);
      } else {
        setLog(ans.error || ans.text.slice(0, 280));
        toast('Sunucu koçu yanıt vermedi. Giriş ve deploy kontrol et.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title">
        <h3>🧠 Gerçek yapay zeka</h3>
        <span>{user ? 'Sunucu koçu (girişli)' : 'Giriş gerekli'}</span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
        E-Koç yalnızca hesabınla <b>student-ai</b> sunucusuna gider. Model anahtarı tarayıcıda veya ayarlarda tutulmaz.
        {!user ? ' Gerçek model için önce Hesabım’dan giriş yap.' : ' Sohbet, plan ve program bu oturumla çalışır.'}
      </p>
      {log ? <div className={log.includes('bağlanamadı') || log.includes('gerekli') ? 'notice' : 'success'} style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{log}</div> : null}
      <div className="actions">
        {user ? (
          <button className="btn primary" type="button" disabled={busy} onClick={() => void test()}>{busy ? 'Deniyor…' : 'Bağlantıyı dene'}</button>
        ) : (
          <button className="btn primary" type="button" onClick={() => go('account')}>Hesabım’a git</button>
        )}
      </div>
    </div>
  );
}
