import { describe, expect, it } from 'vitest';
import { formatZoroHtml, sanitizeZoroReply, stripProviderNames } from './zoroText';

describe('ZORRO çıktı güvenliği', () => {
  it('HTML/script etiketlerini kaçırır', () => {
    const html = formatZoroHtml('<script>alert(1)</script> merhaba');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('sağlayıcı adlarını ve iç JSON sızıntısını basmaz', () => {
    expect(stripProviderNames('Google Gemini yardımcı')).toMatch(/ZORRO/i);
    const hidden = sanitizeZoroReply('{"reply":"ok","tutorContext":"gizli"}');
    expect(hidden.toLowerCase()).not.toContain('tutorcontext');
  });
});
