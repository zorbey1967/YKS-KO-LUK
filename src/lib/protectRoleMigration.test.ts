import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function sql(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('027 canlı 010 e-posta admin kapatma', () => {
  const s = sql('supabase/migrations/027_live010_no_email_admin.sql');

  it('gerçek kullanıcı e-postası taşımaz', () => {
    expect(s.toLowerCase()).not.toMatch(/@gmail\.com/);
    expect(s.toLowerCase()).not.toContain('besiroglu');
  });

  it('protect_role ve handle_new_user e-posta ile admin yapmaz', () => {
    expect(s).toContain("new.role := 'student'");
    expect(s).toContain("'student'");
    expect(s).toContain('handle_new_user');
    expect(s).not.toMatch(/lower\(coalesce\(new\.email/i);
    expect(s).toContain("when public.profiles.role = 'admin' then 'admin'");
  });

  it('anon EXECUTE daraltır; mevcut satırları silmez', () => {
    expect(s).toContain('revoke all on function public.is_admin() from public, anon');
    expect(s).toContain('revoke all on function public.protect_role() from public, anon, authenticated');
    expect(s).toContain('revoke all on function public.handle_new_user() from public, anon, authenticated');
    expect(s).toContain('appointment_bind_student');
    expect(s.toLowerCase()).not.toMatch(/\bdelete from public\.profiles\b/);
    expect(s.toLowerCase()).not.toMatch(/\btruncate\b/);
  });

  it('001–010 notu ve 023’ü yeniden yazmama notu taşır', () => {
    expect(s).toContain('001–010');
    expect(s).toContain('023’ü yeniden yazmaz');
  });

  it('011 e-posta admin’i geri getirme riskini not eder; search_path kilitlidir', () => {
    expect(s).toContain('011');
    expect(s).toContain("set search_path = ''");
    expect(sql('supabase/migrations/011_student_approval_identity.sql')).toMatch(/yusufbesiroglu357@gmail\.com/);
  });
});

describe('028 coach_directory security_invoker', () => {
  const s = sql('supabase/migrations/028_coach_directory_security_invoker.sql');

  it('PG15+ invoker seçeneği ve aynı sütun listesi', () => {
    expect(s).toContain('security_invoker = true');
    expect(s).toContain('from public.coaches');
    expect(s).toContain("status = 'active'");
    expect(s.toLowerCase()).not.toMatch(/\bdrop table\b/);
  });
});

describe('034 dizin genel kart (definer)', () => {
  const s = sql('supabase/migrations/034_coach_directory_public_cards.sql');

  it('fonksiyon search_path kilitler; görünüm yalnız kart sütunu; coaches policy yok', () => {
    expect(s).toContain("set search_path = ''");
    expect(s).toContain('security definer');
    expect(s).toContain('from public.coach_directory_cards()');
    expect(s).not.toMatch(/create policy/i);
    expect(s).not.toMatch(/c\.email|c\.score/);
    expect(s).not.toMatch(/returns table \([^)]*user_id/);
  });
});
