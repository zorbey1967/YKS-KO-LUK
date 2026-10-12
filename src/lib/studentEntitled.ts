/** Mirrors public.student_entitled in 019/020. Client UI must not be the access gate. */

export type EntitlementProfile = {
  role?: string | null;
  account_status?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
};

export function studentEntitled(input: {
  callerId: string | null | undefined;
  pId: string | null | undefined;
  profile: EntitlementProfile | null;
  now?: Date;
}): boolean {
  const { callerId, pId, profile } = input;
  const now = input.now ?? new Date();
  if (!pId || !callerId) return false;
  if (pId !== callerId) return false;
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'coach') return true;
  if (profile.account_status !== 'active') return false;
  const status = profile.subscription_status;
  if (status == null || status === 'none') return false;
  if (status === 'trialing') {
    if (!profile.trial_ends_at) return false;
    const t = new Date(profile.trial_ends_at).getTime();
    return Number.isFinite(t) && t > now.getTime();
  }
  if (status === 'active') {
    if (!profile.subscription_ends_at) return true;
    const t = new Date(profile.subscription_ends_at).getTime();
    return Number.isFinite(t) && t > now.getTime();
  }
  return false;
}
