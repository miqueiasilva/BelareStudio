
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ViewState, FinancialTransaction, UserRole } from './types';
import EnvGate from './components/EnvGate';
import { hasAccess } from './utils/permissions';

// Layout & Views
import MainLayout from './components/layout/MainLayout';
import LoginView from './components/views/LoginView';
import ResetPasswordView from './components/views/ResetPasswordView';
import DashboardView from './components/views/DashboardView';
import AtendimentosView from './components/views/AtendimentosView';
import AgendaOnlineView from './components/views/AgendaOnlineView';
import WhatsAppView from './components/views/WhatsAppView';
import FinanceiroView from './components/views/FinanceiroView';
import ClientesView from './components/views/ClientesView';
import RelatoriosView from './components/views/RelatoriosView';
import ConfiguracoesView from './components/views/ConfiguracoesView';
import RemuneracoesView from './components/views/RemuneracoesView';
import VendasView from './components/views/VendasView';
import ComandasView from './components/views/ComandasView';
import CommandDetailView from './components/views/CommandDetailView';
import CaixaView from './components/views/CaixaView';
import ProdutosView from './components/views/ProdutosView';
import ServicosView from './components/views/ServicosView';
import EquipeView from './components/views/EquipeView';
import PublicBookingPreview from './components/views/PublicBookingPreview';

import { mockTransactions } from './data/mockData';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium font-sans">Carregando BelareStudio...</p>
        </div>
      </div>
    );
  }

  if (hash === '#/public-preview') return <PublicBookingPreview />;
  if (pathname === '/reset-password' || hash === '#/reset-password') return <ResetPasswordView />;
  if (!user) return <LoginView />;

  const handleAddTransaction = (t: FinancialTransaction) => setTransactions(prev => [t, ...prev]);

  const navigateToCommand = (id: string) => {
      setActiveCommandId(id);
      setCurrentView('comanda_detalhe');
  };

  const renderView = () => {
    if (!hasAccess(user.papel as UserRole, currentView)) {
        return <DashboardView onNavigate={setCurrentView} />;
    }

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
