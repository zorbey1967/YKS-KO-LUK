import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { SUPABASE_UNAVAILABLE, supabase, withTimeout } from '../lib/supabase';
import { normalizeData, saveData } from '../lib/storage';
import { coachAdvice } from '../lib/coach';
import { GoalEditor } from '../components/GoalEditor';
import { COACH_TRACKS, clearCoachSession, compressCoachPhoto, registerCoach, saveCoachSession, type CoachTrack } from '../lib/coaches';
import { submitCoachApplication } from '../lib/cloudPlatform';

type AccountRole = 'ogrenci' | 'koc';

export function AccountPage() {
  const { user, profile, data, setData, authMsg, setAuthMsg, saveProfile, toast, cloudStatus, theme, toggleTheme, go, isAdmin } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile?.name || '');
  const [role, setRole] = useState<AccountRole>('ogrenci');
  const [coachTrack, setCoachTrack] = useState<CoachTrack>('YKS Sayısal');
  const [studentCount, setStudentCount] = useState('0');
  const [focus, setFocus] = useState('');
  const [photo, setPhoto] = useState('');
  const [mode, setMode] = useState<'giris' | 'kayit'>('giris');
  const [busy, setBusy] = useState(false);
  const coach = coachAdvice(data);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
    if (user?.email) setEmail(user.email);
  }, [profile?.name, user?.email]);

  useEffect(() => {
    if (!user) return;
    let raw = '';
    try { raw = localStorage.getItem('yks_pending_coach_app') || ''; } catch { return; }
    if (!raw) return;
    void (async () => {
      try {
        const p = JSON.parse(raw) as { name: string; email: string; track: CoachTrack; focus: string; photo: string; studentCount: number };
        const cloud = await submitCoachApplication({ userId: user.id, ...p });
        if (cloud.ok) {
          saveCoachSession({ coachId: cloud.id, name: p.name, email: p.email, track: p.track });
          try { localStorage.removeItem('yks_pending_coach_app'); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  async function onPhoto(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await compressCoachPhoto(file);
      setPhoto(dataUrl);
    } catch (e) {
      setAuthMsg(e instanceof Error ? e.message : 'Fotoğraf yüklenemedi.');
    }
  }

  async function applyCoach() {
    const koc = registerCoach({
      name,
      email,
      password,
      track: coachTrack,
      focus,
      photo,
      studentCount: Number(studentCount) || 0,
    });
    if (!koc.ok) {
      setAuthMsg(koc.error);
      return false;
    }
    const uid = user?.id || (await supabase?.auth.getUser())?.data.user?.id;
    const cloud = uid
      ? await submitCoachApplication({
          userId: uid,
          name: name.trim(),
          email: email.trim(),
          track: coachTrack,
          focus: focus.trim() || 'Süreç koçluğu',
          photo,
          studentCount: Number(studentCount) || 0,
        })
      : { ok: false as const, error: 'Bulut hesap yok', missing: true };
    if (cloud.ok) {
      saveCoachSession({ coachId: cloud.id, name: name.trim(), email: email.trim(), track: coachTrack });
    } else if (!uid) {
      try {
        localStorage.setItem('yks_pending_coach_app', JSON.stringify({
          name: name.trim(), email: email.trim(), track: coachTrack, focus: focus.trim() || 'Süreç koçluğu', photo, studentCount: Number(studentCount) || 0,
        }));
      } catch { /* ignore */ }
    } else if (!cloud.missing) {
      setAuthMsg(`Başvuru yerel kaydedildi; bulut: ${cloud.error}`);
      toast('Başvuru incelemede');
      go('coaches');
      return true;
    }
    setAuthMsg(uid ? 'Koç başvurun alındı. Yönetici onayından sonra listede görünür.' : 'Başvuru bu cihazda. E-posta doğrulamasından sonra buluta düşer.');
    toast('Başvuru incelemede');
    go('coaches');
    return true;
  }

  async function signUp() {
    if (!email || !password) return setAuthMsg('E-posta ve şifre gerekli.');
    if (password.length < 6) return setAuthMsg('Şifre en az 6 karakter olsun.');
    setBusy(true);
    try {
      if (role === 'koc') {
        if (name.trim().length < 2) return setAuthMsg('Koç kaydı için görünen ad gerekli.');
        if (!photo) return setAuthMsg('Koç fotoğrafı gerekli.');
        if (supabase && !user) {
          setAuthMsg('Kayıt yapılıyor…');
          try {
            const { error } = await withTimeout(supabase.auth.signUp({ email, password }));
            if (error) throw error;
          } catch (e) {
            await applyCoach();
            setAuthMsg(`Başvuru kaydedildi. Bulut hesap: ${e instanceof Error ? e.message : ''}`);
            return;
          }
        }
        await applyCoach();
        return;
      }
      if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
      setAuthMsg('Kayıt yapılıyor…');
      const { data: res, error } = await withTimeout(supabase.auth.signUp({ email, password }));
      if (error) throw error;
      if (name.trim()) void saveProfile(name.trim());
      if (res.user && !res.session) setAuthMsg('Kayıt tamam. E-posta doğrulaması açıksa gelen kutunu kontrol et.');
      else setAuthMsg('Hesabın açıldı, giriş yapıldı.');
    } catch (e) {
      setAuthMsg(`Kayıt hatası: ${e instanceof Error ? e.message : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
    if (!email || !password) return setAuthMsg('E-posta ve şifre gerekli.');
    setBusy(true);
    setAuthMsg('Giriş yapılıyor…');
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (error) throw error;
      setAuthMsg('Giriş başarılı.');
      toast('Giriş başarılı');
    } catch (e) {
      setAuthMsg(`Giriş hatası: ${e instanceof Error ? e.message : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    clearCoachSession();
    if (supabase) await supabase.auth.signOut();
    setAuthMsg('Çıkış yapıldı.');
    toast('Çıkış yapıldı');
  }

  const authAlert = authMsg ? (
    <div className={/hata/i.test(authMsg) ? 'notice' : 'success'} style={{ marginTop: 14 }} role="status">{authMsg}</div>
  ) : null;

  if (!user) {
    return (
      <div className="auth-shell">
        <section className="auth-brand">
          <div>
            <div className="eyebrow" style={{ color: '#cfe1ff' }}>Ücretsiz hesap</div>
            <h2>Çalışma panelin tek yerde.</h2>
            <p>Hedef, program, deneme, net ve soru bankası. Kart çekilmez. Koç olmak istersen aynı formdan başvurursun.</p>
            <ul>
              <li>Öğrenci ve koç aynı sitede</li>
              <li>Verin hesabına bağlı kalır</li>
              <li>E-Koç, girişten sonra sunucuya gider</li>
            </ul>
          </div>
        </section>
        <div className="card auth-card">
          <div className="auth-tabs" role="tablist">
            <button className={mode === 'giris' ? 'on' : ''} type="button" onClick={() => { setMode('giris'); setAuthMsg(''); }}>Giriş</button>
            <button className={mode === 'kayit' ? 'on' : ''} type="button" onClick={() => { setMode('kayit'); setAuthMsg(''); }}>Kayıt</button>
          </div>
          {!supabase ? <div className="notice" role="alert">{SUPABASE_UNAVAILABLE}</div> : null}
          {mode === 'kayit' ? (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Hesap türü</label>
              <div className="chip-row">
                <button className={`chip ${role === 'ogrenci' ? 'on' : ''}`} type="button" onClick={() => setRole('ogrenci')}>Öğrenci</button>
                <button className={`chip ${role === 'koc' ? 'on' : ''}`} type="button" onClick={() => setRole('koc')}>Koç başvurusu</button>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Kayıtlı e-posta ve şifrenle gir.</p>
          )}
          <div className="form-grid">
            {mode === 'kayit' ? (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>{role === 'koc' ? 'Koç adı' : 'Görünen ad'}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad soyad" autoComplete="name" />
              </div>
            ) : null}
            <div className="field"><label>E-posta</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" autoComplete="email" /></div>
            <div className="field"><label>Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'giris' ? 'current-password' : 'new-password'} /></div>
            {mode === 'kayit' && role === 'koc' ? (
              <>
                <div className="field">
                  <label>Branş</label>
                  <select value={coachTrack} onChange={(e) => setCoachTrack(e.target.value as CoachTrack)}>
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
                  ) : <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0 0' }}>Koçlar listesinde görünecek.</p>}
                </div>
              </>
            ) : null}
          </div>
          <div className="actions">
            {mode === 'giris' ? (
              <button className="btn primary" type="button" disabled={busy} onClick={() => void signIn()}>{busy ? 'Giriliyor…' : 'Giriş yap'}</button>
            ) : (
              <button className="btn primary" type="button" disabled={busy} onClick={() => void signUp()}>{busy ? 'Kaydediliyor…' : (role === 'koc' ? 'Koç olarak kayıt ol' : 'Hesap oluştur')}</button>
            )}
          </div>
          {authAlert}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="section-title"><h3>Hesabım</h3><span>{user.email}</span></div>
        <div className="status-grid">
          <div className="status"><b>Oturum</b><span>Açık</span></div>
          <div className="status"><b>Plan</b><span>{profile?.plan || 'Ücretsiz'}</span></div>
          <div className="status"><b>Puan</b><span>{profile?.score ?? 100}</span></div>
          <div className="status"><b>Veri</b><span>{cloudStatus}</span></div>
        </div>
        {isAdmin ? (
          <div className="success" style={{ marginBottom: 12 }}>
            Yönetici yetkin açık.
            <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => go('admin')}>Yönetici paneli</button>
          </div>
        ) : null}
        <div className="form-grid">
          <div className="field"><label>Görünen ad</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Plan</label><input value={profile?.plan || 'Ücretsiz'} disabled /></div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Onaylı derse ilk 10 dakikada katılmazsan randevu iptal olur ve puanın bir kez 5 düşer (taban 0). Aynı saat için farklı koçlara talep gönderebilirsin. 18 yaş altı giriş açıktır. Görüşme kaydı yoktur.</p>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => {
            void saveProfile(name);
            toast('Profil kaydedildi');
          }}>Profili kaydet</button>
          <button className="btn" type="button" onClick={() => void signOut()}>Çıkış</button>
        </div>
        {authAlert}
      </div>
      <div style={{ marginTop: 16 }}>
        <GoalEditor compact />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>🧠 Koç</h3></div>
        <div className="success">{coach.msg}</div>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>💾 Veri yedeği</h3></div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>JSON olarak dışa aktar / geri yükle. İçe aktarma mevcut yerel verinin üzerine yazar.</p>
          <div className="actions">
            <button className="btn" type="button" onClick={() => {
              const blob = new Blob([JSON.stringify({ version: 7, exportedAt: new Date().toISOString(), profile, data }, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'yks-kocluk-yedek.json';
              a.click();
            }}>⬇ Dışa aktar</button>
            <label className="btn" style={{ display: 'inline-flex' }}>
              ⬆ İçe aktar
              <input type="file" accept="application/json" hidden onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (!f) return;
                if (f.size > 15 * 1024 * 1024) return toast('Yedek çok büyük.');
                const r = new FileReader();
                r.onload = () => {
                  try {
                    const p = JSON.parse(String(r.result));
                    if (!p?.data || !Array.isArray(p.data.tasks) || !Array.isArray(p.data.sessions)) throw new Error('bozuk');
                    if (!confirm('Mevcut veriler yedekle değiştirilsin mi?')) return;
                    const next = normalizeData(p.data);
                    setData(next);
                    saveData(next, user?.id);
                    toast('Yedek yüklendi');
                  } catch {
                    toast('Geçersiz JSON');
                  }
                };
                r.readAsText(f);
              }} />
            </label>
          </div>
        </div>
        <div className="card">
          <div className="section-title"><h3>⚙ Görünüm</h3></div>
          <div className="switch"><span>Koyu tema</span><button className={`toggle ${theme === 'dark' ? 'on' : ''}`} type="button" onClick={toggleTheme}><i /></button></div>
        </div>
      </div>
    </>
  );
}
