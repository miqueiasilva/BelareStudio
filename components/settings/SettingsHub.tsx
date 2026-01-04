
import React from 'react';
import { 
    Store, Palette, Banknote, CalendarX, CreditCard, 
    ClipboardList, Tag, MessageSquare, Armchair, ChevronRight 
} from 'lucide-react';

interface SettingsItem {
    id: string;
    icon: any;
    label: string;
    description: string;
    color: string;
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
            description: 'Dados da empresa, logo, banner e endereços', 
            color: 'bg-blue-500',
            action: () => onNavigate('profile')
        },
        { 
            id: 'payments', 
            icon: CreditCard, 
            label: 'Formas de Pagamento', 
            description: 'Configurar taxas de cartão, PIX e parcelamentos', 
            color: 'bg-emerald-500',
            action: () => onNavigate('payments')
        },
        { 
            id: 'commission', 
            icon: Banknote, 
            label: 'Comissões e Repasses', 
            description: 'Gerenciar regras de ganho da equipe', 
            color: 'bg-orange-500',
            action: () => onTopLevelNavigate('remuneracoes')
        },
        { 
            id: 'blocks', 
            icon: CalendarX, 
            label: 'Indisponibilidades', 
            description: 'Bloqueios de agenda e feriados', 
            color: 'bg-rose-500',
            action: () => onTopLevelNavigate('agenda')
        },
        { 
            id: 'discounts', 
            icon: Tag, 
            label: 'Cupons e Descontos', 
            description: 'Campanhas promocionais e fidelidade', 
            color: 'bg-purple-500',
            action: () => onNavigate('hub') // Placeholder
        },
        { 
            id: 'messages', 
            icon: MessageSquare, 
            label: 'Envio de Mensagens', 
            description: 'Textos automáticos de WhatsApp e retorno', 
            color: 'bg-teal-500',
            action: () => onTopLevelNavigate('whatsapp')
        },
        { 
            id: 'resources', 
            icon: Armchair, 
            label: 'Controle de Recursos', 
            description: 'Salas, macas e equipamentos compartilhados', 
            color: 'bg-indigo-500',
            action: () => onNavigate('hub') // Placeholder
        },
        { 
            id: 'appearance', 
            icon: Palette, 
            label: 'Tema do Sistema', 
            description: 'Cores, fontes e identidade visual da agenda online', 
            color: 'bg-pink-500',
            action: () => onNavigate('hub') // Placeholder
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {menuItems.map((item) => (
                <button
                    key={item.id}
                    onClick={item.action}
                    className="flex items-center gap-5 p-5 bg-white rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all text-left group active:scale-[0.98]"
                >
                    <div className={`w-14 h-14 rounded-2xl ${item.color} text-white flex items-center justify-center shadow-lg shadow-slate-100 group-hover:scale-110 transition-transform`}>
                        <item.icon size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-800 text-base leading-tight group-hover:text-orange-600 transition-colors">
                            {item.label}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-1 leading-tight line-clamp-1">
                            {item.description}
                        </p>
                    </div>
                    <ChevronRight size={20} className="text-slate-200 group-hover:text-orange-500 transition-colors" strokeWidth={3} />
                </button>
            ))}
        </div>
    );
};

export default SettingsHub;
