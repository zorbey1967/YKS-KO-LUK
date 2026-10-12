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
      const ans = await askCoach('Selam. Bir cümleyle kim olduğunu söyle.', data, []);
      if (ans.source === 'ai') {
        setLog(ans.text.slice(0, 280));
        toast('Zorro bağlandı.');
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
        <h3>ZORRO</h3>
        <span>{user ? 'Sunucu koçu (girişli)' : 'Giriş gerekli'}</span>
      </div>
      <p className="muted">
        Zorro yalnızca hesabınla sunucuya gider. Anahtar tarayıcıda tutulmaz.
        {!user ? ' Çalışması için önce Hesabım’dan giriş yap.' : ' Sohbet, plan ve program bu oturumla çalışır.'}
      </p>
      {log ? <div className={log.includes('bağlanamadı') || log.includes('gerekli') || log.includes('yanıt') ? 'notice' : 'success'} style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{log}</div> : null}
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
