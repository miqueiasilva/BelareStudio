
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { ViewState } from '../../types';
import { Menu, X } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, currentView, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar - Desktop e Mobile */}
      <Sidebar 
        currentView={currentView} 
        onNavigate={onNavigate} 
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={closeMobileMenu}
      />

      {/* Área de Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header Mobile (Visível apenas em telas pequenas) */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-lg shadow-orange-100">B</div>
            <span className="font-bold text-slate-700 text-sm tracking-tight">BelaApp</span>
          </div>
          
          <button 
            onClick={toggleMobileMenu}
            className="p-2.5 bg-slate-50 text-slate-600 rounded-xl active:scale-95 transition-all"
            aria-label="Abrir menu"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        {/* Main Content com Scroll Independente */}
        <main className="flex-1 overflow-y-auto relative scrollbar-hide">
          <div className="min-h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
