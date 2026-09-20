import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData, PageId, Profile } from '../lib/types';
import { isKnownPage } from '../lib/types';
import { loadData, saveData, normalizeData, dataLooksEmpty } from '../lib/storage';
import { SUPABASE_UNAVAILABLE, isSupabaseConfigured, supabase, withTimeout } from '../lib/supabase';
import { canAccessAdminPanel, fetchServerAdmin } from '../lib/admin';

type Ctx = {
  page: PageId;
  go: (id: PageId) => void;
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
  saveProfile: (name: string) => Promise<void>;
  isAdmin: boolean;
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
  if (isKnownPage(path)) location.hash = `/${path}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const name = localStorage.getItem('yks_guest_name') || '';
      return { name, email: '', plan: 'Ücretsiz' };
    } catch {
      return { name: '', email: '', plan: 'Ücretsiz' };
    }
  });
  const [data, setDataState] = useState<AppData>(() => loadData(null));
  const [theme, setTheme] = useState(() => localStorage.getItem('yks_theme') || 'light');
  const [toastMsg, setToastMsg] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMsg, setAuthMsg] = useState('');
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured() ? 'Giriş yok' : 'Yapılandırılmadı');
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);
  const toastTimer = useRef(0);
  const pushTimer = useRef(0);
  const cloudReady = useRef(false);
  const userRef = useRef<User | null>(null);

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
      const { error } = await supabase.from('student_data').upsert(
        { user_id: u.id, data: payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      setCloudStatus('Bulut senkron');
    } catch (e) {
      setCloudStatus('Yerel (bulut yok)');
      console.warn(e);
    }
  }, []);

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
      const p: Profile = row
        ? {
            id: row.id,
            name: row.name || '',
            email: row.email || u.email || '',
            plan: row.plan || 'Ücretsiz',
            role: row.role === 'admin' || row.role === 'coach' ? row.role : 'student',
            account_status: row.account_status === 'pasif' ? 'pasif' : 'active',
            target_department: row.target_department,
            target_rank: row.target_rank,
          }
        : { id: u.id, name: '', email: u.email || '', plan: 'Ücretsiz' };
      if (p.account_status === 'pasif') {
        setAuthMsg('Bu hesap pasif. Yönetici açana kadar giriş kapalı.');
        await supabase.auth.signOut();
        return;
      }
      setProfile(p);
      return p;
    } catch (e) {
      setProfile({ name: '', email: u.email || '', plan: 'Ücretsiz' });
      setAuthMsg(`Profil alınamadı: ${e instanceof Error ? e.message : ''}`);
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
      if (row?.data && typeof row.data === 'object') {
        next = normalizeData(row.data);
      } else {
        next = loadData(u.id);
        if (dataLooksEmpty(next)) {
          const guest = loadData(null);
          if (!dataLooksEmpty(guest)) next = guest;
        }
        shouldPush = true;
      }
      if (cloudProfile?.target_department) next = { ...next, dept: cloudProfile.target_department };
      if (cloudProfile?.target_rank != null) next = { ...next, rank: Number(cloudProfile.target_rank) };
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
      try {
        const name = localStorage.getItem('yks_guest_name') || '';
        setProfile({ name, email: '', plan: 'Ücretsiz' });
      } catch {
        setProfile({ name: '', email: '', plan: 'Ücretsiz' });
      }
      setDataState(loadData(null));
    }
  }, [loadCloudProfile, pullCloud]);

  const saveProfile = useCallback(async (name: string) => {
    const n = (name || '').trim();
    const u = userRef.current;
    if (!u) {
      try { localStorage.setItem('yks_guest_name', n); } catch { /* ignore */ }
    }
    setProfile((p) => ({
      id: p?.id,
      name: n,
      email: p?.email || userRef.current?.email || '',
      plan: p?.plan || 'Ücretsiz',
      role: p?.role,
      account_status: p?.account_status,
      target_department: data.dept || p?.target_department,
      target_rank: data.rank || p?.target_rank,
    }));
    if (!u || !supabase) return;
    const payload = {
      id: u.id,
      name: n,
      email: u.email,
      target_department: data.dept,
      target_rank: data.rank,
      updated_at: new Date().toISOString(),
    };
    try {
      const { data: row, error } = await withTimeout(
        supabase.from('profiles').upsert(payload).select().single(),
      );
      if (error) throw error;
      setProfile({
        id: row?.id || u.id,
        name: row?.name || name,
        email: u.email || '',
        plan: row?.plan || 'Ücretsiz',
        role: row?.role === 'admin' || row?.role === 'coach' ? row.role : 'student',
        account_status: row?.account_status === 'pasif' ? 'pasif' : 'active',
        target_department: row?.target_department,
        target_rank: row?.target_rank,
      });
    } catch (e) {
      toast(`Yerel kayıt yapıldı; bulut profilinde hata: ${e instanceof Error ? e.message : ''}`);
    }
  }, [data.dept, data.rank, toast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('yks_theme', theme);
  }, [theme]);

  useEffect(() => {
    syncHashFromPath();
    const onHash = () => setPage(pageFromHash());
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
        try {
          const name = localStorage.getItem('yks_guest_name') || '';
          setProfile({ name, email: '', plan: 'Ücretsiz' });
        } catch {
          setProfile({ name: '', email: '', plan: 'Ücretsiz' });
        }
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

  const go = useCallback((id: PageId) => {
    location.hash = `/${id}`;
    setPage(id);
    setMenuOpen(false);
  }, []);

  const isAdmin = canAccessAdminPanel(user, serverAdmin);

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
      saveProfile,
      isAdmin,
    }),
    [page, go, data, setData, user, profile, theme, toast, toastMsg, menuOpen, authMsg, cloudStatus, refreshAuth, saveProfile, isAdmin],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
