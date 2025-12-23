
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ViewState, FinancialTransaction } from './types';
import EnvGate from './components/EnvGate';
import { supabase } from './services/supabaseClient';

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

// --- TELA DE CARREGAMENTO COM FALLBACK ---
const LoadingScreen = () => {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Se o sistema não carregar em 8 segundos, mostra o botão de reinicialização forçada
    const timer = setTimeout(() => setShowFallback(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const forceLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload(); // Recarga física da página
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4 font-sans p-6 text-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-orange-100 rounded-full"></div>
        <div className="absolute top-0 w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      <div className="mt-4 animate-pulse">
        <p className="text-slate-700 font-black text-xl tracking-tight">Sincronizando Belaflow...</p>
        <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
          Preparando seu estúdio para o dia de hoje.
        </p>
      </div>

      {showFallback && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-6 rounded-[32px] shadow-xl border border-orange-100 max-w-sm">
            <p className="text-xs text-slate-500 font-medium mb-4">
              A conexão está demorando mais do que o esperado. Isso pode ser instabilidade na rede ou sessão expirada.
            </p>
            <button 
              onClick={forceLogout}
              className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95"
            >
              Reiniciar Sistema
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- WRAPPER PARA ÁREA ADMINISTRATIVA ---
const AdminWrapper: React.FC<{ transactions: FinancialTransaction[], onAddTransaction: (t: FinancialTransaction) => void }> = ({ transactions, onAddTransaction }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = (location.pathname.replace('/', '') || 'dashboard') as ViewState;

  return (
    <MainLayout currentView={currentView} onNavigate={(view) => navigate(`/${view}`)}>
      <Outlet context={{ transactions, onAddTransaction }} />
    </MainLayout>
  );
};

// --- GERENCIADOR DE ROTAS INTERNO ---
function AppRoutes() {
  const { user, loading } = useAuth();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(mockTransactions);
  const location = useLocation();
  
  const path = location.pathname;

  // 1. ROTAS PÚBLICAS
  if (path === '/agendar' || path === '/public-preview') {
    return <PublicBookingView />;
  }

  // 2. RECUPERAÇÃO DE SENHA
  if (path === '/reset-password') {
    return <ResetPasswordView />;
  }

  // 3. ESTADO DE CARREGAMENTO
  if (loading) {
    return <LoadingScreen />;
  }

  // 4. NÃO AUTENTICADO
  if (!user) {
    return <LoginView />;
  }

  // 5. AUTENTICADO
  const handleAddTransaction = (t: FinancialTransaction) => {
    setTransactions(prev => [t, ...prev]);
  };

  return (
    <Routes>
      <Route element={<AdminWrapper transactions={transactions} onAddTransaction={handleAddTransaction} />}>
        <Route index element={<DashboardView onNavigate={(v) => window.location.hash = `#/${v}`} />} />
        <Route path="dashboard" element={<DashboardView onNavigate={(v) => window.location.hash = `#/${v}`} />} />
        <Route path="agenda" element={<AtendimentosView />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <EnvGate>
      <HashRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </EnvGate>
  );
}
