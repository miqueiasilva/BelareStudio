
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useStudio } from './contexts/StudioContext';
import { ViewState, FinancialTransaction, UserRole } from './types';
import EnvGate from './components/EnvGate';
import { hasAccess } from './utils/permissions';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';

// Componentes estáticos (Carregamento Imediato)
import MainLayout from './components/layout/MainLayout';
import LoginView from './components/views/LoginView';

// Views Lazy Load (Code Splitting)
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
  const { activeStudioId, loading: studioLoading } = useStudio();
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);
  const [hash, setHash] = useState(window.location.hash);
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash;
      setHash(newHash);
      if (newHash === '' || newHash === '#/') setCurrentView('dashboard');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (authLoading || studioLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium font-sans">Sincronizando dados...</p>
        </div>
      </div>
    );
  }

  if (hash === '#/public-preview') return <Suspense fallback={<ViewLoader />}><PublicBookingPreview /></Suspense>;
  if (pathname === '/reset-password' || hash === '#/reset-password') return <Suspense fallback={<ViewLoader />}><ResetPasswordView /></Suspense>;
  if (!user) return <LoginView />;

  if (!activeStudioId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 text-center border border-slate-200 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 leading-tight">Nenhum Studio vinculado</h2>
          <p className="text-slate-500 mt-4 font-medium leading-relaxed">
            Seu usuário ainda não possui permissão de acesso a nenhuma unidade do <b>BelareStudio</b>.
          </p>
          <div className="mt-10 space-y-3">
             <button onClick={() => window.location.reload()} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95">Tentar Novamente</button>
             <button onClick={signOut} className="w-full py-4 text-rose-500 font-bold flex items-center justify-center gap-2 hover:bg-rose-50 rounded-2xl transition-all"><LogOut size={18} /> Sair do Sistema</button>
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
    if (!hasAccess(user.papel as UserRole, currentView)) {
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
            case 'comandas': return <ComandasView onAddTransaction={handleAddTransaction} />;
            case 'comanda_detalhe': return <CommandDetailView commandId={activeCommandId!} onBack={() => setCurrentView('comandas')} />;
            case 'caixa': return <CaixaView />;
            case 'produtos': return <ProdutosView />;
            case 'servicos': return <ServicosView />;
            case 'equipe': return <EquipeView />;
            case 'public_preview':
              window.location.hash = '/public-preview';
              return null;
            default: return <DashboardView onNavigate={setCurrentView} />;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <MainLayout currentView={currentView} onNavigate={setCurrentView}>
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
