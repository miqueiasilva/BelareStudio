
import React from 'react';
import { 
    Home, Calendar, MessageSquare, ShoppingCart, ClipboardList, ArrowRightLeft, Archive,
    Star, Package, Users, Settings, BarChart, Globe, Banknote, LogOut, Briefcase, Sparkles
} from 'lucide-react';
import { ViewState, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { hasAccess } from '../../utils/permissions';
import { StudioSwitcher } from './StudioSwitcher';

interface SidebarProps {
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    className?: string;
}

interface MenuItem {
    id: ViewState;
    icon: any;
    label: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, className = '' }) => {
    const { user, signOut } = useAuth();
    const userRole = (user?.papel as UserRole) || 'profissional';

    const principalItems: MenuItem[] = [
        { id: 'dashboard', icon: Home, label: 'Página principal' },
        { id: 'agenda', icon: Calendar, label: 'Atendimentos' },
        { id: 'agenda_online', icon: Globe, label: 'Agenda Online' },
        { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
        { id: 'clientes', icon: Users, label: 'Clientes' },
    ];

    const gestaoItems: MenuItem[] = [
        { id: 'financeiro', icon: ArrowRightLeft, label: 'Fluxo de Caixa' },
        { id: 'relatorios', icon: BarChart, label: 'Relatórios' },
        { id: 'equipe', icon: Briefcase, label: 'Equipe' }, 
        { id: 'marketing', icon: Sparkles, label: 'Marketing IA' },
        { id: 'remuneracoes', icon: Banknote, label: 'Remunerações' },
        { id: 'configuracoes', icon: Settings, label: 'Configurações' },
    ];

    const operacionalItems: MenuItem[] = [
        { id: 'vendas', icon: ShoppingCart, label: 'Vendas (PDV)' },
        { id: 'comandas', icon: ClipboardList, label: 'Comandas' },
        { id: 'caixa', icon: Archive, label: 'Controle de Caixa' },
        { id: 'servicos', icon: Star, label: 'Serviços' },
        { id: 'produtos', icon: Package, label: 'Produtos' },
    ];

    const filter = (items: MenuItem[]) => items.filter(item => hasAccess(userRole, item.id));

    const filteredPrincipal = filter(principalItems);
    const filteredGestao = filter(gestaoItems);
    const filteredOperacional = filter(operacionalItems);

    const handleNavigation = (e: React.MouseEvent, viewId: string) => {
        e.preventDefault();
        onNavigate(viewId as ViewState);
    };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (e) {
            console.error("Erro ao sair:", e);
            // Fallback em caso de erro crítico no Supabase
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
        }
    };

    const renderItem = (item: MenuItem) => {
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
            <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100 flex-shrink-0 mb-4">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-orange-100">
                    B
                </div>
                <div>
                    <h1 className="font-black text-slate-800 text-base leading-tight tracking-tight">BelareStudio</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão Inteligente</p>
                </div>
            </div>

            <StudioSwitcher />
            
            <nav className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                {filteredPrincipal.length > 0 && (
                    <div className="mb-6">
                        <div className="mb-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-3">Principal</div>
                        <ul className="space-y-1">
                            {filteredPrincipal.map(renderItem)}
                        </ul>
                    </div>
                )}

                {filteredOperacional.length > 0 && (
                    <div className="mb-6">
                        <div className="mb-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-3">Operação</div>
                        <ul className="space-y-1">
                            {filteredOperacional.map(renderItem)}
                        </ul>
                    </div>
                )}

                {filteredGestao.length > 0 && (
                    <div className="mb-6">
                        <div className="mb-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-3">Gestão</div>
                        <ul className="space-y-1">
                            {filteredGestao.map(renderItem)}
                        </ul>
                    </div>
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{userRole}</p>
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
