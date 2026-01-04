
import React from 'react';
import { 
    Store, Palette, Banknote, CalendarX, CreditCard, 
    ClipboardList, Tag, MessageSquare, Armchair, ChevronRight,
    FileText, Sparkles
} from 'lucide-react';

interface SettingsItem {
    id: string;
    icon: any;
    label: string;
    description: string;
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
            description: 'Dados da empresa, logotipo, banner e endereços', 
            action: () => onNavigate('profile')
        },
        { 
            id: 'payments', 
            icon: CreditCard, 
            label: 'Formas de Pagamento', 
            description: 'Configurar taxas de cartão, PIX e parcelamentos', 
            action: () => onNavigate('payments')
        },
        { 
            id: 'team', 
            icon: Banknote, 
            label: 'Comissões e Equipe', 
            description: 'Gerenciar colaboradores e regras de repasse', 
            action: () => onTopLevelNavigate('equipe')
        },
        { 
            id: 'blocks', 
            icon: CalendarX, 
            label: 'Indisponibilidades', 
            description: 'Bloqueios de agenda, feriados e folgas', 
            action: () => onTopLevelNavigate('agenda')
        },
        { 
            id: 'documents', 
            icon: FileText, 
            label: 'Fichas e Contratos', 
            description: 'Modelos de anamnese e termos de consentimento', 
            action: () => onTopLevelNavigate('clientes')
        },
        { 
            id: 'messages', 
            icon: MessageSquare, 
            label: 'Envio de Mensagens', 
            description: 'Automações de WhatsApp e lembretes', 
            action: () => onTopLevelNavigate('whatsapp')
        },
        { 
            id: 'theme', 
            icon: Palette, 
            label: 'Tema do Sistema', 
            description: 'Personalizar cores e identidade da agenda online', 
            action: () => onNavigate('theme')
        },
        { 
            id: 'resources', 
            icon: Armchair, 
            label: 'Controle de Recursos', 
            description: 'Salas, macas e equipamentos compartilhados', 
            action: () => onNavigate('resources')
        },
        { 
            id: 'discounts', 
            icon: Tag, 
            label: 'Cupons e Descontos', 
            description: 'Campanhas promocionais e regras de fidelidade', 
            action: () => onNavigate('discounts')
        },
    ];

    return (
        <div className="max-w-2xl mx-auto bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col divide-y divide-slate-100">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={item.action}
                        className="flex items-center gap-5 p-5 hover:bg-slate-50 transition-all text-left group active:bg-orange-50/30"
                    >
                        {/* Ícone à Esquerda */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-white group-hover:text-orange-500 group-hover:shadow-sm transition-all border border-transparent group-hover:border-orange-100">
                            <item.icon size={22} />
                        </div>

                        {/* Textos Centralizados */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-orange-600 transition-colors">
                                {item.label}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5 leading-tight truncate">
                                {item.description}
                            </p>
                        </div>

                        {/* Chevron à Direita */}
                        <div className="flex-shrink-0 text-slate-200 group-hover:text-orange-500 group-hover:translate-x-1 transition-all">
                            <ChevronRight size={18} strokeWidth={3} />
                        </div>
                    </button>
                ))}
            </div>
            
            {/* Rodapé do Hub */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    <Sparkles size={12} className="text-orange-300" />
                    BelareStudio Gestão Enterprise
                </p>
            </div>
        </div>
    );
};

export default SettingsHub;
