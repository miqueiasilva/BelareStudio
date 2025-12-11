
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
import { FinancialTransaction } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

export type ViewState = 
  | 'dashboard' 
  | 'agenda' 
  | 'agenda_online'
  | 'clientes' 
  | 'financeiro' 
  | 'configuracoes'
  | 'whatsapp'
  | 'relatorios'
  | 'remuneracoes'
  | 'vendas'
  | 'comandas'
  | 'caixa'
  | 'servicos'
  | 'produtos'
  | 'public_preview'; 

// Internal component to handle routing logic after AuthProvider context is available
const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Shared State for Financial Transactions
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);

  const handleAddTransaction = (t: FinancialTransaction) => {
    setTransactions(prev => [t, ...prev]);
  };

  // Simple hash router for the public preview (bypass auth)
  useEffect(() => {
    const handleHashChange = () => {
        if (window.location.hash === '#/public-preview') {
            setCurrentView('public_preview');
        }
    };
    window.addEventListener('hashchange', handleHashChange);
    
    if (window.location.hash === '#/public-preview') {
        setCurrentView('public_preview');
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  // Public Routes
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
