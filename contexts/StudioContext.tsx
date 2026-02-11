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
    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;
      
      if (!authUser) {
        setStudios([]);
        setLoading(false);
        return;
      }

      // IMPORTANTE: Primeiro detectamos se é admin global via metadados
      const userRole = (authUser.app_metadata?.role || authUser.user_metadata?.role || '').toLowerCase();
      const isAdmin = userRole === 'admin' || authUser.email === 'admin@belarestudio.com';

      let mappedStudios: Studio[] = [];

      if (isAdmin) {
        // Admins veem todas as unidades do sistema
        console.log("[STUDIO] Modo Admin: Carregando todas as unidades.");
        const { data: allStudios } = await supabase.from("studios").select("id, name");
        mappedStudios = (allStudios || []).map(s => ({ id: s.id, name: s.name, role: 'admin' }));
      } else {
        // Usuários normais dependem do vínculo user_studios
        const { data: memberships } = await supabase
          .from("user_studios")
          .select("studio_id, role, studios(name)")
          .eq("user_id", authUser.id);

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
      } else {
        setActiveStudioIdState(null);
      }
    } catch (err) {
      console.error("[StudioProvider] refreshStudios error:", err);
    } finally {
      setLoading(false);
    }
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

    return () => sub.subscription.unsubscribe();
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