import React, { useState, useEffect } from 'react';
import { usePWA } from '../hooks/usePWA';
import { X, Share, PlusSquare, ArrowDown, Sparkles } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWA();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Avoid showing prompt in native/standalone mode or if already installed
    if (isInstalled) return;

    // Check if user dismissed the prompt temporarily (7 days check)
    const dismissUntil = localStorage.getItem('pwa_prompt_dismissed_until');
    if (dismissUntil && Date.now() < parseInt(dismissUntil, 10)) {
      return;
    }

    // Show prompt if the app is installable or if it is an iOS Safari browser
    if (isInstallable || isIOS) {
      // Delay slightly for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, isIOS]);

  const handleDismiss = () => {
    setIsVisible(false);
    // Dismiss and hide for 7 days
    const nextShowTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa_prompt_dismissed_until', nextShowTime.toString());
  };

  const handleInstall = async () => {
    if (isInstallable) {
      const success = await installApp();
      if (success) {
        setIsVisible(false);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="bg-white rounded-[32px] border border-slate-100 p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative overflow-hidden text-left">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#b5895a]/10 to-transparent rounded-full -mr-6 -mt-6"></div>

        {/* Close Button */}
        <button 
          onClick={handleDismiss} 
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Ignorar instalação por enquanto"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/10">
            <span className="font-black text-lg">B</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#b5895a] tracking-widest">
              <Sparkles size={10} fill="currentColor" />
              <span>App BelareStudio</span>
            </div>
            <h3 className="font-black text-slate-900 text-sm tracking-tight">Instalar no Celular</h3>
          </div>
        </div>

        {/* App promotion message */}
        <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
          Acesse sua agenda, faturamento e ferramentas inteligente da Jaci com carregamento super rápido e suporte offline parcial direto da tela inicial.
        </p>

        {isIOS ? (
          /* iOS Safari Manual Install Instruction UI */
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 mb-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Passo a passo para instalar:</p>
            <ol className="space-y-2.5 text-xs text-slate-600 font-bold">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">1</span>
                <span>
                  Toque no ícone de Compartilhar <Share size={14} className="inline mx-1 text-[#b5895a]" /> no painel do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">2</span>
                <span>
                  Role a lista e clique em <strong className="text-slate-900">Adicionar à Tela de Início</strong> <PlusSquare size={14} className="inline mx-1 text-slate-900" />.
                </span>
              </li>
            </ol>
          </div>
        ) : null}

        {/* Actions Buttons */}
        <div className="flex items-center gap-3">
          {isInstallable && (
            <button
              onClick={handleInstall}
              className="flex-1 bg-[#b5895a] hover:bg-[#a47a4d] text-white py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-[#b5895a]/10 active:scale-95 flex items-center justify-center gap-2"
            >
              <ArrowDown size={14} strokeWidth={3} /> Instalar Agora
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`py-3.5 px-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 hover:bg-slate-50 ${!isInstallable ? 'w-full text-center' : ''}`}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
};
