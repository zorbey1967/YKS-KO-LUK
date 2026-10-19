import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { submitVoiceModeration, moderationAccountMismatch } from './moderationCloud';

const root = process.cwd();

describe('istemci ses transcript reddi', () => {
  it('submitVoiceModeration ağ çağrısı yapmadan reddeder', async () => {
    const res = await submitVoiceModeration('appt-1', 'amk siktir');
    expect(res.ok).toBe(false);
    expect(res.suspended).toBe(false);
    expect(res.blocked).toBe(false);
    expect(res.rejected).toBe(true);
    expect(res.message).toMatch(/istemci|STT|kabul edilmez/i);
  });

  it('content-moderate check_voice istemci metnini 403 ile reddeder', () => {
    const edge = readFileSync(join(root, 'supabase/functions/content-moderate/index.ts'), 'utf8');
    expect(edge).toContain('check_voice');
    expect(edge).toContain('client_transcript_rejected');
    expect(edge).toContain('403');
    expect(edge).not.toMatch(/client_transcript:\s*true/);
    expect(edge).not.toMatch(/p_kind:\s*["']voice_meeting["']/);
  });

  it('050 istemci RPC voice_meeting yazamaz', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/050_content_moderation.sql'), 'utf8');
    expect(sql).toContain("p_kind = 'voice_meeting'");
    expect(sql).toContain('ses ihlali yalnızca sunucu STT');
  });
});

describe('051 STT webhook sözleşmesi', () => {
  const sql = () => readFileSync(join(root, 'supabase/migrations/051_meeting_stt_moderation.sql'), 'utf8');
  const wh = () => readFileSync(join(root, 'supabase/functions/meeting-stt-webhook/index.ts'), 'utf8');
  const shared = () => readFileSync(join(root, 'supabase/functions/_shared/meetingSttWebhook.ts'), 'utf8');

  it('idempotency tablosu ve service_role RPC', () => {
    const s = sql();
    expect(s).toContain('moderation_stt_events');
    expect(s).toContain('event_id text primary key');
    expect(s).toContain('unique_violation');
    expect(s).toContain('service_record_voice_stt_violation');
    expect(s).toContain('appointment_user_is_party');
    expect(s).toMatch(/grant execute on function public\.service_record_voice_stt_violation[\s\S]*to service_role/);
    expect(s).not.toMatch(/grant execute on function public\.service_record_voice_stt_violation[\s\S]*to authenticated/);
    expect(s).toContain('force row level security');
    expect(s).not.toContain('VITE_SUPABASE_SERVICE');
  });

  it('imza doğrulama; transcript alanı reddi; düşük güven ceza yok', () => {
    const s = shared();
    expect(s).toContain('timingSafeEqualHex');
    expect(s).toContain('hmacSha256Hex');
    expect(s).toContain('tam transcript alanı reddedildi');
    expect(s).toContain('snippet çok uzun');
    expect(s).toContain('voiceEnforcementEnabled');
    const w = wh();
    expect(w).toContain('x-meeting-stt-signature');
    expect(w).toContain('İmza geçersiz');
    expect(w).toContain('low_stt_confidence');
    expect(w).toContain('duplicate');
    expect(w).toContain('MEETING_STT_ENFORCE');
    expect(w).toContain('Auth ban başarısız; DB geri alındı');
    expect(w).toContain("role === \"admin\"");
  });

  it('otomatik askı yalnızca enforce=1 ve yüksek güven', () => {
    const w = wh();
    expect(w).toContain('voiceEnforcementEnabled');
    expect(w).toContain('eligible_auto_suspend');
    expect(w).toContain('shouldAutoSuspend');
  });
});

describe('yönetici uyumsuzluk ve senkron', () => {
  it('ihlal askıda / hesap aktif uyumsuzluğunu işaretler', () => {
    expect(moderationAccountMismatch('suspended', 'active')).toBe('viol_suspended_acct_active');
    expect(moderationAccountMismatch('restored', 'pasif')).toBe('viol_restored_acct_pasif');
    expect(moderationAccountMismatch('suspended', 'pasif')).toBe('ok');
  });

  it('Admin Askıda tut önce DB+Auth; başarı yalanı yok', () => {
    const admin = readFileSync(join(root, 'src/pages/AdminPage.tsx'), 'utf8');
    expect(admin).toContain('adminSetAccountStatus');
    expect(admin).toContain('İhlal kaydı değiştirilmedi');
    expect(admin).toContain('moderationAccountMismatch');
    expect(admin).toContain('Uyumsuz');
    const fnStart = admin.indexOf('async function reviewViolation');
    const fnBody = admin.slice(fnStart, fnStart + 1800);
    const syncIdx = fnBody.indexOf("adminSetAccountStatus(row.user_id, 'pasif')");
    const reviewIdx = fnBody.indexOf('adminReviewModerationViolation');
    expect(syncIdx).toBeGreaterThan(0);
    expect(reviewIdx).toBeGreaterThan(syncIdx);
  });
});

