
import React from 'react';
import { 
    Home, Calendar, MessageSquare, ShoppingCart, ClipboardList, ArrowRightLeft, Archive,
    Star, Package, Users, Settings, BarChart, Globe, Banknote
} from 'lucide-react';
import { ViewState } from '../../App';

interface SidebarProps {
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, className = '' }) => {
    
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
                    <p className="text-[10px] text-slate-500 font-medium">Studio Jacilene Felix</p>
                </div>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-200">
                <div className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mt-2">Principal</div>
                <ul className="space-y-0.5">
                    {menuItems.map(renderItem)}
                </ul>

                <div className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mt-6">Operacional</div>
                <ul className="space-y-0.5">
                    {secondaryItems.map(renderItem)}
                </ul>
            </nav>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
                <button className="flex items-center gap-3 w-full p-2 hover:bg-white rounded-lg transition-colors text-slate-600">
                    <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600">
                        JF
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-700">Jacilene Felix</p>
                        <p className="text-xs text-slate-500">Admin</p>
                    </div>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
