
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";

type Studio = {
  id: string;
  name?: string | null;
};

type Membership = {
  studio_id: string;
  role?: string | null;
  studios?: Studio | null;
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

// Added optional children type to satisfy strict TypeScript prop checks in index.tsx
export function StudioProvider({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [activeStudioId, setActiveStudioIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const setActiveStudioId = (id: string) => {
    setActiveStudioIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Opcional: window.location.reload() se quiser resetar todos os estados de busca do banco ao trocar
  };

  const refreshStudios = async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      setStudios([]);
      setActiveStudioIdState(null);
      setLoading(false);
      return;
    }

    // Busca vinculações: user_studios -> studios
    const { data, error } = await supabase
      .from("user_studios")
      .select("studio_id, role, studios:studio_id ( id, name )")
      .eq("user_id", user.id);

    if (error) {
      console.error("[StudioProvider] refreshStudios error:", error);
      setStudios([]);
      setLoading(false);
      return;
    }

    const memberships = (data ?? []) as unknown as Membership[];
    const studiosList: Studio[] = memberships
      .map((m) => m.studios)
      .filter(Boolean) as Studio[];

    setStudios(studiosList);

    if (studiosList.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedStillValid = saved && studiosList.some((s) => s.id === saved);
      if (!savedStillValid) setActiveStudioId(studiosList[0].id);
      else setActiveStudioIdState(saved!);
    } else {
      setActiveStudioIdState(null);
      localStorage.removeItem(STORAGE_KEY);
    }

    setLoading(false);
  };

  useEffect(() => {
    refreshStudios();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        refreshStudios();
      } else if (event === 'SIGNED_OUT') {
        setStudios([]);
        setActiveStudioIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setActiveStudioIdState(e.newValue);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
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