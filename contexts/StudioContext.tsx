import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";

type Studio = {
  id: string;
  name?: string | null;
  role?: string | null;
};

type StudioContextValue = {
  loading: boolean;
  isSyncing: boolean;
  syncError: boolean;
  studios: Studio[];
  activeStudioId: string | null;
  setActiveStudioId: (id: string) => void;
  refreshStudios: (isRetry?: boolean) => Promise<void>;
};

const StudioContext = createContext<StudioContextValue | null>(null);
const STORAGE_KEY = "belaapp.activeStudioId";
const SYNC_TIMEOUT_MS = 5000;

export function StudioProvider({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = useState(true); // Controla o boot inicial
  const [isSyncing, setIsSyncing] = useState(false); // Background status
  const [syncError, setSyncError] = useState(false);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [activeStudioId, setActiveStudioIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const syncInFlightRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const setActiveStudioId = (id: string) => {
    setActiveStudioIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const refreshStudios = async (isRetry = false) => {
    if (syncInFlightRef.current && !isRetry) return;
    
    syncInFlightRef.current = true;
    setIsSyncing(true);
    setSyncError(false);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    // Failsafe Timeout: Nunca deixa o app travado
    const timeoutId = setTimeout(() => {
      if (syncInFlightRef.current) {
        setSyncError(true);
        setLoading(false);
        setIsSyncing(false);
        syncInFlightRef.current = false;
        console.warn("[STUDIO] Sincronização excedeu tempo limite. Prosseguindo com dados locais.");
      }
    }, SYNC_TIMEOUT_MS);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;
      
      if (!authUser) {
        setLoading(false);
        setIsSyncing(false);
        syncInFlightRef.current = false;
        clearTimeout(timeoutId);
        return;
      }

      // Prioridade absoluta para o papel administrativo
      const userRole = (authUser.app_metadata?.role || authUser.user_metadata?.role || '').toLowerCase();
      const isAdmin = userRole === 'admin' || userRole === 'gestor' || authUser.email === 'admin@belarestudio.com';

      let mappedStudios: Studio[] = [];

      if (isAdmin) {
        const { data: allStudios } = await supabase
          .from("studios")
          .select("id, name")
          .abortSignal(abortControllerRef.current.signal);
        mappedStudios = (allStudios || []).map(s => ({ id: s.id, name: s.name, role: 'admin' }));
      } else {
        const { data: memberships } = await supabase
          .from("user_studios")
          .select("studio_id, role, studios(name)")
          .eq("user_id", authUser.id)
          .abortSignal(abortControllerRef.current.signal);
        mappedStudios = (memberships || []).map(m => ({
          id: m.studio_id,
          name: (m.studios as any)?.name || "Unidade",
          role: m.role
        }));
      }

      setStudios(mappedStudios);

      if (mappedStudios.length > 0) {
        const saved = localStorage.getItem(STORAGE_KEY);
        const valid = saved && mappedStudios.some(s => s.id === saved);
        if (!valid) setActiveStudioId(mappedStudios[0].id);
      }

      setSyncError(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') setSyncError(true);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshStudios();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    refreshStudios();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') refreshStudios(true);
      if (event === 'SIGNED_OUT') {
        setStudios([]);
        setActiveStudioIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    loading, isSyncing, syncError, studios, activeStudioId, setActiveStudioId, refreshStudios
  }), [loading, isSyncing, syncError, studios, activeStudioId]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}