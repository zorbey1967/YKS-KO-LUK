/** Koçlar sayfası: keşif herkese; panel aktif koç veya sunucu yöneticisi. Rol dönüşümü yok. */

export type CoachesAudience = 'guest' | 'student' | 'coach' | 'owner';

export function coachesAudience(input: {
  signedIn: boolean;
  role?: string | null;
  isAdmin?: boolean;
}): CoachesAudience {
  if (input.isAdmin) return 'owner';
  if (input.role === 'coach') return 'coach';
  if (input.signedIn) return 'student';
  return 'guest';
}

export function coachesView(audience: CoachesAudience) {
  const isCoach = audience === 'coach';
  const isOwner = audience === 'owner';
  return {
    showCoachPanel: isCoach || isOwner,
    showCoachLoginHint: audience === 'guest',
    showDirectory: !isCoach,
    /** DOM sırası: keşif, sonra kendi randevular. Koçta yalnız panel randevuları. */
    appointmentSections: (isCoach ? ['myAppointments'] : ['book', 'myAppointments']) as readonly string[],
  };
}
