import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COACH_TRACKS, compressCoachPhoto, type CoachTrack } from '../lib/coaches';
import { submitCoachApplication } from '../lib/cloudPlatform';
import { COACH_GATE_APPLIED_MSG, endIsolatedSession } from '../lib/coachLoginGate';

/**
 * Giriş ekranında, uygulamaya girmeden koç başvurusu. Geçici oturumla gönderilir;
 * gönderim veya vazgeçince geçici oturum kapanır. Koç paneli yönetici onayından sonra açılır.
 */
export function CoachApplyCard({
  client,
  userId,
  email,
  name,
  reapply = false,
  onClose,
}: {
  client: SupabaseClient;
  userId: string;
  email: string;
  name: string;
  reapply?: boolean;
  onClose: (message: string) => void;
}) {
  const [track, setTrack] = useState<CoachTrack>('YKS Sayısal');
  const [studentCount, setStudentCount] = useState('0');
  const [focus, setFocus] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function onPhoto(file?: File) {
    if (!file) return;
    try {
      setPhoto(await compressCoachPhoto(file));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fotoğraf yüklenemedi.');
    }
  }

  async function submit() {
    if (busy) return;
    if (name.length < 3) return setMsg('Hesabında ad ve soyad yok; başvuru için gerekli.');
    if (!photo.startsWith('data:image/')) return setMsg('Koç fotoğrafı gerekli.');
    setBusy(true);
    setMsg('');
    const res = await submitCoachApplication({
      userId,
      name,
      email,
      track,
      focus: focus.trim() || 'Süreç koçluğu',
      photo,
      studentCount: Number(studentCount) || 0,
    }, client);
    if (!res.ok) {
      setBusy(false);
      return setMsg(res.error || 'Başvuru gönderilemedi. Tekrar dene.');
    }
    await endIsolatedSession(client);
    setBusy(false);
    onClose(COACH_GATE_APPLIED_MSG);
  }

  async function cancel() {
    await endIsolatedSession(client);
    onClose('');
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        <h3>{reapply ? 'Koç başvurusunu yeniden gönder' : 'Koç başvurusu'}</h3>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {reapply
          ? 'Önceki koç başvurun kabul edilmedi. Bilgilerini güncelleyip yeniden gönderebilirsin.'
          : 'Bu hesapta koç kaydı yok. Koç olarak girebilmek için başvur; yönetici onaylayınca "Koç olarak gir" ile girersin.'}
      </p>
      <div className="form-grid">
        <div className="field"><label>Ad soyad</label><input value={name} readOnly /></div>
        <div className="field"><label>E-posta</label><input value={email} readOnly /></div>
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
        <button className="btn" type="button" disabled={busy} onClick={() => void cancel()}>Vazgeç</button>
      </div>
      {msg ? <div className="notice" style={{ marginTop: 12 }} role="alert">{msg}</div> : null}
    </form>
  );
}
