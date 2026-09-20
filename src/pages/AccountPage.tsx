import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase, withTimeout } from '../lib/supabase';
import { normalizeData, saveData } from '../lib/storage';
import { coachAdvice } from '../lib/coach';
import { GoalEditor } from '../components/GoalEditor';

export function AccountPage() {
  const { user, profile, data, setData, authMsg, setAuthMsg, saveProfile, toast, cloudStatus, theme, toggleTheme } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile?.name || '');
  const coach = coachAdvice(data);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
    if (user?.email) setEmail(user.email);
  }, [profile?.name, user?.email]);

  async function signUp() {
    if (!supabase) return setAuthMsg('Bulut giriş sistemi yüklenemedi.');
    if (!email || !password) return setAuthMsg('E-posta ve şifre gerekli.');
    setAuthMsg('Kayıt yapılıyor…');
    try {
      const { data: res, error } = await withTimeout(supabase.auth.signUp({ email, password }));
      if (error) throw error;
      if (res.user && !res.session) setAuthMsg('Kayıt tamam. E-posta doğrulaması açıksa gelen kutunu kontrol et.');
      else setAuthMsg('Hesap oluşturuldu ve giriş yapıldı.');
    } catch (e) {
      setAuthMsg(`Kayıt hatası: ${e instanceof Error ? e.message : ''}`);
    }
  }

  async function signIn() {
    if (!supabase) return setAuthMsg('Bulut giriş sistemi yüklenemedi.');
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
        <div className="notice">Tek uygulama, çok öğrenci: e-posta ile kayıt ol. Şifre burada saklanmaz (Supabase). Giriş yapınca görevlerin ve koçun senin hesabına bağlanır.</div>
        <div className="status-grid">
          <div className="status"><b>Oturum</b><span>{user ? 'Giriş yapıldı' : 'Giriş yapılmadı'}</span></div>
          <div className="status"><b>Profil</b><span>{profile ? 'Hazır' : 'Eksik'}</span></div>
          <div className="status"><b>Veri</b><span>{cloudStatus}</span></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Hesap e-postası</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" /></div>
          <div className="field"><label>Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => void signUp()}>📝 Kayıt ol</button>
          <button className="btn secondary" type="button" onClick={() => void signIn()}>🔑 Giriş yap</button>
          <button className="btn" type="button" onClick={() => void signOut()}>Çıkış yap</button>
        </div>
        {authMsg ? <div className={authMsg.includes('hata') || authMsg.includes('Hata') ? 'notice' : 'success'} style={{ marginTop: 12 }}>{authMsg}</div> : null}
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
