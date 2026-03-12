
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

export const hasAccess = (role: UserRole | string | undefined, view: ViewState, granularPermissions?: Record<string, boolean>): boolean => {
    if (!role) return false;
    
    const normalizedRole = role.toLowerCase();
    
    // Admins e Gestores sempre têm acesso total
    if (normalizedRole === 'admin' || normalizedRole === 'gestor') return true;

    // Se houver permissões granulares, elas podem sobrescrever as travas do papel
    if (granularPermissions) {
        // Mapeamento de ViewState para chaves de permissão
        const permissionMap: Record<string, string> = {
            'financeiro': 'view_finance',
            'caixa': 'view_finance',
            'vendas': 'view_finance',
            'relatorios': 'view_reports',
            'remuneracoes': 'view_remunerations',
            'clientes': 'view_clients',
            'configuracoes': 'view_settings',
            'produtos': 'edit_stock',
            'equipe': 'view_remunerations', // Geralmente quem vê remuneração vê equipe
        };

        const requiredPermission = permissionMap[view];
        if (requiredPermission && granularPermissions[requiredPermission]) {
            return true;
        }
    }

    const permissions = ROLE_PERMISSIONS[normalizedRole as UserRole] || ROLE_PERMISSIONS['profissional'];
    if (permissions.includes('*')) return true;
    return permissions.includes(view);
};

export const getFirstAllowedView = (role: UserRole | string | undefined): ViewState => {
    if (!role) return 'dashboard';
    const normalizedRole = role.toLowerCase();
    const permissions = ROLE_PERMISSIONS[normalizedRole as UserRole] || ROLE_PERMISSIONS['profissional'];
    if (permissions.includes('*')) return 'dashboard';
    return (permissions[0] as ViewState) || 'dashboard';
};
