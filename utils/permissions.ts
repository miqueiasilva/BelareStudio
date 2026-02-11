import { UserRole, ViewState } from '../types';

const ROLE_PERMISSIONS: Record<UserRole, (ViewState | '*')[]> = {
    // Admins e Gestores: Acesso irrestrito a todos os módulos
    admin: ['*'],
    gestor: ['*'],
    
    // Recepção: Operacional completo e gestão de estoque/serviços
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
    
    // Profissional (Staff): Foco na jornada do cliente
    // Bloqueados: Financeiro Global, Relatórios e Gestão de Equipe
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
    const normalizedRole = role.toLowerCase() as UserRole;
    
    // Admins e Gestores pulam qualquer verificação
    if (normalizedRole === 'admin' || normalizedRole === 'gestor') return true;

    const permissions = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS['profissional'];
    if (permissions.includes('*')) return true;
    return permissions.includes(view);
};

export const getFirstAllowedView = (role: UserRole | string | undefined): ViewState => {
    if (!role) return 'dashboard';
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'admin' || normalizedRole === 'gestor') return 'dashboard';
    
    const permissions = ROLE_PERMISSIONS[normalizedRole as UserRole] || ROLE_PERMISSIONS['profissional'];
    return (permissions[0] as ViewState) || 'dashboard';
};