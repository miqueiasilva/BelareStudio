
import React from 'react';
import { 
    Store, Palette, Banknote, CalendarX, CreditCard, 
    Tag, Armchair, ChevronRight, Home, LayoutGrid, Sparkles
} from 'lucide-react';

interface SettingsItem {
    id: string;
    icon: any;
    label: string;
    description: string;
    iconColor: string;
    iconBg: string;
    action: () => void;
}

interface SettingsHubProps {
    onNavigate: (view: string) => void;
    onTopLevelNavigate: (view: any) => void;
}

const SettingsHub: React.FC<SettingsHubProps> = ({ onNavigate, onTopLevelNavigate }) => {
    const menuItems: SettingsItem[] = [
        { 
            id: 'profile', 
            icon: Store, 
            label: 'Perfil do Negócio', 
            description: 'Logotipo, banner, horários e endereços da empresa', 
            iconColor: 'text-blue-600',
            iconBg: 'bg-blue-50',
            action: () => onNavigate('profile')
        },
        { 
            id: 'payments', 
            icon: CreditCard, 
            label: 'Pagamentos & Taxas', 
            description: 'Configurar taxas de cartão, PIX e regras de parcelamento', 
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-50',
            action: () => onNavigate('payments')
        },
        { 
            id: 'financial_categories', 
            icon: Tag, 
            label: 'Categorias Financeiras', 
            description: 'Gerenciar categorias de receitas e despesas para o fluxo de caixa e DRE', 
            iconColor: 'text-orange-600',
            iconBg: 'bg-orange-50',
            action: () => onNavigate('financial_categories')
        },
        { 
            id: 'theme', 
            icon: Palette, 
            label: 'Tema do Sistema', 
            description: 'Cores, fontes e identidade visual do seu estúdio', 
            iconColor: 'text-pink-600',
            iconBg: 'bg-pink-50',
            action: () => onNavigate('theme')
        },
        { 
            id: 'resources', 
            icon: Armchair, 
            label: 'Controle de Recursos', 
            description: 'Gerenciar salas, macas e equipamentos', 
            iconColor: 'text-indigo-600',
            iconBg: 'bg-indigo-50',
            action: () => onNavigate('resources')
        },
        { 
            id: 'discounts', 
            icon: Tag, 
            label: 'Cupons e Descontos', 
            description: 'Criar promoções e regras de fidelidade', 
            iconColor: 'text-purple-600',
            iconBg: 'bg-purple-50',
            action: () => onNavigate('discounts')
        },
        { 
            id: 'blocks', 
            icon: CalendarX, 
            label: 'Indisponibilidades', 
            description: 'Bloqueios de agenda, feriados e folgas da equipe', 
            iconColor: 'text-rose-600',
            iconBg: 'bg-rose-50',
            action: () => onNavigate('blocks')
        },
        { 
            id: 'dashboard', 
            icon: Home, 
            label: 'Voltar ao Início', 
            description: 'Retornar para o painel de indicadores principal', 
            iconColor: 'text-slate-600',
            iconBg: 'bg-slate-50',
            action: () => onTopLevelNavigate('dashboard')
        },
    ];

    return (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white shadow-sm border border-slate-200 rounded-[28px] overflow-hidden">
                <div className="flex flex-col divide-y divide-slate-100">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={item.action}
                            className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-all text-left group active:bg-orange-50/30"
                        >
                            {/* Ícone à Esquerda com fundo colorido */}
                            <div className={`flex-shrink-0 w-12 h-12 rounded-2xl ${item.iconBg} ${item.iconColor} flex items-center justify-center transition-transform group-hover:scale-105`}>
                                <item.icon size={24} />
                            </div>

                            {/* Conteúdo Central */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 text-sm md:text-base leading-tight group-hover:text-orange-600 transition-colors">
                                    {item.label}
                                </h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5 leading-tight line-clamp-1">
                                    {item.description}
                                </p>
                            </div>

                            {/* Seta indicativa à Direita */}
                            <div className="flex-shrink-0 text-slate-200 group-hover:text-orange-500 group-hover:translate-x-1 transition-all">
                                <ChevronRight size={20} strokeWidth={3} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Rodapé institucional do Hub */}
            <div className="mt-8 flex flex-col items-center justify-center opacity-30 gap-2">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-orange-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">BelareStudio Enterprise</span>
                </div>
                <p className="text-[9px] font-bold text-slate-400">Versão 2.4.0 • Built with JaciBot AI</p>
            </div>
        </div>
    );
};

export default SettingsHub;
