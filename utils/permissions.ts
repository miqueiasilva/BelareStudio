
import { UserRole, ViewState } from '../types';

// Defines which views each role can access
const ROLE_PERMISSIONS: Record<UserRole, (ViewState | '*')[]> = {
    // Admin & Gestor have full access
    admin: ['*'],
    gestor: ['*'],
    
    // Reception: Operational focus (No financials/reports/settings)
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
        'whatsapp'
    ],
    
    // Professional: Service focus (No cash, inventory, settings, sensitive data)
    profissional: [
        'dashboard', 
        'agenda', 
        'clientes', 
        'comandas', 
        'whatsapp'
    ]
};

export const hasAccess = (role: UserRole | undefined, view: ViewState): boolean => {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role];
    if (permissions.includes('*')) return true;
    return permissions.includes(view);
};

export const getFirstAllowedView = (role: UserRole | undefined): ViewState => {
    if (!role) return 'dashboard';
    const permissions = ROLE_PERMISSIONS[role];
    if (permissions.includes('*')) return 'dashboard';
    // Return the first valid view, fallback to dashboard
    return (permissions[0] as ViewState) || 'dashboard';
};
