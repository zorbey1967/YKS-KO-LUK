import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { COACH_TRACKS, compressCoachPhoto, type CoachTrack } from '../lib/coaches';
import { submitCoachApplication } from '../lib/cloudPlatform';
import { getPersonDisplayName } from '../lib/displayName';

/** Giriş ekranında "Koç olarak gir" seçip koç kaydı olmayan (veya reddedilen) hesabın başvuru formu. */
export function CoachApplyCard({ reapply = false }: { reapply?: boolean }) {
  const { user, profile, toast, refreshAuth } = useApp();
  const [track, setTrack] = useState<CoachTrack>('YKS Sayısal');
  const [studentCount, setStudentCount] = useState('0');
  const [focus, setFocus] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const name = getPersonDisplayName(profile?.name, '');

  async function onPhoto(file?: File) {
    if (!file) return;
    try {
      setPhoto(await compressCoachPhoto(file));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fotoğraf yüklenemedi.');
    }
  }

  async function submit() {
    if (!user || busy) return;
    if (name.length < 3) return setMsg('Hesabında ad ve soyad yok; başvuru için gerekli.');
    if (!photo.startsWith('data:image/')) return setMsg('Koç fotoğrafı gerekli.');
    setBusy(true);
    setMsg('');
    const res = await submitCoachApplication({
      userId: user.id,
      name,
      email: user.email || '',
      track,
      focus: focus.trim() || 'Süreç koçluğu',
      photo,
      studentCount: Number(studentCount) || 0,
    });
    setBusy(false);
    if (!res.ok) return setMsg(res.error || 'Başvuru gönderilemedi. Tekrar dene.');
    setDone(true);
    toast('Koç başvurun alındı');
    await refreshAuth();
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title">
        <h3>{reapply ? 'Koç başvurusunu yeniden gönder' : 'Koç başvurusu'}</h3>
      </div>
      {done || profile?.coach_status === 'pending' ? (
        <div className="success" role="status">
          Başvurun alındı. Yönetici onaylayınca çıkış yapıp girişte "Koç olarak gir" seçerek koç paneline girebilirsin.
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <p className="muted" style={{ marginTop: 0 }}>
            {reapply
              ? 'Önceki başvurun kabul edilmedi. Bilgilerini güncelleyip yeniden gönderebilirsin.'
              : 'Bu hesapta koç kaydı yok. Koç olarak çalışmak için başvur; öğrenci tarafın aynen kalır.'}
          </p>
          <div className="form-grid">
            <div className="field"><label>Ad soyad</label><input value={name} readOnly /></div>
            <div className="field">
              <label>Branş</label>
              <select value={track} onChange={(e) => setTrack(e.target.value as CoachTrack)}>
                {COACH_TRACKS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Kaç öğrencin var?</label><input type="number" min={0} max={500} value={studentCount} onChange={(e) => setStudentCount(e.target.value)} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Uzmanlık</label><input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="TYT tempo, deneme analizi…" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Fotoğraf</label>
              <input type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
              {photo ? (
                <div className="subject" style={{ marginTop: 8 }}>
                  <div className="subject-icon" style={{ overflow: 'hidden', padding: 0 }}>
                    <img src={photo} alt="" width={42} height={42} style={{ width: 42, height: 42, objectFit: 'cover' }} />
                  </div>
                  <span>Önizleme</span>
                </div>
              ) : <p className="muted" style={{ margin: '8px 0 0' }}>Koçlar listesinde görünecek.</p>}
            </div>
          </div>
          <div className="actions">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Gönderiliyor…' : 'Başvuruyu gönder'}</button>
          </div>
          {msg ? <div className="notice" style={{ marginTop: 12 }} role="alert">{msg}</div> : null}
        </form>
      )}
    </div>
  );
}
