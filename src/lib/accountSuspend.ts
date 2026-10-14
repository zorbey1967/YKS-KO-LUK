export type AccountLifecycleStatus = 'active' | 'pasif';

export type SuspendGuardInput = {
  actorId: string;
  targetId: string;
  targetRole: string;
  nextStatus: AccountLifecycleStatus;
  activeAdminCount: number;
  targetIsPlatformOwner?: boolean;
};

/** Sunucu RPC ile aynı kurallar; istemci yalnızca ön kontrol. */
export function suspendGuard(input: SuspendGuardInput): { ok: true } | { ok: false; reason: string } {
  if (!input.actorId || !input.targetId) return { ok: false, reason: 'kimlik gerekli' };
  if (input.nextStatus !== 'active' && input.nextStatus !== 'pasif') {
    return { ok: false, reason: 'geçersiz durum' };
  }
  if (input.nextStatus === 'pasif') {
    if (input.actorId === input.targetId) {
      return { ok: false, reason: 'kendi hesabını askıya alamazsın' };
    }
    if (input.targetIsPlatformOwner) {
      return { ok: false, reason: 'platform sahibi askıya alınamaz' };
    }
    if (input.targetRole === 'admin' && input.activeAdminCount <= 1) {
      return { ok: false, reason: 'son aktif yönetici askıya alınamaz' };
    }
  }
  return { ok: true };
}

export function authBanDuration(status: AccountLifecycleStatus) {
  return status === 'pasif' ? '876000h' : 'none';
}

export function accountEventAction(status: AccountLifecycleStatus) {
  return status === 'pasif' ? 'suspend' : 'reactivate';
}
