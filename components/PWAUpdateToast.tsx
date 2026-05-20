import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] SW registrado');
      // Validate background updates periodically
      if (r) {
        setInterval(() => {
          r.update();
        }, 1000 * 60 * 60); // Check for updates hourly
      }
    },
    onRegisterError(error) {
      console.warn('[PWA_DEBUG] Falha ao registrar Service Worker:', error);
    }
  });

  // Automatically refresh after 60 seconds of inactivity
  useEffect(() => {
    if (needRefresh) {
      const autoUpdateTimer = setTimeout(() => {
        console.log('[PWA_DEBUG] Auto-atualizando aplicação após 60 segundos de inatividade.');
        updateServiceWorker(true);
      }, 60000); // 60 seconds

      return () => clearTimeout(autoUpdateTimer);
    }
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh) return null;

  return (
    <div className="fixed top-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-[9999] animate-in slide-in-from-top-10 fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 text-white p-5 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#b5895a] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#b5895a]/20 shrink-0">
            <Sparkles size={18} fill="currentColor" />
          </div>
          <div className="text-left">
            <p className="text-xs font-black uppercase text-orange-400 tracking-widest">SISTEMA ATUALIZADO</p>
            <p className="text-sm font-bold leading-tight">Nova versão do BelareStudio disponível.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateServiceWorker(true)}
            className="bg-[#b5895a] hover:bg-[#a47a4d] text-white py-2 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw size={12} className="animate-spin-slow" /> Atualizar
          </button>
          
          <button
            onClick={() => setNeedRefresh(false)}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            aria-label="Ignorar atualização"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
