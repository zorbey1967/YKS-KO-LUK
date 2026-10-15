export type TrialProfile = {
  accountActive: boolean;
  role?: string;
  signedIn?: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
};

export type TrialResult = {
  ok: boolean;
  status: string;
  message: string;
  wrote: boolean;
};

/** start_top_plan_trial SQL ile aynı durum makinesi (sunucu saati `now`). */
export function startTopPlanTrialStep(row: TrialProfile, now: number): { row: TrialProfile; result: TrialResult } {
  if (row.signedIn === false) {
    return { row, result: { ok: false, status: 'blocked', message: 'oturum gerekli', wrote: false } };
  }
  if (!row.accountActive) {
    return { row, result: { ok: false, status: 'blocked', message: 'hesap askıda', wrote: false } };
  }
  const role = row.role || 'student';
  if (role === 'coach') {
    return { row, result: { ok: false, status: 'blocked', message: 'deneme yalnızca öğrenci hesabına özel', wrote: false } };
  }
  if (role === 'admin') {
    if (row.trialStartedAt) {
      const ends = row.trialEndsAt ? Date.parse(row.trialEndsAt) : NaN;
      const open = Number.isFinite(ends) && ends > now;
      return {
        row,
        result: {
          ok: true,
          status: open ? 'trialing' : 'used',
          message: open ? 'Deneme zaten açık.' : 'Bu hesap denemeyi kullandı.',
          wrote: false,
        },
      };
    }
    return { row, result: { ok: false, status: 'blocked', message: 'deneme yalnızca öğrenci hesabına özel', wrote: false } };
  }
  if (role !== 'student') {
    return { row, result: { ok: false, status: 'blocked', message: 'deneme yalnızca öğrenci hesabına özel', wrote: false } };
  }
  if (row.subscriptionStatus === 'active' && (!row.subscriptionEndsAt || Date.parse(row.subscriptionEndsAt) > now)) {
    return { row, result: { ok: true, status: 'active', message: 'Ücretli üyelik açık; deneme gerekmez.', wrote: false } };
  }
  if (row.trialStartedAt) {
    const ends = row.trialEndsAt ? Date.parse(row.trialEndsAt) : NaN;
    const open = Number.isFinite(ends) && ends > now;
    return {
      row,
      result: {
        ok: true,
        status: open ? 'trialing' : 'used',
        message: open ? 'Deneme zaten açık.' : 'Bu hesap denemeyi kullandı.',
        wrote: false,
      },
    };
  }
  const started = new Date(now).toISOString();
  const ends = new Date(now + 14 * 86400000).toISOString();
  const next: TrialProfile = {
    ...row,
    trialStartedAt: started,
    trialEndsAt: ends,
    subscriptionStatus: 'trialing',
  };
  return {
    row: next,
    result: { ok: true, status: 'trialing', message: '14 günlük Premium deneme başladı. Ücret alınmadı.', wrote: true },
  };
}

export function interpretStartTopPlanTrialRpc(
  error: { message?: string } | null | undefined,
  data: unknown,
) {
  if (error) {
    const msg = String(error.message || '').replace(/\s+/g, ' ').trim();
    if (/could not find|does not exist|üyelik şeması|PGRST202/i.test(msg)) {
      return {
        ok: false,
        status: 'schema',
        message: 'Deneme kaydı okunamadı. Sayfayı yenile; üyelik değişmedi.',
        trialStartedAt: null as string | null,
        trialEndsAt: null as string | null,
      };
    }
    return {
      ok: false,
      status: 'error',
      message: msg || 'Deneme başlatılamadı.',
      trialStartedAt: null as string | null,
      trialEndsAt: null as string | null,
    };
  }
  const rec = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
  const status = String(rec.status || '');
  const started = rec.trial_started_at ? String(rec.trial_started_at) : null;
  const ends = rec.trial_ends_at ? String(rec.trial_ends_at) : null;
  const ok = rec.ok === true;
  return {
    ok,
    status,
    message: String(rec.message || (ok ? 'Deneme kaydı alındı.' : 'Deneme başlatılamadı.')),
    trialStartedAt: started,
    trialEndsAt: ends,
  };
}

/** FOR UPDATE + trial_started_at IS NULL: ikinci eşzamanlı yazım olmaz. */
export function startTopPlanTrialSerialized(shared: TrialProfile, now: number, callers: number) {
  const results: TrialResult[] = [];
  for (let i = 0; i < callers; i += 1) {
    const step = startTopPlanTrialStep(shared, now);
    Object.assign(shared, step.row);
    results.push(step.result);
  }
  return results;
}
