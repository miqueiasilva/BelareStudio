
import React from 'react';
import { 
    Home, Calendar, MessageSquare, ShoppingCart, ClipboardList, ArrowRightLeft, Archive,
    Star, Package, Users, Settings, BarChart, Globe, Banknote, LogOut
} from 'lucide-react';
import { ViewState } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { hasAccess } from '../../utils/permissions';

interface SidebarProps {
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, className = '' }) => {
    const { user, signOut } = useAuth();
    
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

    const handleLogout = () => {
        signOut();
    };

    // Filter function based on permissions
    const filterItems = (items: typeof menuItems) => {
        return items.filter(item => hasAccess(user?.papel, item.id as ViewState));
    };

    const filteredMenu = filterItems(menuItems);
    const filteredSecondary = filterItems(secondaryItems);

    const renderItem = (item: any) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        
        return (
            <li key={item.label}>
                <button 
                    onClick={(e) => handleNavigation(e, item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                    ? 'bg-orange-100 text-orange-600' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}>
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                </button>
            </li>
        );
    }

    return (
        <aside className={`bg-white border-r border-slate-200 flex flex-col h-full ${className}`}>
            <div className="h-16 flex items-center px-4 gap-3 border-b border-slate-200 flex-shrink-0">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-sm shadow-orange-200">
                    B
                </div>
                <div>
                    <h1 className="font-bold text-slate-800 text-md leading-tight">BelaApp</h1>
                    <p className="text-[10px] text-slate-500 font-medium">Studio {user?.nome?.split(' ')[0] || 'Beleza'}</p>
                </div>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-200">
                <div className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mt-2">Principal</div>
                <ul className="space-y-0.5">
                    {filteredMenu.map(renderItem)}
                </ul>

                {filteredSecondary.length > 0 && (
                    <>
                        <div className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mt-6">Operacional</div>
                        <ul className="space-y-0.5">
                            {filteredSecondary.map(renderItem)}
                        </ul>
                    </>
                )}
            </nav>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 w-full p-2 rounded-lg text-slate-600">
                    <img 
                        src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.nome || 'User'}`} 
                        alt="User" 
                        className="w-9 h-9 rounded-full border border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{user?.nome || 'Usuário'}</p>
                        <p className="text-xs text-slate-500 capitalize">{user?.papel || 'Visitante'}</p>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors group" 
                        title="Sair do Sistema"
                    >
                        <LogOut size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
