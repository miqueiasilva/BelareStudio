
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    Home, Calendar, MessageSquare, ShoppingCart, ClipboardList, ArrowRightLeft, Archive,
    Star, Package, Users, Settings, BarChart, Globe, Banknote, LogOut, Briefcase, X
} from 'lucide-react';
import { ViewState, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { hasAccess } from '../../utils/permissions';
import { supabase } from '../../services/supabaseClient';

interface SidebarProps {
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    className?: string;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    onNavigate, 
    className = '', 
    isMobileOpen = false,
    onCloseMobile 
}) => {
    const { user } = useAuth();
    const location = useLocation();
    
    // FECHAR AUTOMATICAMENTE AO MUDAR DE ROTA (CORREÇÃO DE BUG MOBILE)
    useEffect(() => {
        if (onCloseMobile) onCloseMobile();
    }, [location.pathname, onCloseMobile]);

    const menuItems = [
        { id: 'dashboard', icon: Home, label: 'Página principal' },
        { id: 'agenda', icon: Calendar, label: 'Atendimentos' },
        { id: 'agenda_online', icon: Globe, label: 'Agenda Online' }, // ITEM CORRIGIDO
        { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
        { id: 'financeiro', icon: ArrowRightLeft, label: 'Fluxo de Caixa' },
        { id: 'clientes', icon: Users, label: 'Clientes' },
        { id: 'equipe', icon: Briefcase, label: 'Equipe' },
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

    const handleNavigation = (viewId: string) => {
        // CORREÇÃO: Removida lógica de window.open externa
        onNavigate(viewId as any);
    };

    const handleLogout = async () => {
        if (!window.confirm("Deseja realmente sair do Belaflow?")) return;
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Erro ao deslogar:", error);
        } finally {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/'; 
        }
    };

    const filterItems = (items: any[]) => {
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
                    onClick={() => handleNavigation(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                    isActive 
                    ? 'bg-orange-100 text-orange-600 shadow-sm border border-orange-200' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}>
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                </button>
            </li>
        );
    }

    return (
        <>
            {/* BACKDROP MOBILE (z-40) */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
                    onClick={onCloseMobile}
                />
            )}

            {/* SIDEBAR (z-50 no mobile) */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col h-full transform transition-transform duration-300 ease-in-out
                lg:relative lg:translate-x-0 
                ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                ${className}
            `}>
                <div className="h-20 flex items-center px-6 gap-3 border-b border-slate-100 flex-shrink-0 justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-orange-100">
                            B
                        </div>
                        <div>
                            <h1 className="font-black text-slate-800 text-base leading-tight tracking-tight">Belaflow</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">v1.2 Prod</p>
                        </div>
                    </div>
                    {/* Botão fechar (apenas mobile) */}
                    <button onClick={onCloseMobile} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                
                <nav className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                    <div className="mb-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-4 mt-2">Navegação</div>
                    <ul className="space-y-1">
                        {filteredMenu.map(renderItem)}
                    </ul>

                    {filteredSecondary.length > 0 && (
                        <>
                            <div className="mb-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-4 mt-8">Operacional</div>
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
        </>
    );
};

export default Sidebar;
