const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailInput(email: string) {
  return email.trim().toLocaleLowerCase('en-US').slice(0, 120);
}

export function emailLooksValid(email: string) {
  const e = normalizeEmailInput(email);
  return e.length >= 6 && e.length <= 120 && EMAIL_RE.test(e) && !e.includes('..');
}

export function passwordPolicyError(password: string, kind: 'login' | 'signup' | 'change') {
  const p = password;
  if (kind === 'login') {
    if (!p || p.length < 6) return 'E-posta ve şifre gerekli.';
    if (p.length > 72) return 'Şifre çok uzun.';
    return '';
  }
  if (p.length < 8) return 'Şifre en az 8 karakter olsun.';
  if (p.length > 72) return 'Şifre en fazla 72 karakter olsun.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Şifrede harf ve rakam birlikte olsun.';
  return '';
}

/** Supabase / ağ hatalarını kullanıcıya sızdırmadan göster. */
export function publicAuthError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (/invalid login|invalid credentials|invalid_grant|wrong password/i.test(msg)) {
    return 'E-posta veya şifre hatalı.';
  }
  if (/email not confirmed|not confirmed/i.test(msg)) {
    return 'E-posta henüz doğrulanmadı. Gelen kutunu kontrol et.';
  }
  if (/bu ad veya soyad kullanılamaz/i.test(msg)) {
    return 'Bu ad veya soyad kullanılamaz. Lütfen gerçek adınızı ve soyadınızı girin.';
  }
  if (/already registered|already been registered|user already/i.test(msg)) {
    return 'Bu e-posta zaten kayıtlı. Giriş yap.';
  }
  if (/rate limit|too many|over_request/i.test(msg)) {
    return 'Çok fazla deneme. Biraz sonra tekrar dene.';
  }
  if (/weak|least 6|password should/i.test(msg)) {
    return 'Şifre yeterince güçlü değil.';
  }
  if (/network|fetch|timeout|zaman aşımı/i.test(msg)) {
    return 'Bağlantı hatası. Ağını kontrol edip yeniden dene.';
  }
  if (/provider is not enabled|unsupported provider/i.test(msg)) {
    return 'Google girişi bu ortamda yapılandırılmamış. E-posta ile devam et. Otomatik hesap birleştirme kapalıdır.';
  }
  if (/access_denied|user.?denied|cancelled|canceled/i.test(msg)) {
    return 'Google girişi iptal edildi.';
  }
  if (/redirect_uri|redirect uri/i.test(msg)) {
    return 'Google yönlendirme adresi eşleşmiyor. Site adresiyle tekrar dene.';
  }
  if (/pkce|code verifier|flow state|unable to exchange|invalid request|bad_oauth/i.test(msg)) {
    return 'Google oturumu kurulamadı. Sayfayı yenileyip yeniden dene.';
  }
  // 061: kayıtlı olmayan e-postayla ilk Google girişinde hesap açılmaz (Auth "Database error saving new user").
  if (/database error saving new user|GOOGLE_KAYIT_YOK/i.test(msg)) {
    return 'Bu e-posta ile kayıt yok. Önce Kayıt sekmesinden e-posta ile kayıt ol.';
  }
  if (/identity.*already|already linked|manual linking|multiple.*identit/i.test(msg)) {
    return 'Bu Google hesabı mevcut e-posta kaydıyla otomatik birleşmez. E-posta ile giriş yap.';
  }
  return 'İşlem tamamlanamadı. Bilgileri kontrol edip tekrar dene.';
}
