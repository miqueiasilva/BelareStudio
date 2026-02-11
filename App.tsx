import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useStudio } from './contexts/StudioContext';
import { ViewState, FinancialTransaction, UserRole } from './types';
import EnvGate from './components/EnvGate';
import { hasAccess } from './utils/permissions';
import { Loader2, ShieldAlert, LogOut, RefreshCw, AlertCircle } from 'lucide-react';

// Componentes estáticos
import MainLayout from './components/layout/MainLayout';
import LoginView from './components/views/LoginView';

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
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Carregando Módulo...</p>
  </div>
);

const AppContent: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { activeStudioId, loading: studioLoading, syncError, refreshStudios } = useStudio();
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  if (!user) return <LoginView />;

  // NOTA: Removido o gate de "Sincronizando unidade..." para permitir o boot instantâneo.
  // O app agora carrega o MainLayout diretamente.

  const isGlobalAdmin = user.papel === 'admin';

  // Só mostramos a tela de "Acesso Pendente" se:
  // 1. Não houver estúdio resolvido
  // 2. Não for Admin Global
  // 3. O processo inicial de sincronização já terminou (loading=false)
  if (!activeStudioId && !isGlobalAdmin && !studioLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 text-center border border-slate-200">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 leading-tight">Acesso Pendente</h2>
          <p className="text-slate-500 mt-4 font-medium leading-relaxed">
            Seu usuário ainda não possui permissão de acesso em nenhuma unidade ativa.
          </p>
          <div className="mt-10 space-y-3">
             <button onClick={() => refreshStudios(true)} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2">
               <RefreshCw size={18} /> Tentar Sincronizar
             </button>
             <button onClick={signOut} className="w-full py-4 text-rose-500 font-bold flex items-center justify-center gap-2 hover:bg-rose-50 rounded-2xl transition-all">
               <LogOut size={18} /> Sair do Sistema
             </button>
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

  const renderView = () => {
    const userRole = (user.papel as UserRole) || 'profissional';
    if (!hasAccess(userRole, currentView)) {
        return <DashboardView onNavigate={setCurrentView} />;
    }

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
            case 'comandas': return <ComandasView onAddTransaction={handleAddTransaction} onNavigateToCommand={navigateToCommand} />;
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
      {/* Indicador discreto de sincronização em background se necessário */}
      {studioLoading && (
        <div className="fixed bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 z-[100] flex items-center gap-2 animate-in slide-in-from-bottom-2">
           <Loader2 size={12} className="animate-spin text-orange-500" />
           <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sincronizando...</span>
        </div>
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