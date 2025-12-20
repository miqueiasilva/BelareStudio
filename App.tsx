
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Outlet, useNavigate } from 'react-router-dom';
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
import EquipeView from './components/views/EquipeView';
import PublicBookingView from './components/views/PublicBookingView';

import { mockTransactions } from './data/mockData';

// --- Componente de Proteção de Rota ---
const PrivateRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Autenticando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

// --- Layout Administrativo (Sync de URL com MainLayout) ---
const AdminWrapper: React.FC<{ transactions: FinancialTransaction[], onAddTransaction: (t: FinancialTransaction) => void }> = ({ transactions, onAddTransaction }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Mapeia o path atual para o ViewState esperado pelo MainLayout legado
  const getViewFromPath = (path: string): ViewState => {
    const cleanPath = path.replace('/', '') || 'dashboard';
    return cleanPath as ViewState;
  };

  const currentView = getViewFromPath(location.pathname);

  return (
    <MainLayout currentView={currentView} onNavigate={(view) => navigate(`/${view}`)}>
      <Outlet context={{ transactions, onAddTransaction }} />
    </MainLayout>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);

  // 1. BYPASS DE ROTA PÚBLICA: Verifica antes de qualquer lógica de Auth
  const isPublicRoute = location.pathname === '/agendar' || location.pathname === '/public-preview';

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/agendar" element={<PublicBookingView />} />
        <Route path="/public-preview" element={<PublicBookingView />} />
      </Routes>
    );
  }

  // 2. LÓGICA PADRÃO DO SISTEMA
  const handleAddTransaction = (t: FinancialTransaction) => {
    setTransactions(prev => [t, ...prev]);
  };

  return (
    <Routes>
      {/* Rota de Login */}
      <Route path="/login" element={<LoginView />} />
      <Route path="/reset-password" element={<ResetPasswordView />} />

      {/* Rotas Protegidas */}
      <Route element={<PrivateRoute />}>
        <Route element={<AdminWrapper transactions={transactions} onAddTransaction={handleAddTransaction} />}>
          <Route index element={<DashboardView onNavigate={(v) => navigate(`/${v}`)} />} />
          <Route path="dashboard" element={<DashboardView onNavigate={(v) => navigate(`/${v}`)} />} />
          <Route path="agenda" element={<AtendimentosView onAddTransaction={handleAddTransaction} />} />
          <Route path="agenda_online" element={<AgendaOnlineView />} />
          <Route path="whatsapp" element={<WhatsAppView />} />
          <Route path="financeiro" element={<FinanceiroView />} />
          <Route path="clientes" element={<ClientesView />} />
          <Route path="relatorios" element={<RelatoriosView />} />
          <Route path="configuracoes" element={<ConfiguracoesView />} />
          <Route path="remuneracoes" element={<RemuneracoesView />} />
          <Route path="vendas" element={<VendasView />} />
          <Route path="comandas" element={<ComandasView />} />
          <Route path="caixa" element={<CaixaView />} />
          <Route path="produtos" element={<ProdutosView />} />
          <Route path="servicos" element={<ServicosView />} />
          <Route path="equipe" element={<EquipeView />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <EnvGate>
      <HashRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </HashRouter>
    </EnvGate>
  );
}
