import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ViewState, FinancialTransaction } from './types';
import EnvGate from './components/EnvGate';

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
import CaixaView from './components/views/CaixaView';
import ProdutosView from './components/views/ProdutosView';
import ServicosView from './components/views/ServicosView';
import PublicBookingPreview from './components/views/PublicBookingPreview';

import { mockTransactions } from './data/mockData';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);
  const [hash, setHash] = useState(window.location.hash);
  const [pathname, setPathname] = useState(window.location.pathname);

  // Router listener
  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    // Pathname might change if Vercel redirects for reset password
    setPathname(window.location.pathname);
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Carregando BelaApp...</p>
        </div>
      </div>
    );
  }

  // --- PUBLIC & AUTH ROUTES ---
  
  // Public Booking Page
  if (hash === '#/public-preview') {
    return <PublicBookingPreview />;
  }

  // Password Reset Flow (Priority over login)
  if (pathname === '/reset-password' || hash === '#/reset-password') {
    return <ResetPasswordView />;
  }

  // --- AUTHENTICATION CHECK ---
  
  if (!user) {
    return <LoginView />;
  }

  // --- PROTECTED APP ---

  const handleAddTransaction = (t: FinancialTransaction) => {
    setTransactions(prev => [t, ...prev]);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'agenda':
        return <AtendimentosView onAddTransaction={handleAddTransaction} />;
      case 'agenda_online':
        return <AgendaOnlineView />;
      case 'whatsapp':
        return <WhatsAppView />;
      case 'financeiro':
        return <FinanceiroView transactions={transactions} onAddTransaction={handleAddTransaction} />;
      case 'clientes':
        return <ClientesView />;
      case 'relatorios':
        return <RelatoriosView />;
      case 'configuracoes':
        return <ConfiguracoesView />;
      case 'remuneracoes':
        return <RemuneracoesView />;
      case 'vendas':
        return <VendasView onAddTransaction={handleAddTransaction} />;
      case 'comandas':
        return <ComandasView onAddTransaction={handleAddTransaction} />;
      case 'caixa':
        return <CaixaView />;
      case 'produtos':
        return <ProdutosView />;
      case 'servicos':
        return <ServicosView />;
      case 'public_preview':
        window.location.hash = '/public-preview';
        return null;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
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