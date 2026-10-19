import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  scanDisplayName,
  scanProfanityText,
  shouldAutoSuspend,
} from './contentModeration';

describe('contentModeration lexikon', () => {
  it('ağır küfürü yüksek güvenle yakalar', () => {
    const s = scanProfanityText('amk');
    expect(s.blocked).toBe(true);
    expect(s.severe).toBe(true);
    expect(shouldAutoSuspend(s)).toBe(true);
  });

  it('masum isimleri yanlış pozitif yapmaz', () => {
    expect(scanDisplayName('Ahmet', 'Yılmaz').blocked).toBe(false);
    expect(scanDisplayName('Ayşe', 'Demir').blocked).toBe(false);
    expect(scanProfanityText('psikoloji dersi').blocked).toBe(false);
    expect(scanProfanityText('klasik müzik').blocked).toBe(false);
  });

  it('belirsiz / kısa mild eşleşmede otomatik askı yok', () => {
    const mild = scanProfanityText('aq');
    if (mild.blocked) {
      expect(shouldAutoSuspend(mild)).toBe(false);
    }
  });

  it('boş veya kısa metin ceza üretmez', () => {
    expect(scanProfanityText('').blocked).toBe(false);
    expect(scanProfanityText('a').blocked).toBe(false);
  });
});

describe('050 moderation sözleşmesi', () => {
  it('ihlal tablosu RLS ve yönetici RPC; istemci confidence ile askı yok', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/050_content_moderation.sql'), 'utf8');
    expect(sql).toContain('moderation_violations');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('admin_list_moderation_violations');
    expect(sql).toContain('admin_review_moderation_violation');
    expect(sql).toContain('record_moderation_violation');
    expect(sql).toContain('moderation_target_is_admin');
    expect(sql).toContain('scan_text_profanity(p_text)');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('appeal_note');
    expect(sql).toContain('eligible_auto_suspend');
    expect(sql).toContain('auth_sync_status');
    expect(sql).not.toContain('VITE_SUPABASE_SERVICE');
    expect(sql).not.toMatch(/grant insert on table public\.moderation_violations/i);
    // İstemci RPC askı uygulamaz; edge service_role + Auth ban uygular.
    expect(sql).not.toMatch(/perform public\.admin_set_account_status/i);
    expect(sql).toContain("'suspended', false");
    const edge = readFileSync(join(process.cwd(), 'supabase/functions/content-moderate/index.ts'), 'utf8');
    expect(edge).toContain('check_name');
    expect(edge).toContain('check_voice');
    expect(edge).toContain('client_transcript_rejected');
    expect(edge).toContain('MEETING_STT_PROVIDER');
    expect(edge).toContain('MEETING_STT_WEBHOOK_SECRET');
    expect(edge).toContain('auth_ban_ok');
    expect(edge).toContain('applyAutoSuspend');
    expect(edge).toContain('revertAutoSuspend');
    expect(edge).toContain('p_text');
    expect(edge).not.toMatch(/p_kind:\s*["']voice_meeting["']/);
    const admin = readFileSync(join(process.cwd(), 'src/pages/AdminPage.tsx'), 'utf8');
    expect(admin).toContain('AI Küfür ve Uygunsuz Dil Denetimi');
    expect(admin).toContain('İhlal Kayıtları');
    expect(admin).toContain('adminListModerationViolations');
    expect(admin).toContain('adminSetAccountStatus');
  });
});

