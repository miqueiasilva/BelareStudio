import React, { useState, useEffect } from 'react';
import { usePWA } from '../hooks/usePWA';
import { X, Share, PlusSquare, ArrowDown, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

export const PWAInstallPrompt: React.FC = () => {
  const { canInstall, isInstalled, isIOS, installApp } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [showAndroidManual, setShowAndroidManual] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Detect "already installed" or standalone mode
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
    if (isInstalled || isStandalone) return;

    // Show prompt automatically after 3 seconds on every visit
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isInstalled]);

  const handleDismiss = () => {
    setIsVisible(false);
    setShowAndroidManual(false);
  };

  const handleInstall = async () => {
    if (canInstall) {
      const success = await installApp();
      if (success) {
        setIsVisible(false);
      }
    } else {
      setShowAndroidManual(true);
      toast.success('Abra o menu do Chrome e selecione "Adicionar à tela inicial"!', {
        icon: '📱',
        duration: 5000,
      });
    }
  };

  // Condition check: only show on "/" (landing page) or "#login" / "/login"
  const path = (location.pathname || '').toLowerCase();
  const hash = (location.hash || window.location.hash || '').toLowerCase();
  
  const isInternalRoute = 
    path.includes('/dashboard') || 
    path.includes('/atendimentos') || 
    path.includes('/clientes') || 
    path.includes('/financeiro') || 
    path.includes('/vendas') || 
    path.includes('/caixa') || 
    path.includes('/agenda') || 
    path.includes('/comandas') || 
    path.includes('/relatorios') || 
    path.includes('/produtos') || 
    path.includes('/servicos') || 
    path.includes('/equipe') || 
    path.includes('/configuracoes') || 
    path.includes('/remuneracoes') || 
    path.includes('/reset-password') || 
    path.includes('/public-preview') ||
    hash.includes('dashboard') ||
    hash.includes('atendimentos') ||
    hash.includes('clientes') ||
    hash.includes('financeiro') ||
    hash.includes('vendas') ||
    hash.includes('caixa') ||
    hash.includes('agenda') ||
    hash.includes('comandas') ||
    hash.includes('relatorios') ||
    hash.includes('produtos') ||
    hash.includes('servicos') ||
    hash.includes('equipe') ||
    hash.includes('configuracoes') ||
    hash.includes('remuneracoes');

  const isAllowedPath = path === '/' || path === '/login' || hash === '#login' || hash === '#/login';

  if (isInternalRoute || !isAllowedPath) {
    return null;
  }

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
          <img 
            src="/icons/icone-192x192.png" 
            alt="BelareStudio" 
            className="w-12 h-12 rounded-2xl"
          />
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

        {showAndroidManual && !isIOS ? (
          /* Android / Chrome Manual Install Instruction UI */
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 mb-6 animate-in fade-in duration-300">
            <p className="text-[10px] font-black text-[#b5895a] uppercase tracking-widest">Como instalar manualmente:</p>
            <ol className="space-y-2.5 text-xs text-slate-600 font-bold">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">1</span>
                <span>
                  Toque nos <strong className="text-slate-900">3 pontinhos</strong> do Chrome (no canto superior direito).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">2</span>
                <span>
                  Selecione a opção <strong className="text-slate-900">Adicionar à tela inicial</strong> ou <strong className="text-slate-900">Instalar aplicativo</strong>.
                </span>
              </li>
            </ol>
          </div>
        ) : null}

        {/* Actions Buttons */}
        <div className="flex items-center gap-3">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex-1 bg-[#b5895a] hover:bg-[#a47a4d] text-white py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-[#b5895a]/10 active:scale-95 flex items-center justify-center gap-2"
            >
              <ArrowDown size={14} strokeWidth={3} /> Instalar Agora
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`py-3.5 px-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600 hover:bg-slate-50 ${isIOS ? 'w-full text-center' : 'flex-1 text-center'}`}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
};
