
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";

type Studio = {
  id: string;
  name?: string | null;
  role?: string | null;
};

type StudioContextValue = {
  loading: boolean;
  studios: Studio[];
  activeStudioId: string | null;
  setActiveStudioId: (id: string) => void;
  refreshStudios: () => Promise<void>;
};

const StudioContext = createContext<StudioContextValue | null>(null);

const STORAGE_KEY = "belaapp.activeStudioId";

export function StudioProvider({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [activeStudioId, setActiveStudioIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const setActiveStudioId = (id: string) => {
    setActiveStudioIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const refreshStudios = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      
      const user = sessionData?.session?.user;
      
      if (!user) {
        setStudios([]);
        setActiveStudioIdState(null);
        setLoading(false);
        return;
      }

      // 1. Busca memberships para pegar studio_id e role
      const { data: memberships, error: mErr } = await supabase
        .from("user_studios")
        .select("studio_id, role")
        .eq("user_id", user.id);

      if (mErr) throw mErr;

      if (!memberships || memberships.length === 0) {
        setStudios([]);
        setActiveStudioIdState(null);
        localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
        return;
      }

      const studioIds = memberships.map(m => m.studio_id);

      // 2. Busca detalhes dos studios
      const { data: studiosData, error: sErr } = await supabase
        .from("studios")
        .select("id, name")
        .in("id", studioIds);

      if (sErr) throw sErr;

      // 3. Mapeia combinando as informações
      const mappedStudios = (studiosData || []).map(s => ({
        id: s.id,
        name: s.name,
        role: memberships.find(m => m.studio_id === s.id)?.role
      }));

      setStudios(mappedStudios);

      // 4. Gerencia qual studio está ativo
      if (mappedStudios.length > 0) {
        const saved = localStorage.getItem(STORAGE_KEY);
        const savedStillValid = saved && mappedStudios.some((s) => s.id === saved);
        
        if (!savedStillValid) {
          setActiveStudioId(mappedStudios[0].id);
        } else {
          setActiveStudioIdState(saved!);
        }
      } else {
        setActiveStudioIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err: any) {
      console.error("[StudioProvider] refreshStudios error:", err?.message);
      setStudios([]);
      setActiveStudioIdState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStudios();

    // Safety Timeout: Se em 5 segundos não carregar as unidades, libera a UI
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("[StudioContext] Tempo limite de carregamento atingido.");
        setLoading(false);
      }
    }, 5000);

    if (!supabase) return () => clearTimeout(timer);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        refreshStudios();
      } else if (event === 'SIGNED_OUT') {
        setStudios([]);
        setActiveStudioIdState(null);
        localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
      }
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setActiveStudioIdState(e.newValue);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
      clearTimeout(timer);
    };
  }, []);

  const value = useMemo(
    () => ({ loading, studios, activeStudioId, setActiveStudioId, refreshStudios }),
    [loading, studios, activeStudioId]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
