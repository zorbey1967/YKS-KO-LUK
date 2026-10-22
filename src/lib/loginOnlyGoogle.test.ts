import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatOAuthExchangeError } from './authCallback';
import { publicAuthError } from './authUi';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');

describe('kayıtlı olmayan e-postayla Google girişi (061)', () => {
  it('Auth reddi "Bu e-posta ile kayıt yok" olarak gösterilir; ham hata eklenmez', () => {
    expect(publicAuthError(new Error('Database error saving new user'))).toBe('Bu e-posta ile kayıt yok. Önce Kayıt sekmesinden e-posta ile kayıt ol.');
    expect(formatOAuthExchangeError(new Error('Database error saving new user'))).toBe('Bu e-posta ile kayıt yok. Önce Kayıt sekmesinden e-posta ile kayıt ol.');
    // Diğer hatalar eskisi gibi
    expect(publicAuthError(new Error('access_denied'))).toBe('Google girişi iptal edildi.');
  });

  it('061 yalnız yeni Google kullanıcısını, eklemeden ÖNCE reddeder', () => {
    const sql = read('supabase/migrations/061_block_new_google_signup.sql');
    expect(sql).toMatch(/before insert on auth\.users/);
    expect(sql).toMatch(/to_jsonb\(new\)->'raw_app_meta_data'->>'provider'/);
    expect(sql).toMatch(/= 'google'/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path to ''/);
    expect(sql).not.toMatch(/delete from|drop table|truncate/i);
    expect(read('supabase/live/apply_060_061_live.sql')).toMatch(/before insert on auth\.users/);
  });

  it('kayıt ekranında Google ile Kayıt Ol yok; girişte yalnız kayıtlı e-postayla Google', () => {
    const page = read('src/pages/AccountPage.tsx');
    expect(page).not.toContain('Google ile Kayıt Ol');
    expect(page).toContain('Google ile giriş yap');
    expect(page).toContain('Kayıtlı değilsen önce Kayıt sekmesinden e-posta ile kayıt ol.');
  });
});

describe('giriş yapmamış kullanıcı yalnız giriş ekranını görür', () => {
  it('misafirde ZORRO ve destek düğmeleri yok; giriş ekranında koçlara bağlantı yok', () => {
    const app = read('src/App.tsx');
    expect(app).toMatch(/page === 'meeting' \|\| !user \? null : <CoachChat \/>/);
    expect(app).toMatch(/page === 'meeting' \|\| !user \? null : <SupportPanel \/>/);
    expect(read('src/pages/AccountPage.tsx')).not.toContain('Koçları incele');
  });

  it('Google / e-posta bağlantısı dönüşünde bir kez giriş sonrası sayfaya yönlendirilir', () => {
    const ctx = read('src/context/AppContext.tsx');
    expect(ctx).toMatch(/postLoginRedirect\.current = true;\n\s*await applySession\(oauth\.session\.user, true\);/);
    expect(ctx).toMatch(/postLoginRedirect\.current = false;\n\s*go\(isAdmin \? 'home' : postLoginPageForRole\(profile\?\.role\)\);/);
    expect(read('src/pages/AccountPage.tsx')).toMatch(/go\(postLoginPageForRole\(roleName\)\)/);
  });
});
