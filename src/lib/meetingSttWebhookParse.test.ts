import { describe, expect, it } from 'vitest';
import {
  parseSttWebhookBody,
  voiceEnforcementEnabled,
  timingSafeEqualHex,
} from '../../supabase/functions/_shared/meetingSttWebhook.ts';

describe('parseSttWebhookBody', () => {
  const base = {
    event_id: 'evt-1',
    appointment_id: 'appt_abc',
    speaker_user_id: '11111111-1111-4111-8111-111111111111',
    stt_confidence: 0.95,
    snippet: 'kötü söz',
  };

  it('geçerli payload kabul eder', () => {
    const r = parseSttWebhookBody(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.event_id).toBe('evt-1');
  });

  it('sahte transcript / text alanını reddeder', () => {
    expect(parseSttWebhookBody({ ...base, transcript: 'amk' }).ok).toBe(false);
    expect(parseSttWebhookBody({ ...base, text: 'amk' }).ok).toBe(false);
    expect(parseSttWebhookBody({ ...base, full_text: 'amk' }).ok).toBe(false);
  });

  it('başka konuşmacı UUID formatı dışı reddeder', () => {
    expect(parseSttWebhookBody({ ...base, speaker_user_id: 'not-a-uuid' }).ok).toBe(false);
  });

  it('120 karakterden uzun snippet reddeder', () => {
    expect(parseSttWebhookBody({ ...base, snippet: 'x'.repeat(121) }).ok).toBe(false);
  });
});

describe('voiceEnforcementEnabled', () => {
  it('provider+secret+enforce=1 olmadan kapalı', () => {
    expect(voiceEnforcementEnabled({ provider: '', secret: 's', enforce: '1' })).toBe(false);
    expect(voiceEnforcementEnabled({ provider: 'deepgram', secret: '', enforce: '1' })).toBe(false);
    expect(voiceEnforcementEnabled({ provider: 'deepgram', secret: 's', enforce: '0' })).toBe(false);
    expect(voiceEnforcementEnabled({ provider: 'deepgram', secret: 's', enforce: '1' })).toBe(true);
  });
});

describe('timingSafeEqualHex', () => {
  it('eşit / eşitsiz', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
  });
});
