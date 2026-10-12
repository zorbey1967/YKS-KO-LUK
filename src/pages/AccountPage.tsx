import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { SUPABASE_UNAVAILABLE, supabase, withTimeout } from '../lib/supabase';
import { normalizeData, saveData } from '../lib/storage';
import { coachAdvice } from '../lib/coach';
import { GoalEditor } from '../components/GoalEditor';
import { COACH_TRACKS, clearCoachSession, compressCoachPhoto, type CoachTrack } from '../lib/coaches';
import { submitCoachApplication } from '../lib/cloudPlatform';
import { landingPageForRole } from '../lib/roleNav';
import { getCoachDisplayName, getPersonDisplayName, joinCoachName, splitPersonName } from '../lib/displayName';
import { emailLooksValid, normalizeEmailInput, passwordPolicyError, publicAuthError } from '../lib/authUi';
import { authEmailRedirectTo } from '../lib/authRedirect';
import { fullPersonName, validatePersonName } from '../lib/personName';
import { accessMessage } from '../lib/accessGate';
import { displayMembershipName } from '../lib/subscription';
import { GRADES } from '../lib/stage';
import { TRACKS } from '../lib/goal';

const SIGNUP_EXAMS = ['YKS', 'LGS', 'KPSS', 'Okul'] as const;

type AccountRole = 'ogrenci' | 'koc';

export function AccountPage() {
  const { user, profile, data, setData, authMsg, setAuthMsg, toast, cloudStatus, theme, toggleTheme, go, isAdmin, refreshAuth, accessGate } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState(() => splitPersonName(profile?.name || '').firstName);
  const [lastName, setLastName] = useState(() => splitPersonName(profile?.name || '').lastName);
  const [signupGrade, setSignupGrade] = useState('12. Sınıf');
  const [signupTrack, setSignupTrack] = useState<string>('Eşit Ağırlık');
  const [signupExam, setSignupExam] = useState<string>('YKS');
  const [role, setRole] = useState<AccountRole>('ogrenci');
  const [coachTrack, setCoachTrack] = useState<CoachTrack>('YKS Sayısal');
  const [studentCount, setStudentCount] = useState('0');
  const [focus, setFocus] = useState('');
  const [photo, setPhoto] = useState('');
  const [mode, setMode] = useState<'giris' | 'kayit' | 'sifre'>('giris');
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const coach = coachAdvice(data);

  useEffect(() => {
    if (profile?.name) {
      const parts = splitPersonName(profile.name);
      setFirstName(parts.firstName);
      setLastName(parts.lastName);
    }
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
    if (!supabase) {
      setAuthMsg(SUPABASE_UNAVAILABLE);
      return false;
    }
    if (joinCoachName(firstName, lastName).length < 3) {
      setAuthMsg('Koç kaydı için ad ve soyad gerekli.');
      return false;
    }
    const nameErr = validatePersonName(firstName, lastName);
    if (nameErr) {
      setAuthMsg(nameErr);
      return false;
    }
    if (!photo.startsWith('data:image/')) {
      setAuthMsg('Koç fotoğrafı gerekli.');
      return false;
    }
    const uid = user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) {
      setAuthMsg('Koç başvurusu için önce e-posta ile kayıt ol veya giriş yap.');
      return false;
    }
    const displayName = joinCoachName(firstName, lastName);
    const cloud = await submitCoachApplication({
      userId: uid,
      name: displayName,
      email: email.trim(),
      track: coachTrack,
      focus: focus.trim() || 'Süreç koçluğu',
      photo,
      studentCount: Number(studentCount) || 0,
    });
    if (!cloud.ok) {
      setAuthMsg(cloud.error || 'Başvuru gönderilemedi. Tekrar deneyin.');
      return false;
    }
    setAuthMsg('Koç başvurun alındı. Yönetici onayından sonra listede görünür.');
    toast('Başvuru incelemede');
    return true;
  }

  async function signUp() {
    const mail = normalizeEmailInput(email);
    if (!emailLooksValid(mail) || !password) return setAuthMsg('Geçerli e-posta ve şifre gerekli.');
    const policy = passwordPolicyError(password, 'signup');
    if (policy) return setAuthMsg(policy);
    const nameErr = validatePersonName(firstName, lastName);
    if (nameErr) return setAuthMsg(nameErr);
    if (role === 'koc' && !photo) return setAuthMsg('Koç fotoğrafı gerekli.');
    setBusy(true);
    try {
      const displayName = fullPersonName(firstName, lastName);
      const meta = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: displayName,
        intent: role === 'koc' ? 'coach' : 'student',
        grade: role === 'koc' ? '' : signupGrade,
        track: role === 'koc' ? '' : signupTrack,
        exam: role === 'koc' ? '' : signupExam,
      };
      if (role === 'koc') {
        if (supabase && !user) {
          setAuthMsg('Kayıt yapılıyor…');
          const { error } = await withTimeout(supabase.auth.signUp({
            email: mail,
            password,
            options: { data: meta, emailRedirectTo: authEmailRedirectTo(window.location.origin) },
          }));
          if (error) throw error;
        }
        await applyCoach();
        return;
      }
      if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
      setAuthMsg('Kayıt yapılıyor…');
      const { data: res, error } = await withTimeout(supabase.auth.signUp({
        email: mail,
        password,
        options: { data: meta, emailRedirectTo: authEmailRedirectTo(window.location.origin) },
      }));
      if (error) throw error;
      if (res.user && !res.session) setAuthMsg('Kayıt tamam. E-posta doğrulaması için gelen kutunu kontrol et. Doğruladıktan sonra başvurun yönetici onayına düşer.');
      else setAuthMsg('Hesabın açıldı. E-posta doğrulandıysa başvurun yönetici onayı bekler.');
    } catch (e) {
      setAuthMsg(publicAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
    const mail = normalizeEmailInput(email);
    if (!emailLooksValid(mail)) return setAuthMsg('Geçerli e-posta gerekli.');
    setBusy(true);
    setAuthMsg('İstek gönderiliyor…');
    try {
      const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: authEmailRedirectTo(window.location.origin),
      }));
      if (error) throw error;
      setAuthMsg('İstek alındı. Bu e-posta kayıtlıysa ve gönderim açıksa sıfırlama iletisi gelir.');
    } catch (e) {
      setAuthMsg(publicAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
    const mail = normalizeEmailInput(email);
    const policy = passwordPolicyError(password, 'login');
    if (!emailLooksValid(mail) || policy) return setAuthMsg(policy || 'Geçerli e-posta ve şifre gerekli.');
    setBusy(true);
    setAuthMsg('Giriş yapılıyor…');
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: mail, password }));
      if (error) throw error;
      setAuthMsg('Giriş başarılı.');
      toast('Giriş başarılı');
      await refreshAuth();
      const uid = (await supabase.auth.getUser()).data.user?.id;
      let roleName: string | undefined;
      if (uid) {
        const { data: row } = await withTimeout(supabase.from('profiles').select('role').eq('id', uid).maybeSingle());
        roleName = row && typeof row === 'object' ? String((row as { role?: string }).role || '') : '';
      }
      go(landingPageForRole(roleName));
    } catch (e) {
      setAuthMsg(publicAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    clearCoachSession();
    if (supabase) await supabase.auth.signOut({ scope: 'global' });
    setAuthMsg('Çıkış yapıldı.');
    toast('Çıkış yapıldı');
  }

  async function changePassword() {
    if (!supabase) return setAuthMsg(SUPABASE_UNAVAILABLE);
    const policy = passwordPolicyError(newPassword, 'change');
    if (policy) return setAuthMsg(policy);
    if (newPassword !== newPassword2) return setAuthMsg('Yeni şifreler eşleşmiyor.');
    setBusy(true);
    try {
      const { error } = await withTimeout(supabase.auth.updateUser({ password: newPassword }));
      if (error) throw error;
      setNewPassword('');
      setNewPassword2('');
      setAuthMsg('Şifre güncellendi.');
      toast('Şifre güncellendi');
    } catch (e) {
      setAuthMsg(publicAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  const authOk = /giriş başarılı|kayıt tamam|hesabın açıldı|şifre güncellendi|çıkış yapıldı|başvurun alındı|başvuru bu cihazda|kayıt yapılıyor|giriş yapılıyor|başvuru incelemede|e-posta doğrulandı|yönetici onay|istek alındı/i.test(authMsg);
  const authAlert = authMsg ? (
    <div className={authOk ? 'success' : 'notice'} style={{ marginTop: 14 }} role="status">{authMsg}</div>
  ) : null;

  if (!user) {
    return (
      <div className="auth-shell">
        <section className="auth-brand">
          <div>
            <div className="eyebrow" style={{ color: '#cfe1ff' }}>Öğrenci paneli</div>
            <h2>Çalışma panelin tek yerde.</h2>
            <p>Hedef, program, deneme, net ve soru bankası. 14 günlük deneme yalnızca sunucuda abonelik kaydı varsa geçerlidir; tarayıcıda başlatılmaz.</p>
            <ul>
              <li>Öğrenci ve koç aynı sitede</li>
              <li>Verin hesabına bağlı kalır</li>
              <li>ZORRO, girişten sonra sunucuya gider</li>
            </ul>
          </div>
        </section>
        <div className="card auth-card">
          <div className="auth-tabs" role="tablist">
            <button className={mode === 'giris' ? 'on' : ''} type="button" onClick={() => { setMode('giris'); setAuthMsg(''); }}>Giriş</button>
            <button className={mode === 'kayit' ? 'on' : ''} type="button" onClick={() => { setMode('kayit'); setAuthMsg(''); }}>Kayıt</button>
            <button className={mode === 'sifre' ? 'on' : ''} type="button" onClick={() => { setMode('sifre'); setAuthMsg(''); }}>Şifre sıfırla</button>
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
          ) : mode === 'sifre' ? (
            <p className="muted">Kayıtlı e-postanı yaz. İletinin gittiğini buradan doğrulamayız; gelen kutunu kontrol et.</p>
          ) : (
            <p className="muted">Kayıtlı e-posta ve şifrenle gir.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              if (mode === 'giris') void signIn();
              else if (mode === 'sifre') void requestPasswordReset();
              else void signUp();
            }}
          >
          <div className="form-grid">
            {mode === 'kayit' ? (
              <>
                <div className="field"><label>Ad</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ahmet" autoComplete="given-name" required /></div>
                <div className="field"><label>Soyad</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Yılmaz" autoComplete="family-name" required /></div>
              </>
            ) : null}
            {mode === 'kayit' && role === 'ogrenci' ? (
              <>
                <div className="field">
                  <label>Sınıf</label>
                  <select value={signupGrade} onChange={(e) => setSignupGrade(e.target.value)}>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Alan</label>
                  <select value={signupTrack} onChange={(e) => setSignupTrack(e.target.value)}>
                    {TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Sınav</label>
                  <select value={signupExam} onChange={(e) => setSignupExam(e.target.value)}>
                    {SIGNUP_EXAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </>
            ) : null}
            <div className="field"><label>E-posta</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" autoComplete="email" maxLength={120} inputMode="email" /></div>
            {mode !== 'sifre' ? (
            <div className="field"><label>Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'giris' ? 'current-password' : 'new-password'} maxLength={72} />{mode === 'kayit' ? <p className="muted" style={{ margin: '6px 0 0' }}>En az 8 karakter; harf ve rakam birlikte.</p> : null}</div>
            ) : null}
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
                  ) : <p className="muted" style={{ margin: '8px 0 0' }}>Koçlar listesinde görünecek.</p>}
                </div>
              </>
            ) : null}
          </div>
          <div className="actions">
            {mode === 'giris' ? (
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Giriliyor…' : 'Giriş yap'}</button>
            ) : mode === 'sifre' ? (
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Gönderiliyor…' : 'Sıfırlama iste'}</button>
            ) : (
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Kaydediliyor…' : (role === 'koc' ? 'Koç olarak kayıt ol' : 'Hesap oluştur')}</button>
            )}
          </div>
          </form>
          {authAlert}
        </div>
      </div>
    );
  }

  const isCoach = profile?.role === 'coach';
  const shownName = isCoach
    ? getCoachDisplayName({ name: profile?.name, firstName, lastName })
    : getPersonDisplayName(profile?.name, 'Öğrenci');
  const gateNote = accessMessage(accessGate);

  return (
    <>
      {gateNote ? <div className="notice" style={{ marginBottom: 16 }} role="status">{gateNote}</div> : null}
      <div className="card">
        <div className="section-title">
          <h3>{isCoach ? 'Koç profili' : 'Hesabım'}</h3>
          <span>{isCoach ? 'Koç' : (profile?.role === 'admin' ? 'Yönetici' : 'Öğrenci')}</span>
        </div>
        <p style={{ marginTop: 0 }}><b>{shownName}</b></p>
        <div className="status-grid">
          <div className="status"><b>Oturum</b><span>Açık</span></div>
          <div className="status"><b>E-posta</b><span>{user.email}</span></div>
          <div className="status"><b>Plan</b><span>{displayMembershipName(profile)}</span></div>
          <div className="status"><b>Veri</b><span>{cloudStatus}</span></div>
        </div>
        {isAdmin ? (
          <div className="success" style={{ marginBottom: 12 }}>
            Yönetici yetkin açık.
            <button className="btn primary" type="button" style={{ marginLeft: 8 }} onClick={() => go('admin')}>Yönetici paneli</button>
          </div>
        ) : null}
        <div className="form-grid">
          <div className="field"><label>Ad</label><input value={firstName} readOnly /></div>
          <div className="field"><label>Soyad</label><input value={lastName} readOnly /></div>
          <div className="field"><label>Plan</label><input value={displayMembershipName(profile)} disabled /></div>
        </div>
        <p className="muted">Ad ve soyad kayıtta belirlenir; hesap üzerinden değiştirilemez. E-posta yalnızca giriş içindir.</p>
        <div className="actions">
          <button className="btn" type="button" onClick={() => void signOut()}>Çıkış</button>
        </div>
        {authAlert}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Güvenlik</h3><span>Oturum bu cihazda</span></div>
        <p className="muted">
          Model anahtarı tarayıcıda tutulmaz. Çıkış tüm cihazlardaki oturumu kapatır. Görüşme kaydı yoktur.
        </p>
        <div className="form-grid">
          <div className="field"><label>Yeni şifre</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" maxLength={72} /></div>
          <div className="field"><label>Yeni şifre (tekrar)</label><input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} autoComplete="new-password" maxLength={72} /></div>
        </div>
        <div className="actions">
          <button className="btn secondary" type="button" disabled={busy} onClick={() => void changePassword()}>Şifreyi güncelle</button>
        </div>
      </div>
      {!isCoach && accessGate === 'ok' ? (
        <>
      <div style={{ marginTop: 16 }}>
        <GoalEditor compact />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><h3>Koç notu</h3></div>
        <p className="muted">{coach.msg}</p>
      </div>
        </>
      ) : null}
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>Veri yedeği</h3></div>
          <p className="muted">JSON olarak dışa aktar / geri yükle. İçe aktarma mevcut yerel verinin üzerine yazar.</p>
          <div className="actions">
            <button className="btn" type="button" onClick={() => {
              const blob = new Blob([JSON.stringify({ version: 7, exportedAt: new Date().toISOString(), profile, data }, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              const url = URL.createObjectURL(blob);
              a.href = url;
              a.download = 'yks-kocluk-yedek.json';
              a.click();
              window.setTimeout(() => URL.revokeObjectURL(url), 1500);
            }}>Dışa aktar</button>
            <label className="btn" style={{ display: 'inline-flex' }}>
              İçe aktar
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
                ev.target.value = '';
              }} />
            </label>
          </div>
        </div>
        <div className="card">
          <div className="section-title"><h3>Görünüm</h3></div>
          <div className="switch"><span>Koyu tema</span><button className={`toggle ${theme === 'dark' ? 'on' : ''}`} type="button" onClick={toggleTheme}><i /></button></div>
        </div>
      </div>
    </>
  );
}
