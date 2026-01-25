
import { UserRole, ViewState } from '../types';

const ROLE_PERMISSIONS: Record<UserRole, (ViewState | '*')[]> = {
    // Admins e Gestores: Acesso irrestrito a todos os módulos
    admin: ['*'],
    gestor: ['*'],
    
    // Recepção: Operacional completo e gestão de estoque/serviços, exceto faturamento bruto e equipe
    recepcao: [
        'dashboard', 
        'agenda', 
        'agenda_online', 
        'clientes', 
        'vendas', 
        'comandas', 
        'caixa', 
        'servicos', 
        'produtos',
        'whatsapp',
        'marketing'
    ],
    
    // Profissional (Staff): Foco total na jornada do cliente e lançamentos de consumo
    // Bloqueados: Financeiro Global, Relatórios de Lucro, Configurações de Studio e Gestão de Equipe
    profissional: [
        'dashboard', 
        'agenda', 
        'agenda_online', 
        'clientes', 
        'whatsapp',
        'comandas', 
        'vendas',
        'marketing'
    ]
};

export const hasAccess = (role: UserRole | string | undefined, view: ViewState): boolean => {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role as UserRole] || ROLE_PERMISSIONS['profissional'];
    if (permissions.includes('*')) return true;
    return permissions.includes(view);
};

export const getFirstAllowedView = (role: UserRole | string | undefined): ViewState => {
    if (!role) return 'dashboard';
    const permissions = ROLE_PERMISSIONS[role as UserRole] || ROLE_PERMISSIONS['profissional'];
    if (permissions.includes('*')) return 'dashboard';
    return (permissions[0] as ViewState) || 'dashboard';
};
