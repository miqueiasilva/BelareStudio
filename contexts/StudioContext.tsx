import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../services/supabaseClient";

type Studio = {
  id: string;
  name?: string | null;
  role?: string | null;
  theme_color?: string | null;
  discount_rules?: any[] | null;
};

type StudioContextValue = {
  loading: boolean;
  isSyncing: boolean;
  studios: Studio[];
  activeStudioId: string | null;
  setActiveStudioId: (id: string) => void;
  refreshStudios: (force?: boolean) => Promise<void>;
};

const StudioContext = createContext<StudioContextValue | null>(null);
const STORAGE_KEY = "belaapp.activeStudioId";
const SYNC_COOLDOWN_MS = 60000; // 1 minuto de intervalo mínimo entre syncs automáticos

export function StudioProvider({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [activeStudioId, setActiveStudioIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const lastSyncRef = useRef<number>(0);
  const syncInFlightRef = useRef<boolean>(false);

  const setActiveStudioId = React.useCallback((id: string) => {
    setActiveStudioIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refreshStudios = React.useCallback(async (force = false) => {
    const now = Date.now();
    // Bloqueia sync se já estiver ocorrendo ou se o cooldown não expirou (exceto se for forçado)
    if (syncInFlightRef.current) return;
    if (!force && (now - lastSyncRef.current < SYNC_COOLDOWN_MS)) return;

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      
      if (!user) {
        setStudios([]);
        setActiveStudioIdState(null);
        return;
      }

      // Prioridade Admin
      const userRole = (user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase();
      const isAdmin = userRole === 'admin' || userRole === 'gestor' || user.email === 'admin@belarestudio.com';

      let mappedStudios: Studio[] = [];

      if (isAdmin) {
        const { data: allStudios } = await supabase.from("studios").select("id, name");
        const { data: allSettings } = await supabase.from("studio_settings").select("id, theme_color, discount_rules");
        
        mappedStudios = (allStudios || []).map(s => {
          const settings = allSettings?.find(st => st.id === s.id);
          return { 
            id: s.id, 
            name: s.name, 
            role: 'admin',
            theme_color: settings?.theme_color,
            discount_rules: settings?.discount_rules
          };
        });
      } else {
        const { data: memberships } = await supabase
          .from("user_studios")
          .select("studio_id, role, studios(name)")
          .eq("user_id", user.id);
        
        const studioIds = (memberships || []).map(m => m.studio_id);
        const { data: allSettings } = await supabase
          .from("studio_settings")
          .select("id, theme_color, discount_rules")
          .in("id", studioIds);
        
        mappedStudios = (memberships || []).map(m => {
          const settings = allSettings?.find(st => st.id === m.studio_id);
          return {
            id: m.studio_id,
            name: (m.studios as any)?.name || "Unidade",
            role: m.role,
            theme_color: settings?.theme_color,
            discount_rules: settings?.discount_rules
          };
        });
      }

      setStudios(mappedStudios);

      if (mappedStudios.length > 0) {
        const saved = localStorage.getItem(STORAGE_KEY);
        const valid = saved && mappedStudios.some(s => s.id === saved);
        if (!valid) setActiveStudioId(mappedStudios[0].id);
      }
      
      lastSyncRef.current = Date.now();
    } catch (err) {
      console.error("[StudioProvider] Erro na sincronização:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [setActiveStudioId]);

  useEffect(() => {
    refreshStudios(true);

    const handleVisibility = () => {
      // Só tenta sincronizar em background ao voltar se o cooldown expirou
      if (document.visibilityState === 'visible') {
        refreshStudios(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        refreshStudios(true);
      } else if (event === 'SIGNED_OUT') {
        setStudios([]);
        setActiveStudioIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      sub.subscription.unsubscribe();
    };
  }, [refreshStudios]);

  useEffect(() => {
    const activeStudio = studios.find(s => s.id === activeStudioId);
    if (activeStudio?.theme_color) {
      document.documentElement.style.setProperty('--primary-color', activeStudio.theme_color);
    } else {
      document.documentElement.style.setProperty('--primary-color', '#f97316'); // Default orange
    }
  }, [studios, activeStudioId]);

  const value = useMemo(
    () => ({ loading, isSyncing, studios, activeStudioId, setActiveStudioId, refreshStudios }),
    [loading, isSyncing, studios, activeStudioId, setActiveStudioId, refreshStudios]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}