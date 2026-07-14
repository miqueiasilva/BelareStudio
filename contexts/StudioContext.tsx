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
  const [activeStudioId, setActiveStudioIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn("[StudioContext] Failed to read activeStudioId from localStorage:", e);
      return null;
    }
  });

  const lastSyncRef = useRef<number>(0);
  const syncInFlightRef = useRef<boolean>(false);

  const setActiveStudioId = React.useCallback((id: string) => {
    setActiveStudioIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      console.warn("[StudioContext] Failed to write activeStudioId to localStorage:", e);
    }
  }, []);

  const refreshStudios = React.useCallback(async (force = false) => {
    const now = Date.now();
    // Bloqueia sync se já estiver ocorrendo ou se o cooldown não expirou (exceto se for forçado)
    if (syncInFlightRef.current) return;
    if (!force && (now - lastSyncRef.current < SYNC_COOLDOWN_MS)) return;

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      let sessionData = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[StudioProvider] Erro ao obter sessão:", error.message || error);
          const msg = String(error.message || error || "").toLowerCase();
          if (msg.includes("refresh_token_not_found") || msg.includes("refresh token") || msg.includes("invalid refresh token") || msg.includes("invalid_grant")) {
            sessionData = null;
          } else {
            sessionData = data;
          }
        } else {
          sessionData = data;
        }
      } catch (e) {
        console.warn("[StudioProvider] Exceção ao sincronizar sessão:", e);
      }
      const user = sessionData?.session?.user;
      
      if (!user) {
        setStudios([]);
        setActiveStudioIdState(null);
        return;
      }

      // Prioridade Admin - Verificamos tanto o papel no AppUser quanto metadados do Supabase
      const userRoleMetadata = (user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase();
      const isAdmin = (user as any).papel === 'admin' || 
                      (user as any).papel === 'gestor' || 
                      userRoleMetadata === 'admin' || 
                      userRoleMetadata === 'gestor' || 
                      user.email === 'admin@belarestudio.com' ||
                      user.email === 'mykeias@gmail.com';

      let mappedStudios: Studio[] = [];

      const timeoutPromise = (ms: number, reason: string) => 
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${reason}`)), ms));

      if (isAdmin) {
        console.log("[StudioProvider] Sincronizando estúdios como Administrador...");
        const queryStudios = supabase.from("studios").select("id, name");
        const querySettings = supabase.from("studio_settings").select("studio_id, theme_color, discount_rules");

        const { data: allStudios } = await Promise.race([
          queryStudios,
          timeoutPromise(2500, "studios query")
        ]).catch(err => {
          console.warn("[StudioProvider] Falha ao carregar lista de estúdios (timeout/erro):", err);
          return { data: null };
        });

        const { data: allSettings } = await Promise.race([
          querySettings,
          timeoutPromise(2500, "studio_settings query")
        ]).catch(err => {
          console.warn("[StudioProvider] Falha ao carregar configurações de estúdio (timeout/erro):", err);
          return { data: null };
        });
        
        mappedStudios = (allStudios || []).map(s => {
          const settings = allSettings?.find(st => st.studio_id === s.id);
          return { 
            id: String(s.id), 
            name: s.name, 
            role: 'admin',
            theme_color: settings?.theme_color,
            discount_rules: settings?.discount_rules
          };
        });
      } else {
        console.log("[StudioProvider] Sincronizando estúdios de colaborador...");
        // Buscar em user_studios (mapeamento direto de usuário)
        const membershipsPromise = supabase
          .from("user_studios")
          .select("studio_id, role, studios(name)")
          .eq("user_id", user.id);
        
        // Buscar também em team_members pelo email (caso o colaborador tenha sido adicionado apenas lá)
        const teamMembershipsPromise = supabase
          .from("team_members")
          .select("studio_id, access_level")
          .eq("email", user.email);

        const { data: memberships } = await Promise.race([
          membershipsPromise,
          timeoutPromise(2500, "user_studios query")
        ]).catch(err => {
          console.warn("[StudioProvider] Falha ao consultar user_studios:", err);
          return { data: null };
        });

        const { data: teamMemberships } = await Promise.race([
          teamMembershipsPromise,
          timeoutPromise(2500, "team_memberships query")
        ]).catch(err => {
          console.warn("[StudioProvider] Falha ao consultar team_members:", err);
          return { data: null };
        });

        // Combinar os IDs únicos de estúdios encontrados
        const allMemberships = [...(memberships || [])];
        
        if (teamMemberships) {
          teamMemberships.forEach(tm => {
            if (!allMemberships.find(m => m.studio_id === tm.studio_id)) {
              allMemberships.push({
                studio_id: tm.studio_id,
                role: tm.access_level || 'profissional',
                studios: null // Será buscado abaixo se necessário
              });
            }
          });
        }
        
        const studioIds = allMemberships.map(m => m.studio_id);
        
        if (studioIds.length > 0) {
          // Buscar nomes dos estúdios e configurações
          const studiosDataPromise = supabase
            .from("studios")
            .select("id, name")
            .in("id", studioIds);

          const settingsPromise = supabase
            .from("studio_settings")
            .select("studio_id, theme_color, discount_rules")
            .in("studio_id", studioIds);

          const { data: studiosData } = await Promise.race([
            studiosDataPromise,
            timeoutPromise(2500, "studios details query")
          ]).catch(err => {
            console.warn("[StudioProvider] Falha ao carregar detalhes dos estúdios:", err);
            return { data: null };
          });

          const { data: allSettings } = await Promise.race([
            settingsPromise,
            timeoutPromise(2500, "studio_settings details query")
          ]).catch(err => {
            console.warn("[StudioProvider] Falha ao carregar configurações detalhadas dos estúdios:", err);
            return { data: null };
          });
          
          mappedStudios = allMemberships.map(m => {
            const settings = allSettings?.find(st => st.studio_id === m.studio_id);
            const studioInfo = studiosData?.find(s => s.id === m.studio_id);
            return {
              id: String(m.studio_id),
              name: (m.studios as any)?.name || studioInfo?.name || "Unidade",
              role: m.role,
              theme_color: settings?.theme_color,
              discount_rules: settings?.discount_rules
            };
          });
        }
      }

      // Fallback de Emergência: Evitar loop de carregamento e tela branca sob conexões instáveis ou banco de dados pausado
      if (mappedStudios.length === 0) {
        console.warn("[StudioProvider] Nenhum estúdio encontrado na nuvem (ou erro de Timeout). Criando estúdio local de fallback...");
        mappedStudios = [{
          id: "default-studio",
          name: isAdmin ? "BelareStudio (Principal - Local)" : "BelareStudio Colaborador (Local)",
          role: isAdmin ? "admin" : "profissional",
          theme_color: "#f97316",
          discount_rules: []
        }];
      }

      setStudios(mappedStudios);

      if (mappedStudios.length > 0) {
        let saved = null;
        try {
          saved = localStorage.getItem(STORAGE_KEY);
        } catch (e) {
          console.warn("[StudioContext] Failed to read activeStudioId from localStorage:", e);
        }
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
    // Safety timeout: force resolve initial loading in max 7 seconds under any network circumstance
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("[StudioProvider] Segurança de tempo limite acionada após 7s de carregamento inicial.");
        }
        return false;
      });
    }, 7000);

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
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
          console.warn("[StudioContext] Failed to remove activeStudioId from localStorage:", e);
        }
      }
    });

    return () => {
      clearTimeout(safetyTimer);
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