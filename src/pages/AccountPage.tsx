import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { SUPABASE_UNAVAILABLE, supabase, withTimeout } from '../lib/supabase';
import { normalizeData, saveData } from '../lib/storage';
import { coachAdvice } from '../lib/coach';
import { GoalEditor } from '../components/GoalEditor';
import { COACH_TRACKS, compressCoachPhoto, registerCoach, type CoachTrack } from '../lib/coaches';
import { submitCoachApplication } from '../lib/cloudPlatform';

type AccountRole = 'ogrenci' | 'koc';

export function AccountPage() {
  const { user, profile, data, setData, authMsg, setAuthMsg, saveProfile, toast, cloudStatus, theme, toggleTheme, go, isAdmin } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile?.name || '');
  const [role, setRole] = useState<AccountRole>('ogrenci');
  const [coachTrack, setCoachTrack] = useState<CoachTrack>('YKS Sayısal');
  const [studentCount, setStudentCount] = useState('8');
  const [focus, setFocus] = useState('');
  const [photo, setPhoto] = useState('');
  const coach = coachAdvice(data);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
    if (user?.email) setEmail(user.email);
  }, [profile?.name, user?.email]);

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
    if (uid) {
      const cloud = await submitCoachApplication({
        userId: uid,
        name: name.trim(),
        email: email.trim(),
        track: coachTrack,
        focus: focus.trim() || 'Süreç koçluğu',
        photo,
        studentCount: Number(studentCount) || 0,
      });
      if (!cloud.ok && !cloud.missing) setAuthMsg(`Başvuru yerel kaydedildi; bulut: ${cloud.error}`);
    }
    setAuthMsg('Koç başvurun alındı. Yönetici onayından sonra listede görünür.');
    toast('Başvuru incelemede');
    go('coaches');
    return true;
  }

  async function signUp() {
    if (!email || !password) return setAuthMsg('E-posta ve şifre gerekli.');
    if (role === 'koc') {
      if (name.trim().length < 2) return setAuthMsg('Koç kaydı için görünen ad gerekli.');
      if (!photo) return setAuthMsg('Koç fotoğrafı gerekli.');
      if (supabase && !user) {
        setAuthMsg('Kayıt yapılıyor…');
        try {
          const { error } = await withTimeout(supabase.auth.signUp({ email, password }));
          if (error) throw error;
        } catch (e) {
          applyCoach();
          setAuthMsg(`Başvuru kaydedildi. Bulut hesap: ${e instanceof Error ? e.message : ''}`);
          return;
        }
      }
      await applyCoach();
      return;
    }
    if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
    setAuthMsg('Kayıt yapılıyor…');
    try {
      const { data: res, error } = await withTimeout(supabase.auth.signUp({ email, password }));
      if (error) throw error;
      if (name.trim()) void saveProfile(name.trim());
      if (res.user && !res.session) setAuthMsg('Kayıt tamam. E-posta doğrulaması açıksa gelen kutunu kontrol et.');
      else setAuthMsg('Öğrenci hesabı oluşturuldu ve giriş yapıldı.');
    } catch (e) {
      setAuthMsg(`Kayıt hatası: ${e instanceof Error ? e.message : ''}`);
    }
  }

  async function signIn() {
    if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
    if (!email || !password) return setAuthMsg('E-posta ve şifre gerekli.');
    setAuthMsg('Giriş yapılıyor…');
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (error) throw error;
      setAuthMsg('Giriş başarılı.');
      toast('Giriş başarılı');
    } catch (e) {
      setAuthMsg(`Giriş hatası: ${e instanceof Error ? e.message : ''}`);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setAuthMsg('Çıkış yapıldı.');
    toast('Çıkış yapıldı');
  }

  return (
    <>
      <div className="card">
        <div className="section-title"><h3>👤 Hesabım</h3><span>Supabase Auth</span></div>
        <div className="notice">Kayıtta önce rolünü seç: öğrenci veya koç. Koç seçersen branş, öğrenci sayısı ve fotoğraf istenir; profil Koçlar listesine düşer.</div>
        {!supabase ? <div className="notice" role="alert">{SUPABASE_UNAVAILABLE}</div> : null}
        <div className="status-grid">
          <div className="status"><b>Oturum</b><span>{user ? 'Giriş yapıldı' : 'Giriş yapılmadı'}</span></div>
          <div className="status"><b>Profil</b><span>{profile ? 'Hazır' : 'Eksik'}</span></div>
          <div className="status"><b>Veri</b><span>{cloudStatus}</span></div>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Hesap türü</label>
          <div className="chip-row">
            <button className={`chip ${role === 'ogrenci' ? 'on' : ''}`} type="button" onClick={() => setRole('ogrenci')}>Öğrenci</button>
            <button className={`chip ${role === 'koc' ? 'on' : ''}`} type="button" onClick={() => setRole('koc')}>Koç olmak istiyorum</button>
          </div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Hesap e-postası</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" /></div>
          <div className="field"><label>Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {role === 'koc' ? (
            <>
              <div className="field"><label>Koç adı</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad soyad" /></div>
              <div className="field">
                <label>Branş</label>
                <select value={coachTrack} onChange={(e) => setCoachTrack(e.target.value as CoachTrack)}>
                  {COACH_TRACKS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>Kaç öğrencin var?</label><input type="number" min={0} max={500} value={studentCount} onChange={(e) => setStudentCount(e.target.value)} /></div>
              <div className="field"><label>Uzmanlık</label><input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="TYT tempo, deneme analizi…" /></div>
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
          <button className="btn primary" type="button" onClick={() => void signUp()}>{role === 'koc' ? '📝 Koç olarak kayıt ol' : '📝 Kayıt ol'}</button>
          <button className="btn secondary" type="button" onClick={() => void signIn()}>🔑 Giriş yap</button>
          <button className="btn" type="button" onClick={() => void signOut()}>Çıkış yap</button>
        </div>
        {authMsg ? <div className={authMsg.includes('hata') || authMsg.includes('Hata') ? 'notice' : 'success'} style={{ marginTop: 12 }}>{authMsg}</div> : null}
        {isAdmin ? (
          <div className="success" style={{ marginTop: 12 }}>
            Yönetici yetkin açık.
            <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => go('admin')}>Yönetici paneli</button>
          </div>
        ) : null}
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '20px 0' }} />
        <div className="form-grid">
          <div className="field"><label>Görünen ad (hesap)</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Plan</label><input value={profile?.plan || 'Ücretsiz'} disabled /></div>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => {
            void saveProfile(name);
            toast('Profil kaydedildi');
          }}>💾 Profili kaydet</button>
        </div>
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
