/** 032 toplu kapatma. E-posta yok. Sahip UUID + aktif profil + son yönetici aynı kapı. */

export type DisableProfile = {
  id: string;
  role: string;
  account_status: string;
};

export type DisableCoach = {
  user_id: string;
  status: string;
};

export type DisableInventory = {
  total_profiles: number;
  appointment_count: number;
  meeting_count: number;
  payment_count: number;
  coach_rows: number;
};

export const DISABLE_COUNT_KEYS = [
  'total_profiles',
  'would_suspend_profiles',
  'would_pasif_coaches',
  'coach_rows',
  'appointment_count',
  'meeting_count',
  'payment_count',
] as const;

export function disableCountsMatch(
  actual: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown> | null | undefined,
) {
  if (!actual || !expected) return false;
  return DISABLE_COUNT_KEYS.every((k) => String(actual[k] ?? '') === String(expected[k] ?? ''));
}

export function canDisableWithExpect(
  preview: { skipped?: boolean } & Record<string, unknown>,
  expected: Record<string, unknown> | null | undefined,
) {
  if (!expected) return { ok: false as const, reason: 'beklenen sayılar yok; toplu kapatma yok' };
  if (preview.skipped) return { ok: false as const, reason: 'önizleme skip; toplu kapatma yok' };
  if (!disableCountsMatch(preview, expected)) {
    return { ok: false as const, reason: 'beklenen sayılar eşleşmedi; toplu kapatma yok' };
  }
  return { ok: true as const, reason: 'ok' };
}

const EMPTY_REASON = 'platform_owner boş; toplu kapatma yok';
const PASSIVE_REASON = 'aktif sahip profili yok; toplu kapatma yok';
const UUID_REASON = 'sahip UUID doğrulanamadı; toplu kapatma yok';

export type OwnerConfirmReason = 'empty' | 'uuid' | 'passive' | 'ok';

export function ownerConfirmReason(
  ownerIds: string[],
  confirmId: string | null | undefined,
  profiles: DisableProfile[],
): OwnerConfirmReason {
  const owners = [...new Set(ownerIds.filter(Boolean))];
  if (owners.length === 0) return 'empty';
  const id = String(confirmId || '').trim();
  if (!id || !owners.includes(id)) return 'uuid';
  const row = profiles.find((p) => p.id === id);
  if (!row || row.account_status !== 'active') return 'passive';
  return 'ok';
}

export function confirmOwnerUuid(ownerIds: string[], confirmId: string | null | undefined) {
  return ownerConfirmReason(ownerIds, confirmId, ownerIds.map((id) => ({
    id,
    role: 'admin',
    account_status: 'active',
  }))) === 'ok';
}

export function keepIdsForDisable(profiles: DisableProfile[], ownerIds: string[]) {
  const owners = [...new Set(ownerIds.filter(Boolean))];
  if (owners.length === 0) {
    return { skip: true as const, keep: [] as string[], reason: EMPTY_REASON };
  }
  const activeOwner = profiles.some((p) => owners.includes(p.id) && p.account_status === 'active');
  if (!activeOwner) {
    return { skip: true as const, keep: [] as string[], reason: PASSIVE_REASON };
  }
  const keep = new Set(owners);
  const ownerIsActiveAdmin = profiles.some(
    (p) => keep.has(p.id) && p.role === 'admin' && p.account_status === 'active',
  );
  if (!ownerIsActiveAdmin) {
    const lastAdmin = profiles.find(
      (p) => p.role === 'admin' && p.account_status === 'active' && !keep.has(p.id),
    );
    if (lastAdmin) keep.add(lastAdmin.id);
  }
  return { skip: false as const, keep: [...keep], reason: 'ok' };
}

export function profilesToSuspend(
  profiles: DisableProfile[],
  ownerIds: string[],
  confirmId?: string | null,
) {
  const gate = ownerConfirmReason(ownerIds, confirmId ?? ownerIds[0] ?? '', profiles);
  if (gate !== 'ok') {
    const reason = gate === 'empty' ? EMPTY_REASON : gate === 'passive' ? PASSIVE_REASON : UUID_REASON;
    return { skipped: true as const, ids: [] as string[], keep: [] as string[], reason };
  }
  const plan = keepIdsForDisable(profiles, ownerIds);
  if (plan.skip) return { skipped: true as const, ids: [] as string[], keep: plan.keep, reason: plan.reason };
  const ids = profiles
    .filter((p) => p.account_status !== 'pasif' && !plan.keep.includes(p.id))
    .map((p) => p.id);
  return { skipped: false as const, ids, keep: plan.keep, reason: plan.reason };
}

export function previewDisable(input: {
  profiles: DisableProfile[];
  ownerIds: string[];
  confirmId: string | null;
  coaches: DisableCoach[];
  inventory: DisableInventory;
}) {
  const base = {
    ...input.inventory,
    appointments_preserved: true,
    meetings_preserved: true,
    payments_preserved: true,
    deleted: false,
  };
  const gate = ownerConfirmReason(input.ownerIds, input.confirmId, input.profiles);
  if (gate !== 'ok') {
    return {
      ...base,
      skipped: true as const,
      would_suspend_profiles: 0,
      would_pasif_coaches: 0,
      keep_profiles: 0,
      reason: gate === 'empty' ? EMPTY_REASON : gate === 'passive' ? PASSIVE_REASON : UUID_REASON,
    };
  }
  const plan = keepIdsForDisable(input.profiles, input.ownerIds);
  if (plan.skip) {
    return {
      ...base,
      skipped: true as const,
      would_suspend_profiles: 0,
      would_pasif_coaches: 0,
      keep_profiles: 0,
      reason: plan.reason,
    };
  }
  const sus = profilesToSuspend(input.profiles, input.ownerIds, input.confirmId);
  return {
    ...base,
    skipped: false as const,
    would_suspend_profiles: sus.ids.length,
    would_pasif_coaches: coachesToPasif(input.coaches, plan.keep).length,
    keep_profiles: plan.keep.length,
    reason: 'önizleme; satır yazılmadı',
  };
}

export function coachesToPasif(coaches: DisableCoach[], keepUserIds: string[]) {
  return coaches.filter((c) => c.status === 'active' && !keepUserIds.includes(c.user_id));
}

/** FOR UPDATE / advisory lock: ikinci eşzamanlı çağrı yazmaz. */
export function disableSerialized(
  shared: { profiles: DisableProfile[]; coaches: DisableCoach[] },
  ownerIds: string[],
  confirmId: string,
  callers: number,
) {
  const results: { wrote: number }[] = [];
  for (let i = 0; i < callers; i += 1) {
    const sus = profilesToSuspend(shared.profiles, ownerIds, confirmId);
    if (sus.skipped || sus.ids.length === 0) {
      results.push({ wrote: 0 });
      continue;
    }
    const n = sus.ids.length;
    shared.profiles = shared.profiles.map((p) => (
      sus.ids.includes(p.id) ? { ...p, account_status: 'pasif' } : p
    ));
    results.push({ wrote: n });
  }
  return results;
}
