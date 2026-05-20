import React, { useState, useEffect } from 'react';
import { usePWA } from '../../hooks/usePWA';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';

export const PWAInstallButton: React.FC<{ inline?: boolean }> = ({ inline }) => {
  const { canInstall, isInstalled, isIOS, installApp } = usePWA();
  const [showModal, setShowModal] = useState(false);
  const [isStandalone] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as any).standalone === true;
    }
    return false;
  });

  // 3. Se já estiver instalado (standalone) ou se isInstalled for true: esconde o botão
  if (isStandalone || isInstalled) {
    return null;
  }

  const handleClick = async () => {
    // 1. Se o evento beforeinstallprompt estiver disponível: dispara a instalação nativa direto
    if (canInstall) {
      await installApp();
    } else {
      // 2. Se não estiver (já viu antes ou iOS): abre um modal simples com instruções
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 hover:border-orange-500 hover:bg-orange-50/50 text-slate-600 hover:text-orange-600 rounded-xl transition-all font-black text-[10px] uppercase tracking-wider shadow-sm select-none shrink-0 ${
          inline ? 'ml-auto' : ''
        }`}
        title="Instalar BelareStudio no celular ou computador"
      >
        <Download size={11} className="stroke-[3]" />
        <span>Instalar App</span>
      </button>

      {/* Modal simples de instruções */}
      {showModal && (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-2xl relative w-full max-w-xs text-left animate-in zoom-in-95 duration-200">
            {/* Fechar */}
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            >
              <X size={16} />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-3 mb-4">
              <img 
                src="/icons/icone-192x192.png" 
                alt="BelareStudio" 
                className="w-10 h-10 rounded-xl"
              />
              <div>
                <div className="text-[9px] font-black uppercase text-[#b5895a] tracking-widest flex items-center gap-1">
                  <Sparkles size={8} fill="currentColor" />
                  <span>BelareStudio App</span>
                </div>
                <h3 className="font-extrabold text-[#111827] text-sm tracking-tight">Instalar Aplicativo</h3>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4 font-medium">
              Tenha acesso rápido ao BelareStudio diretamente de sua tela inicial como um aplicativo nativo.
            </p>

            {/* Android / Chrome Manual Install Instruction or iOS */}
            {isIOS ? (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <p className="text-[10px] font-black text-[#b5895a] uppercase tracking-widest">Instruções para Safari (iOS):</p>
                <ol className="space-y-2 text-xs text-slate-600 font-bold">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">1</span>
                    <span className="mt-0.5">
                      Toque no ícone de Compartilhar <Share size={12} className="inline mx-0.5 text-[#b5895a]" /> no Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">2</span>
                    <span className="mt-0.5">
                      Selecione <strong className="text-slate-900">Adicionar à Tela de Início</strong> <PlusSquare size={12} className="inline mx-0.5 text-slate-900" />.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <p className="text-[10px] font-black text-[#b5895a] uppercase tracking-widest">Instruções para Android / Chrome:</p>
                <ol className="space-y-2 text-xs text-slate-600 font-bold">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">1</span>
                    <span className="mt-0.5">
                      Toque nos <strong className="text-slate-900">3 pontinhos</strong> do Chrome no canto superior direito.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700 flex-shrink-0">2</span>
                    <span className="mt-0.5">
                      Selecione <strong className="text-slate-900">Adicionar à tela inicial</strong> ou <strong className="text-slate-900">Instalar aplicativo</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-5 w-full bg-slate-800 hover:bg-slate-900 text-white py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
