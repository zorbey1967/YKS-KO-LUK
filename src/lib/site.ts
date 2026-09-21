/** Canonical live origin. Do not invent a custom domain. */
export const SITE_ORIGIN = 'https://e-kocluk.vercel.app';
export const SITE_NAME = 'Öğrenci E-Koçluk';
export const SITE_DESCRIPTION =
  'YKS ve okul için e-koçluk paneli: hedef, program, deneme, net hesabı ve soru bankası. Ücretsiz kayıt; kart çekilmez.';

export async function copySiteUrl() {
  try {
    await navigator.clipboard.writeText(SITE_ORIGIN);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = SITE_ORIGIN;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
