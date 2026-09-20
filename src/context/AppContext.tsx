import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData, PageId, Profile } from '../lib/types';
import { NAV } from '../lib/types';
import { loadData, saveData, normalizeData } from '../lib/storage';
import { supabase, withTimeout } from '../lib/supabase';

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
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp must be inside provider');
  return v;
}

function pageFromHash(): PageId {
  const raw = location.hash.replace('#/', '').replace('#', '');
  return NAV.some((n) => n.id === raw) ? (raw as PageId) : 'home';
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
  const [cloudStatus, setCloudStatus] = useState('Yerel');
  const toastTimer = useRef(0);
  const pushTimer = useRef(0);
  const cloudReady = useRef(false);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const persistLocal = useCallback((next: AppData, uid?: string | null) => {
    saveData(next, uid ?? userRef.current?.id);
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
    if (!supabase) return;
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
            plan: 'Ücretsiz',
            target_department: row.target_department,
            target_rank: row.target_rank,
          }
        : { id: u.id, name: '', email: u.email || '', plan: 'Ücretsiz' };
      setProfile(p);
      if (row) {
        setData((d) => ({
          ...d,
          dept: row.target_department || d.dept,
          rank: row.target_rank == null ? d.rank : Number(row.target_rank),
        }));
      }
    } catch (e) {
      setProfile({ name: '', email: u.email || '', plan: 'Ücretsiz' });
      setAuthMsg(`Profil alınamadı: ${e instanceof Error ? e.message : ''}`);
    }
  }, [setData]);

  const pullCloud = useCallback(async (u: User) => {
    if (!supabase) return;
    try {
      const { data: row, error } = await supabase
        .from('student_data')
        .select('data,updated_at')
        .eq('user_id', u.id)
        .maybeSingle();
      if (error) throw error;
      cloudReady.current = true;
      if (row?.data && typeof row.data === 'object') {
        const cloud = normalizeData(row.data);
        const has =
          cloud.tasks.length || cloud.exams.length || cloud.sessions.length || cloud.plan.length;
        if (has) {
          setDataState(cloud);
          persistLocal(cloud, u.id);
        } else {
          const local = loadData(u.id);
          setDataState(local);
          persistLocal(local, u.id);
          void pushCloud(local);
        }
      } else {
        const local = loadData(u.id);
        setDataState(local);
        persistLocal(local, u.id);
        void pushCloud(local);
      }
      setCloudStatus('Bulut senkron');
    } catch {
      cloudReady.current = false;
      setCloudStatus('Yerel (bulut tablosu yok)');
      setDataState(loadData(u.id));
      persistLocal(loadData(u.id), u.id);
    }
  }, [persistLocal, pushCloud]);

  const refreshAuth = useCallback(async () => {
    if (!supabase) {
      setAuthMsg('Bulut giriş sistemi yüklenemedi; yerel moddasın.');
      return;
    }
    const { data: sessionData } = await withTimeout(supabase.auth.getSession());
    const u = sessionData.session?.user || null;
    setUser(u);
    if (u) {
      await loadCloudProfile(u);
      await pullCloud(u);
    } else {
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
    try { localStorage.setItem('yks_guest_name', n); } catch { /* ignore */ }
    setProfile((p) => ({
      id: p?.id,
      name: n,
      email: p?.email || userRef.current?.email || '',
      plan: p?.plan || 'Ücretsiz',
    }));
    const u = userRef.current;
    if (!u || !supabase) return;
    const payload = {
      id: u.id,
      name: n,
      email: u.email,
      plan: 'Ücretsiz',
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
        plan: 'Ücretsiz',
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
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    void refreshAuth();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user || null;
      setUser(u);
      if (!u) {
        cloudReady.current = false;
        try {
          const name = localStorage.getItem('yks_guest_name') || '';
          setProfile({ name, email: '', plan: 'Ücretsiz' });
        } catch {
          setProfile({ name: '', email: '', plan: 'Ücretsiz' });
        }
        setDataState(loadData(null));
      } else {
        void loadCloudProfile(u).then(() => pullCloud(u));
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
    }),
    [page, go, data, setData, user, profile, theme, toast, toastMsg, menuOpen, authMsg, cloudStatus, refreshAuth, saveProfile],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
