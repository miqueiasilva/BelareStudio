import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useStudio } from './contexts/StudioContext';
import { ViewState, FinancialTransaction, UserRole } from './types';
import EnvGate from './components/EnvGate';
import { hasAccess } from './utils/permissions';
import { Loader2, ShieldAlert, RefreshCw, CloudOff } from 'lucide-react';
import { usePWA } from './hooks/usePWA';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAUpdateToast } from './components/PWAUpdateToast';

// Componentes estáticos
import MainLayout from './components/layout/MainLayout';
import LoginView from './components/views/LoginView';
import PaidCommandDetailView from './components/views/PaidCommandDetailView';

// Views Lazy Load
const ResetPasswordView = lazy(() => import('./components/views/ResetPasswordView'));
const DashboardView = lazy(() => import('./components/views/DashboardView'));
const AtendimentosView = lazy(() => import('./components/views/AtendimentosView'));
const AgendaOnlineView = lazy(() => import('./components/views/AgendaOnlineView'));
const WhatsAppView = lazy(() => import('./components/views/WhatsAppView'));
const FinanceiroView = lazy(() => import('./components/views/FinanceiroView'));
const ClientesView = lazy(() => import('./components/views/ClientesView'));
const RelatoriosView = lazy(() => import('./components/views/RelatoriosView'));
const ConfiguracoesView = lazy(() => import('./components/views/ConfiguracoesView'));
const RemuneracoesView = lazy(() => import('./components/views/RemuneracoesView'));
const VendasView = lazy(() => import('./components/views/VendasView'));
const ComandasView = lazy(() => import('./components/views/ComandasView'));
const CommandDetailView = lazy(() => import('./components/views/CommandDetailView'));
const CaixaView = lazy(() => import('./components/views/ControledeCaixaView'));
const ProdutosView = lazy(() => import('./components/views/ProdutosView'));
const ServicosView = lazy(() => import('./components/views/ServicosView'));
const EquipeView = lazy(() => import('./components/views/EquipeView'));
const MarketingView = lazy(() => import('./components/views/MarketingView'));
const PublicBookingPreview = lazy(() => import('./components/views/PublicBookingPreview'));
const LandingPageView = lazy(() => import('./components/views/LandingPageView'));
const StudioSetupWizard = lazy(() => import('./components/onboarding/StudioSetupWizard'));

import { mockTransactions } from './data/mockData';

const ViewLoader = () => (
  <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm">
    <Loader2 className="animate-spin text-orange-500 mb-2" size={32} />
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Processando...</p>
  </div>
);

const AppContent: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { activeStudioId, isSyncing, refreshStudios } = useStudio();
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [viewingPaidId, setViewingPaidId] = useState<string | null>(() => sessionStorage.getItem('open_paid_command'));
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);
  const [hash, setHash] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path === '/login' || path === '/login/') {
      return '';
    }
    return window.location.hash;
  });
  const [showLogin, setShowLogin] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path === '/login' || path === '/login/') {
      return true;
    }
    const currentHash = window.location.hash;
    return currentHash === '#/login' || currentHash === '#login';
  });

  // Sync state with hash change
  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash;
      const path = window.location.pathname.toLowerCase();
      
      setHash(currentHash);
      
      if (path === '/login' || path === '/login/') {
        setShowLogin(true);
        return;
      }

      if (currentHash === '#/login' || currentHash === '#login') {
        setShowLogin(true);
      } else if (currentHash === '' || currentHash === '#/' || currentHash === '#landing') {
        setShowLogin(false);
        if (currentHash === '' || currentHash === '#/') setCurrentView('dashboard');
      }
    };
    handleHashChange(); // Initial check
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Redirect logged-in users directly to dashboard, bypassing landing page or login page
  useEffect(() => {
    if (user) {
      const currentHash = window.location.hash;
      const path = window.location.pathname.toLowerCase();
      if (
        currentHash === '#/login' || 
        currentHash === '#login' || 
        currentHash === '#landing' || 
        path === '/login' || 
        path === '/login/'
      ) {
        window.history.replaceState(null, '', '/#/');
        setTimeout(() => {
          setHash('#/');
          setShowLogin(false);
          setCurrentView('dashboard');
        }, 0);
      }
    }
  }, [user]);

  if (hash.startsWith('#/public-preview')) return <Suspense fallback={<ViewLoader />}><PublicBookingPreview /></Suspense>;
  if (hash.startsWith('#/reset-password')) return <Suspense fallback={<ViewLoader />}><ResetPasswordView /></Suspense>;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  if (!user) {
    if (showLogin) {
      return (
        <LoginView 
          onBack={() => {
            const path = window.location.pathname.toLowerCase();
            if (path === '/login' || path === '/login/') {
              window.location.href = '/';
            } else {
              window.location.hash = '#landing';
            }
          }} 
        />
      );
    }
    return (
      <Suspense fallback={<ViewLoader />}>
        <LandingPageView onLogin={() => window.location.hash = '#login'} />
      </Suspense>
    );
  }

  const userRole = (user.papel as UserRole) || 'profissional';
  const isAdmin = userRole === 'admin' || userRole === 'gestor';

  if (!activeStudioId && !isAdmin) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <StudioSetupWizard />
      </Suspense>
    );
  }

  const handleAddTransaction = (t: FinancialTransaction) => setTransactions(prev => [t, ...prev]);
  const navigateToCommand = (id: string) => {
      setActiveCommandId(id);
      setCurrentView('comanda_detalhe');
  };

  const openPaidSummary = (id: string) => {
    sessionStorage.setItem('open_paid_command', id);
    setViewingPaidId(id);
  };

  const closePaidSummary = () => {
    sessionStorage.removeItem('open_paid_command');
    setViewingPaidId(null);
  };

  const renderView = () => {
    if (!hasAccess(userRole, currentView)) return <DashboardView onNavigate={setCurrentView} />;

    return (
      <Suspense fallback={<ViewLoader />}>
        {(() => {
          switch (currentView) {
            case 'dashboard': return <DashboardView onNavigate={setCurrentView} />;
            case 'agenda': return <AtendimentosView onAddTransaction={handleAddTransaction} onNavigateToCommand={navigateToCommand} />;
            case 'agenda_online': return <AgendaOnlineView />;
            case 'whatsapp': return <WhatsAppView />;
            case 'financeiro': return <FinanceiroView transactions={transactions} onAddTransaction={handleAddTransaction} />;
            case 'clientes': return <ClientesView />;
            case 'relatorios': return <RelatoriosView />;
            case 'configuracoes': return <ConfiguracoesView />;
            case 'remuneracoes': return <RemuneracoesView />;
            case 'vendas': return <VendasView onAddTransaction={handleAddTransaction} />;
            case 'comandas': return <ComandasView onAddTransaction={handleAddTransaction} onNavigateToCommand={navigateToCommand} onOpenPaidSummary={openPaidSummary} />;
            case 'comanda_detalhe': return <CommandDetailView commandId={activeCommandId!} onBack={() => setCurrentView('comandas')} />;
            case 'caixa': return <CaixaView />;
            case 'produtos': return <ProdutosView />;
            case 'servicos': return <ServicosView />;
            case 'equipe': return <EquipeView />;
            case 'marketing': return <MarketingView />;
            default: return <DashboardView onNavigate={setCurrentView} />;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <MainLayout currentView={currentView} onNavigate={setCurrentView}>
      {isSyncing && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-100 px-3 py-1.5 rounded-full shadow-lg animate-in slide-in-from-bottom-2">
           <Loader2 className="animate-spin text-orange-500" size={14} />
           <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sincronizando</span>
        </div>
      )}
      
      {viewingPaidId && (
        <PaidCommandDetailView 
          commandId={viewingPaidId} 
          onClose={closePaidSummary} 
        />
      )}

      {renderView()}
    </MainLayout>
  );
};

import { Toaster } from 'react-hot-toast';
import { Toaster as SonnerToaster } from 'sonner';

export default function App() {
  const { isOffline } = usePWA();

  return (
    <EnvGate>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          style: {
            borderRadius: '16px',
            background: '#1e293b',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 'bold',
          },
        }} />
        <SonnerToaster position="top-right" richColors closeButton />
        
        {/* PWA Components */}
        <PWAUpdateToast />
        <PWAInstallPrompt />

        {/* Offline Warning Banner */}
        {isOffline && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3.5 rounded-full shadow-[0_10px_30px_rgba(245,158,11,0.3)] flex items-center gap-2 border border-amber-400">
              <CloudOff size={14} className="animate-pulse text-amber-100" />
              <span>Você está offline — visualização somente leitura</span>
            </div>
          </div>
        )}

        <AppContent />
      </AuthProvider>
    </EnvGate>
  );
}