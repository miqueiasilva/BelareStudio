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
import ViewPlaceholder from './components/views/ViewPlaceholder';
import { mockTransactions } from './data/mockData';
import { FinancialTransaction } from './types';

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

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Shared State for Financial Transactions
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);

  const handleAddTransaction = (t: FinancialTransaction) => {
    setTransactions(prev => [t, ...prev]);
  };

  // Simple hash router for the preview
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

  const renderView = () => {
    if (currentView === 'public_preview') {
        return <PublicBookingPreview />;
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
        return <ViewPlaceholder title="PDV - Vendas Rápidas" />;
      case 'comandas':
        return <ViewPlaceholder title="Comandas Digitais" />;
      case 'caixa':
        return <ViewPlaceholder title="Controle de Caixa" />;
      case 'servicos':
        return <ViewPlaceholder title="Catálogo de Serviços" />;
      case 'produtos':
        return <ViewPlaceholder title="Gestão de Estoque" />;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  if (currentView === 'public_preview') {
      return (
        <ErrorBoundary>
            <PublicBookingPreview />
        </ErrorBoundary>
      );
  }

  return (
    <ErrorBoundary>
      <MainLayout currentView={currentView} onNavigate={setCurrentView}>
        {renderView()}
      </MainLayout>
    </ErrorBoundary>
  );
}
