import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useStudio } from './contexts/StudioContext';
import { ViewState, FinancialTransaction, UserRole } from './types';
import EnvGate from './components/EnvGate';
import { hasAccess } from './utils/permissions';
import { Loader2, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

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
const CaixaView = lazy(() => import('./components/views/CaixaView'));
const ProdutosView = lazy(() => import('./components/views/ProdutosView'));
const ServicosView = lazy(() => import('./components/views/ServicosView'));
const EquipeView = lazy(() => import('./components/views/EquipeView'));
const MarketingView = lazy(() => import('./components/views/MarketingView'));
const PublicBookingPreview = lazy(() => import('./components/views/PublicBookingPreview'));

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
  
  // PERSISTÊNCIA DO MODAL: Salva no sessionStorage para sobreviver a trocas de aba e syncs
  const [viewingPaidId, setViewingPaidId] = useState<string | null>(() => {
    return sessionStorage.getItem('belare.open_paid_command');
  });

  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
      if (window.location.hash === '' || window.location.hash === '#/') setCurrentView('dashboard');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (hash === '#/public-preview') return <Suspense fallback={<ViewLoader />}><PublicBookingPreview /></Suspense>;
  if (hash === '#/reset-password') return <Suspense fallback={<ViewLoader />}><ResetPasswordView /></Suspense>;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  if (!user) return <LoginView />;

  const userRole = (user.papel as UserRole) || 'profissional';
  const isAdmin = userRole === 'admin' || userRole === 'gestor';

  if (!activeStudioId && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 text-center">
          <ShieldAlert size={60} className="mx-auto text-rose-500 mb-6" />
          <h2 className="text-2xl font-black text-slate-800">Unidade não definida</h2>
          <p className="text-slate-500 mt-4">Sincronize sua conta com uma unidade para continuar.</p>
          <div className="mt-8 flex flex-col gap-3">
             <button onClick={() => refreshStudios(true)} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2"><RefreshCw size={18} /> Sincronizar Agora</button>
             <button onClick={signOut} className="w-full py-4 text-rose-500 font-bold flex items-center justify-center gap-2">Sair</button>
          </div>
        </div>
      </div>
    );
  }

  const handleAddTransaction = (t: FinancialTransaction) => setTransactions(prev => [t, ...prev]);
  
  const navigateToCommand = (id: string) => {
      setActiveCommandId(id);
      setCurrentView('comanda_detalhe');
  };

  const openPaidSummary = (id: string) => {
    sessionStorage.setItem('belare.open_paid_command', id);
    setViewingPaidId(id);
  };

  const closePaidSummary = () => {
    sessionStorage.removeItem('belare.open_paid_command');
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

export default function App() {
  return (
    <EnvGate>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </EnvGate>
  );
}