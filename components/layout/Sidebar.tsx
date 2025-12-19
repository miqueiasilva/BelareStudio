
import React from 'react';
import { 
    Home, Calendar, MessageSquare, ShoppingCart, ClipboardList, ArrowRightLeft, Archive,
    Star, Package, Users, Settings, BarChart, Globe, Banknote, LogOut
} from 'lucide-react';
import { ViewState, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { hasAccess } from '../../utils/permissions';
import { supabase } from '../../services/supabaseClient';

interface SidebarProps {
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, className = '' }) => {
    const { user } = useAuth();
    
    const menuItems = [
        { id: 'dashboard', icon: Home, label: 'Página principal' },
        { id: 'agenda', icon: Calendar, label: 'Atendimentos' },
        { id: 'agenda_online', icon: Globe, label: 'Agenda Online' },
        { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
        { id: 'financeiro', icon: ArrowRightLeft, label: 'Fluxo de Caixa' },
        { id: 'clientes', icon: Users, label: 'Clientes' },
        { id: 'relatorios', icon: BarChart, label: 'Relatórios' },
        { id: 'configuracoes', icon: Settings, label: 'Configurações' },
    ];

    const secondaryItems = [
         { id: 'remuneracoes', icon: Banknote, label: 'Remunerações' },
         { id: 'vendas', icon: ShoppingCart, label: 'Vendas' },
         { id: 'comandas', icon: ClipboardList, label: 'Comandas' },
         { id: 'caixa', icon: Archive, label: 'Controle de Caixa' },
         { id: 'servicos', icon: Star, label: 'Serviços' },
         { id: 'produtos', icon: Package, label: 'Produtos' },
    ];

    const handleNavigation = (e: React.MouseEvent, viewId: string) => {
        e.preventDefault();
        onNavigate(viewId as ViewState);
    };

    const handleLogout = async () => {
        const confirm = window.confirm("Deseja realmente sair do sistema?");
        if (!confirm) return;

        try {
            // 1. Terminate Supabase session
            await supabase.auth.signOut();
            
            // 2. Clear local storage for safety (excluding supabase config keys)
            const url = localStorage.getItem('VITE_SUPABASE_URL');
            const key = localStorage.getItem('VITE_SUPABASE_ANON_KEY');
            localStorage.clear();
            sessionStorage.clear();
            if (url) localStorage.setItem('VITE_SUPABASE_URL', url);
            if (key) localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);

            // 3. Force redirect to root to clear memory and context
            window.location.href = '/'; 
        } catch (error) {
            console.error("Erro ao sair:", error);
            // Fallback redirect even if error
            window.location.href = '/';
        }
    };

    const filterItems = (items: typeof menuItems) => {
        return items.filter(item => hasAccess(user?.papel as UserRole, item.id as ViewState));
    };

    const filteredMenu = filterItems(menuItems);
    const filteredSecondary = filterItems(secondaryItems);

    const renderItem = (item: any) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        
        return (
            <li key={item.id}>
                <button 
                    onClick={(e) => handleNavigation(e, item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive 
                    ? 'bg-orange-100 text-orange-600 shadow-sm border border-orange-200' 
                    : 'text-slate-500 hover:bg-slate-100'
                }`}>
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                </button>
            </li>
        );
    }

    return (
        <aside className={`bg-white border-r border-slate-200 flex flex-col h-full ${className}`}>
            <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100 flex-shrink-0">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-orange-100">
                    B
                </div>
                <div>
                    <h1 className="font-black text-slate-800 text-base leading-tight tracking-tight">BelaApp</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Painel Administrativo</p>
                </div>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <div className="mb-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-3 mt-2">Principal</div>
                <ul className="space-y-1">
                    {filteredMenu.map(renderItem)}
                </ul>

                {filteredSecondary.length > 0 && (
                    <>
                        <div className="mb-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-3 mt-8">Operacional</div>
                        <ul className="space-y-1">
                            {filteredSecondary.map(renderItem)}
                        </ul>
                    </>
                )}
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                    <img 
                        src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.nome || 'User'}&background=random`} 
                        alt="User" 
                        className="w-10 h-10 rounded-full border-2 border-orange-100 shadow-sm object-cover"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-700 truncate leading-none mb-1">{user?.nome || 'Usuário'}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{user?.papel || 'Visitante'}</p>
                    </div>
                    
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer flex-shrink-0" 
                        title="Sair do Sistema"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
