
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { ViewState } from '../../types';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, currentView, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive Check
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024; // Large tablet/Desktop breakpoint
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleNavigate = (view: ViewState) => {
    onNavigate(view);
    if (isMobile) setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden relative">
      
      {/* Mobile Backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div 
        className={`
          flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 ease-in-out z-40
          ${isMobile ? 'fixed inset-y-0 left-0 shadow-2xl' : 'relative'}
          ${isSidebarOpen ? 'w-64 translate-x-0' : isMobile ? '-translate-x-full w-64' : 'w-0 overflow-hidden'}
        `}
      >
        <div className="flex-1 overflow-hidden w-64 relative">
            <Sidebar currentView={currentView} onNavigate={handleNavigate} className="w-full" />
            
            {/* Desktop Collapse Arrow (Inside Sidebar) */}
            {!isMobile && (
                <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="absolute top-4 right-2 p-1.5 bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                    title="Recolher menu"
                >
                    <ChevronLeft size={18} />
                </button>
            )}
        </div>
        
        {/* Mobile Close Button */}
        {isMobile && (
            <button 
                onClick={() => setIsSidebarOpen(false)}
                className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 shadow-sm"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full transition-all">
        
        {/* Top Toggle Bar (Mobile or Collapsed Desktop) */}
        {(!isSidebarOpen || isMobile) && (
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 h-14 flex items-center gap-3 z-20 shadow-sm md:shadow-none">
                <button
                    onClick={toggleSidebar}
                    className="p-2 bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors"
                    aria-label="Abrir Menu"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center font-bold text-white text-xs">B</div>
                    <span className="font-bold text-slate-700 text-sm">BelaApp</span>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-hidden">
            {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
