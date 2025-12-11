
import React, { useState, useEffect } from 'react';
import ErrorBoundary from "./components/ErrorBoundary";
import MainLayout from './components/layout/MainLayout';
import AtendimentosView from './components/views/AtendimentosView';
import DashboardView from './components/views/DashboardView';
import AgendaOnlineView from './components/views/AgendaOnlineView';
import RemuneracoesView from './components/views/RemuneracoesView';
import FinanceiroView from './components/views/FinanceiroView';
import ClientesView from './components/views/ClientesView'; 
import WhatsAppView from './components/views/WhatsAppView'; 
import RelatoriosView from './components/views/RelatoriosView'; 
import ConfiguracoesView from './components/views/ConfiguracoesView';
import PublicBookingPreview from './components/views/PublicBookingPreview';
import VendasView from './components/views/VendasView';
import ComandasView from './components/views/ComandasView';
import CaixaView from './components/views/CaixaView';
import ServicosView from './components/views/ServicosView';
import ProdutosView from './components/views/ProdutosView';
import LoginView from './components/views/LoginView';
import { mockTransactions } from './data/mockData';
import { FinancialTransaction, ViewState } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { hasAccess } from './utils/permissions';

// Internal component to handle routing logic after AuthProvider context is available
const AppContent = () => {
  const { user, loading } = useAuth();
  
  // Initialize view based on URL hash to prevent flickering or auth redirects
  const [currentView, setCurrentView] = useState<ViewState>(() => {
      return window.location.hash.includes('public-preview') ? 'public_preview' : 'dashboard';
  });
  
  // Shared State for Financial Transactions
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);

  const handleAddTransaction = (t: FinancialTransaction) => {
    setTransactions(prev => [t, ...prev]);
  };

  // Hash router listener
  useEffect(() => {
    const handleHashChange = () => {
        if (window.location.hash.includes('public-preview')) {
            setCurrentView('public_preview');
        }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Reset view when user logs out, BUT ignore if on public preview
  useEffect(() => {
    if (!user && !window.location.hash.includes('public-preview')) {
      setCurrentView('dashboard');
    }
  }, [user]);

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  // Public Routes (Bypass Auth)
  if (currentView === 'public_preview') {
      return (
        <ErrorBoundary>
            <PublicBookingPreview />
        </ErrorBoundary>
      );
  }

  // Protected Routes - If no user, show Login
  if (!user) {
      return <LoginView />;
  }

  const renderView = () => {
    // Permission Guard
    if (!hasAccess(user.papel, currentView)) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <div className="text-4xl mb-2">🚫</div>
                <h2 className="text-xl font-bold text-slate-700">Acesso Negado</h2>
                <p>Seu perfil ({user.papel}) não tem permissão para acessar esta área.</p>
                <button 
                    onClick={() => setCurrentView('dashboard')}
                    className="mt-4 text-orange-500 font-bold hover:underline"
                >
                    Voltar ao Início
                </button>
            </div>
        );
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'agenda':
        return <AtendimentosView onAddTransaction={handleAddTransaction} />;
      case 'agenda_online':
        return <AgendaOnlineView />;
      case 'remuneracoes':
        return <RemuneracoesView />;
      case 'financeiro':
        return <FinanceiroView transactions={transactions} onAddTransaction={handleAddTransaction} />; 
      case 'clientes':
        return <ClientesView />; 
      case 'whatsapp':
        return <WhatsAppView />; 
      case 'relatorios':
        return <RelatoriosView />; 
      case 'configuracoes':
        return <ConfiguracoesView />;
      case 'vendas':
        return <VendasView onAddTransaction={handleAddTransaction} />;
      case 'comandas':
        return <ComandasView onAddTransaction={handleAddTransaction} />;
      case 'caixa':
        return <CaixaView />;
      case 'servicos':
        return <ServicosView />;
      case 'produtos':
        return <ProdutosView />;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <ErrorBoundary>
      <MainLayout currentView={currentView} onNavigate={setCurrentView}>
        {renderView()}
      </MainLayout>
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
