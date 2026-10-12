import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData, PageId, Profile } from '../lib/types';
import { isKnownPage } from '../lib/types';
import { loadData, saveData, normalizeData, applyProfileSeed } from '../lib/storage';
import { SUPABASE_UNAVAILABLE, isSupabaseConfigured, supabase, withTimeout } from '../lib/supabase';
import { canAccessAdminPanel, fetchServerAdmin } from '../lib/admin';
import { readLocal, writeLocal } from '../lib/util';
import { coerceAppPage } from '../lib/roleNav';
import { getPersonDisplayName } from '../lib/displayName';
import { parseAccountStatus, fetchMyCoach, pushStudentData } from '../lib/cloudPlatform';
import { mergeAppData } from '../lib/syncMerge';
import { resolveAccessGate, type AccessGate } from '../lib/accessGate';

type Ctx = {
  page: PageId;
  go: (id: PageId, query?: string) => void;
  data: AppData;
  setData: (next: AppData | ((prev: AppData) => AppData)) => void;
  user: User | null;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  theme: string;
  toggleTheme: () => void;
  toast: (msg: string) => void;
  toastMsg: string;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  authMsg: string;
  setAuthMsg: (m: string) => void;
  cloudStatus: string;
  refreshAuth: () => Promise<void>;
  saveGoals: () => Promise<void>;
  isAdmin: boolean;
  accessGate: AccessGate;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp must be inside provider');
  return v;
}

function pageFromHash(): PageId {
  const raw = location.hash.replace('#/', '').replace('#', '').split('?')[0];
  if (isKnownPage(raw)) return raw;
  const path = location.pathname.replace(/^\//, '').split('/')[0];
  return isKnownPage(path) ? path : 'home';
}

function syncHashFromPath() {
  const hash = location.hash.replace('#/', '').replace('#', '').split('?')[0];
  if (isKnownPage(hash)) return;
  const path = location.pathname.replace(/^\//, '').split('/')[0];
  if (isKnownPage(path)) location.hash = `/${path}${location.search || ''}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    const name = readLocal('yks_guest_name');
    return { name, email: '', plan: '' };
  });
  const [data, setDataState] = useState<AppData>(() => loadData(null));
  const [theme, setTheme] = useState(() => readLocal('yks_theme', 'light') || 'light');
  const [toastMsg, setToastMsg] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMsg, setAuthMsg] = useState('');
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured() ? 'Giriş yok' : 'Yapılandırılmadı');
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);
  const toastTimer = useRef(0);
  const pushTimer = useRef(0);
  const cloudReady = useRef(false);
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const persistLocal = useCallback((next: AppData, uid?: string | null) => {
    saveData(next, uid ?? userRef.current?.id ?? null);
  }, []);

  const pushCloud = useCallback(async (payload: AppData) => {
    const u = userRef.current;
    if (!supabase || !u || !cloudReady.current) return;
    try {
      let body = payload;
      let res = await pushStudentData(body);
      if (!res.ok && res.missing) {
        const { error } = await supabase.from('student_data').upsert(
          { user_id: u.id, data: body, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
        setCloudStatus('Bulut senkron');
        return;
      }
      if (!res.ok && res.data) {
        body = { ...mergeAppData(body, res.data), syncRev: res.rev };
        persistLocal(body, u.id);
        setDataState(body);
        res = await pushStudentData(body);
      }
      if (res.ok) {
        const next = { ...body, syncRev: res.rev };
        persistLocal(next, u.id);
        setDataState(next);
        setCloudStatus('Bulut senkron');
        return;
      }
      setCloudStatus('Çakışma — yeniden dene');
    } catch (e) {
      setCloudStatus('Yerel (bulut yok)');
      console.warn(e);
    }
  }, [persistLocal]);

  const setData = useCallback((next: AppData | ((prev: AppData) => AppData)) => {
    setDataState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persistLocal(value);
      window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => void pushCloud(value), 700);
      return value;
    });
  }, [persistLocal, pushCloud]);

  const loadCloudProfile = useCallback(async (u: User) => {
    if (!supabase) return null;
    try {
      const { data: row, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', u.id).maybeSingle(),
      );
      if (error) throw error;
      const coach = await fetchMyCoach(u.id);
      const p: Profile = row
        ? {
            id: row.id,
            name: getPersonDisplayName(row.name, ''),
            email: row.email || u.email || '',
            plan: row.plan || '',
            role: row.role === 'admin' || row.role === 'coach' ? row.role : 'student',
            account_status: parseAccountStatus(row.account_status),
            signup_intent: row.signup_intent === 'coach' || Boolean(coach) ? 'coach' : 'student',
            signup_grade: String(row.signup_grade || ''),
            signup_track: String(row.signup_track || ''),
            signup_exam: String(row.signup_exam || ''),
            coach_status: coach?.status,
            target_department: row.target_department,
            target_rank: row.target_rank,
            score: Number.isFinite(Number(row.score)) ? Math.max(0, Math.min(100, Number(row.score))) : undefined,
            trial_started_at: 'trial_started_at' in row ? (row.trial_started_at || null) : undefined,
            trial_ends_at: 'trial_ends_at' in row ? (row.trial_ends_at || null) : undefined,
            subscription_status: 'subscription_status' in row ? (row.subscription_status ?? null) : undefined,
            subscription_started_at: 'subscription_started_at' in row ? (row.subscription_started_at || null) : undefined,
            subscription_ends_at: 'subscription_ends_at' in row ? (row.subscription_ends_at || null) : undefined,
          }
        : { id: u.id, name: '', email: u.email || '', plan: '', coach_status: coach?.status, signup_intent: coach ? 'coach' : 'student' };
      if (p.account_status === 'pasif') {
        setAuthMsg('Bu hesap pasif. Yönetici açana kadar giriş kapalı.');
        await supabase.auth.signOut();
        return;
      }
      setProfile(p);
      return p;
    } catch (e) {
      // Abonelik kolonları bilinmiyor: ücretli erişim yok (fail-closed). Rol uydurulmaz.
      setProfile({ name: '', email: u.email || '', plan: '' });
      setAuthMsg('Profil alınamadı. Yeniden dene. Üyelik doğrulanamadı; ücretli özellikler kapalı.');
      return null;
    }
  }, []);

  const pullCloud = useCallback(async (u: User, cloudProfile?: Profile | null) => {
    if (!supabase) return;
    try {
      const { data: row, error } = await supabase
        .from('student_data')
        .select('data,updated_at')
        .eq('user_id', u.id)
        .maybeSingle();
      if (error) throw error;
      let next: AppData;
      let shouldPush = false;
      const local = loadData(u.id);
      if (row?.data && typeof row.data === 'object') {
        next = mergeAppData(local, normalizeData(row.data));
      } else {
        next = local;
        shouldPush = true;
      }
      if (cloudProfile?.target_department) next = { ...next, dept: cloudProfile.target_department };
      if (cloudProfile?.target_rank != null) next = { ...next, rank: Number(cloudProfile.target_rank) };
      next = applyProfileSeed(next, cloudProfile);
      cloudReady.current = true;
      setDataState(next);
      persistLocal(next, u.id);
      if (shouldPush) void pushCloud(next);
      setCloudStatus('Bulut senkron');
    } catch {
      cloudReady.current = false;
      setCloudStatus('Bağlantı hatası');
      const local = loadData(u.id);
      setDataState(local);
      persistLocal(local, u.id);
    }
  }, [persistLocal, pushCloud]);

  const refreshAuth = useCallback(async () => {
    if (!supabase) {
      setAuthMsg(SUPABASE_UNAVAILABLE);
      setCloudStatus('Yapılandırılmadı');
      return;
    }
    const { data: sessionData } = await withTimeout(supabase.auth.getSession());
    const u = sessionData.session?.user || null;
    userRef.current = u;
    setUser(u);
    if (u) {
      const p = await loadCloudProfile(u);
      if (userRef.current?.id !== u.id) return;
      await pullCloud(u, p);
      setServerAdmin(await fetchServerAdmin());
    } else {
      setServerAdmin(null);
      setCloudStatus('Giriş yok');
      setProfile({ name: readLocal('yks_guest_name'), email: '', plan: '' });
      setDataState(loadData(null));
    }
  }, [loadCloudProfile, pullCloud]);

  const saveGoals = useCallback(async () => {
    const u = userRef.current;
    setProfile((p) => p ? {
      ...p,
      target_department: data.dept || p.target_department,
      target_rank: data.rank || p.target_rank,
    } : p);
    if (!u || !supabase) return;
    try {
      const { error } = await withTimeout(
        supabase.from('profiles').update({
          target_department: data.dept,
          target_rank: data.rank,
          updated_at: new Date().toISOString(),
        }).eq('id', u.id),
      );
      if (error) throw error;
    } catch {
      toast('Hedef yerel kaydedildi; bulut güncellenemedi.');
    }
  }, [data.dept, data.rank, toast]);

  const isAdmin = canAccessAdminPanel(user, serverAdmin);
  const accessGate = resolveAccessGate({ user, profile, isAdmin });
  const accessGateRef = useRef(accessGate);
  accessGateRef.current = accessGate;

  const go = useCallback((id: PageId, query?: string) => {
    const dest = coerceAppPage(id, profileRef.current?.role, accessGateRef.current);
    const q = query?.replace(/^\?/, '');
    location.hash = q ? `/${dest}?${q}` : `/${dest}`;
    setPage(dest);
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeLocal('yks_theme', theme);
  }, [theme]);

  useEffect(() => {
    syncHashFromPath();
    const onHash = () => {
      const raw = pageFromHash();
      const dest = coerceAppPage(raw, profileRef.current?.role, accessGateRef.current);
      if (dest !== raw) location.hash = `/${dest}`;
      setPage(dest);
    };
    window.addEventListener('hashchange', onHash);
    void refreshAuth();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      const u = session?.user || null;
      userRef.current = u;
      setUser(u);
      if (!u) {
        cloudReady.current = false;
        setCloudStatus(isSupabaseConfigured() ? 'Giriş yok' : 'Yapılandırılmadı');
        setProfile({ name: readLocal('yks_guest_name'), email: '', plan: '' });
        setDataState(loadData(null));
        setServerAdmin(null);
      } else {
        void loadCloudProfile(u).then((p) => pullCloud(u, p));
        void fetchServerAdmin().then(setServerAdmin);
      }
    });
    return () => {
      window.removeEventListener('hashchange', onHash);
      sub.subscription.unsubscribe();
    };
  }, [loadCloudProfile, pullCloud, refreshAuth]);

  useEffect(() => {
    const dest = coerceAppPage(page, profile?.role, accessGate);
    if (dest !== page) go(dest);
  }, [page, profile?.role, accessGate, go]);

  const value = useMemo<Ctx>(
    () => ({
      page,
      go,
      data,
      setData,
      user,
      profile,
      setProfile,
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      toast,
      toastMsg,
      menuOpen,
      setMenuOpen,
      authMsg,
      setAuthMsg,
      cloudStatus,
      refreshAuth,
      saveGoals,
      isAdmin,
      accessGate,
    }),
    [page, go, data, setData, user, profile, theme, toast, toastMsg, menuOpen, authMsg, cloudStatus, refreshAuth, saveGoals, isAdmin, accessGate],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
