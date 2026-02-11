import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";

type Studio = {
  id: string;
  name?: string | null;
  role?: string | null;
};

type StudioContextValue = {
  loading: boolean;
  syncError: boolean;
  studios: Studio[];
  activeStudioId: string | null;
  setActiveStudioId: (id: string) => void;
  refreshStudios: (isRetry?: boolean) => Promise<void>;
};

const StudioContext = createContext<StudioContextValue | null>(null);

const STORAGE_KEY = "belaapp.activeStudioId";
const SYNC_TIMEOUT_MS = 5000; // Timeout agressivo de 5s para não travar o usuário

export function StudioProvider({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [activeStudioId, setActiveStudioIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const syncInFlightRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSyncSuccessRef = useRef<number>(0);

  const setActiveStudioId = (id: string) => {
    setActiveStudioIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const refreshStudios = async (isRetry = false) => {
    // 1. Single-Flight: Impede concorrência
    if (syncInFlightRef.current) return;

    // 2. Cache-Hit: Se já temos dados e o sync foi recente (< 5 min), não repetimos
    const now = Date.now();
    if (!isRetry && activeStudioId && (now - lastSyncSuccessRef.current < 300000)) {
      setLoading(false);
      return;
    }

    syncInFlightRef.current = true;
    setSyncError(false);
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const timeoutId = setTimeout(() => {
      if (syncInFlightRef.current) {
        if ((import.meta as any).env?.DEV) console.warn("[STUDIO] Timeout background sync.");
        setSyncError(true);
        setLoading(false);
        syncInFlightRef.current = false;
      }
    }, SYNC_TIMEOUT_MS);

    try {
      // O loading só é true na primeira vez ou em retentativas manuais
      if (isRetry || studios.length === 0) setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;
      
      if (!authUser) {
        setStudios([]);
        setLoading(false);
        syncInFlightRef.current = false;
        clearTimeout(timeoutId);
        return;
      }

      const userRole = (authUser.app_metadata?.role || authUser.user_metadata?.role || '').toLowerCase();
      const isAdmin = userRole === 'admin' || authUser.email === 'admin@belarestudio.com';

      let mappedStudios: Studio[] = [];

      if (isAdmin) {
        const { data: allStudios, error: adminErr } = await supabase
          .from("studios")
          .select("id, name")
          .abortSignal(abortControllerRef.current.signal);
          
        if (adminErr) throw adminErr;
        mappedStudios = (allStudios || []).map(s => ({ id: s.id, name: s.name, role: 'admin' }));
      } else {
        const { data: memberships, error: memberErr } = await supabase
          .from("user_studios")
          .select("studio_id, role, studios(name)")
          .eq("user_id", authUser.id)
          .abortSignal(abortControllerRef.current.signal);

        if (memberErr) throw memberErr;
        mappedStudios = (memberships || []).map(m => ({
          id: m.studio_id,
          name: (m.studios as any)?.name || "Unidade",
          role: m.role
        }));
      }

      setStudios(mappedStudios);

      if (mappedStudios.length > 0) {
        const saved = localStorage.getItem(STORAGE_KEY);
        const savedStillValid = saved && mappedStudios.some((s) => s.id === saved);
        if (!savedStillValid) {
          setActiveStudioId(mappedStudios[0].id);
        } else {
          setActiveStudioIdState(saved!);
        }
      }

      lastSyncSuccessRef.current = Date.now();
      setSyncError(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("[STUDIO] Sincronização falhou:", err.message);
        setSyncError(true);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      syncInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Só re-sincroniza se voltarmos para a aba e NÃO tivermos uma unidade ativa ou o erro persistir
      if (document.visibilityState === 'visible' && (!activeStudioId || syncError)) {
        refreshStudios();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    refreshStudios();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        refreshStudios(true);
      } else if (event === 'SIGNED_OUT') {
        setStudios([]);
        setSyncError(false);
        setActiveStudioIdState(null);
        localStorage.removeItem(STORAGE_KEY);
        lastSyncSuccessRef.current = 0;
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sub.subscription.unsubscribe();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const value = useMemo(
    () => ({ loading, syncError, studios, activeStudioId, setActiveStudioId, refreshStudios }),
    [loading, syncError, studios, activeStudioId]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}