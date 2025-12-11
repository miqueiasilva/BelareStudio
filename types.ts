
// --- Enums and Types for Core Models ---

export type UserRole = 'admin' | 'gestor' | 'profissional' | 'recepcao';
export type AppointmentStatus = 'agendado' | 'confirmado' | 'confirmado_whatsapp' | 'chegou' | 'em_atendimento' | 'concluido' | 'cancelado' | 'bloqueado' | 'faltou' | 'em_espera';
export type AppointmentOrigin = 'interno' | 'link' | 'whatsapp';
export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto';
export type OrderStatus = 'aberta' | 'fechada' | 'cancelada';
export type OrderItemType = 'servico' | 'produto';

// Navigation State Type
export type ViewState = 
  | 'dashboard' 
  | 'agenda' 
  | 'agenda_online'
  | 'clientes' 
  | 'financeiro' 
  | 'configuracoes'
  | 'whatsapp'
  | 'relatorios'
  | 'remuneracoes'
  | 'vendas'
  | 'comandas'
  | 'caixa'
  | 'servicos'
  | 'produtos'
  | 'public_preview'; 

// --- Database Table Interfaces ---

export interface User {
  id: string; // uuid
  nome: string;
  papel: UserRole;
  avatar_url?: string;
  whatsapp?: string;
  email: string;
  ativo: boolean;
}

export interface Service {
  id: number;
  nome: string;
  duracao_min: number;
  preco: number;
  cor_hex?: string; // For styling appointment blocks
  ativo: boolean;
}

export interface Availability {
  id: number;
  user_id: string; // Foreign key to User
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 6=Saturday
  start_time: string; // "HH:mm:ss"
  end_time: string; // "HH:mm:ss"
}

export interface Client {
  id: number;
  nome: string;
  whatsapp?: string;
  email?: string;
  nascimento?: string; // "YYYY-MM-DD"
  tags?: string[];
  consent: boolean;
}

export interface Appointment {
  id: number;
  client_id?: number; // Foreign key to Client, optional for 'bloqueado'
  user_id: string; // Foreign key to User (Professional)
  service_id: number; // Foreign key to Service
  inicio: Date; // timestamptz
  fim: Date; // timestamptz
  status: AppointmentStatus;
  origem: AppointmentOrigin;
  notas?: string;
}

export interface Payment {
  id: number;
  appointment_id: number; // Foreign key to Appointment
  forma: PaymentMethod;
  valor: number;
  recebido: boolean;
  taxa?: number;
  data: Date; // timestamptz
}

export interface CashSession {
  id: number;
  data: string; // "YYYY-MM-DD"
  responsavel_id: string; // Foreign key to User
  abertura: number;
  fechamento?: number;
  diferenca?: number;
  obs?: string;
}

export interface Expense {
  id: number;
  data: string; // "YYYY-MM-DD"
  categoria: string;
  descricao: string;
  valor: number;
  forma: PaymentMethod;
  comprovante_url?: string;
}

export interface Commission {
  id: number;
  user_id: string; // Foreign key to User
  appointment_id: number; // Foreign key to Appointment
  regra: string;
  percentual: number;
  valor: number;
}

export interface Product {
  id: number;
  nome: string;
  sku?: string;
  qtd: number;
  custo?: number;
  preco: number;
  ativo: boolean;
}

export interface Order {
  id: number;
  client_id: number; // Foreign key to Client
  total: number;
  status: OrderStatus;
  created_at: Date; // timestamptz
}

export interface OrderItem {
  id: number;
  order_id: number; // Foreign key to Order
  tipo: OrderItemType;
  ref_id: number; // refers to service_id or product_id
  qtd: number;
  valor_unit: number;
  valor_total: number;
}

export interface Campaign {
    id: number;
    tipo: string;
    texto: string;
    cupom?: string;
    ativo: boolean;
    janela_inicio?: Date;
    janela_fim?: Date;
}


// --- Legacy types for mock data compatibility ---
// These can be phased out as real data is integrated.

export interface LegacyProfessional {
  id: number;
  name: string;
  avatarUrl: string;
  // Extended fields
  email?: string;
  phone?: string;
  role?: string;
  bio?: string;
  active?: boolean;
  onlineBooking?: boolean;
  commissionRate?: number;
  pixKey?: string;
  services?: number[]; // IDs of enabled services
  schedule?: { day: string; start: string; end: string; active: boolean }[];
}

export interface LegacyService {
  id: number;
  name: string;
  duration: number; // in minutes
  price: number;
  color: string; // For styling appointment blocks
  category?: string;
}

export interface LegacyAppointment {
  id: number;
  client?: Client; // Using new Client type
  professional: LegacyProfessional;
  service: LegacyService;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  notas?: string;
}

// --- Online Booking & Analytics ---

export interface OnlineBookingConfig {
    isActive: boolean;
    slug: string; // belaapp.com/slug
    studioName: string;
    description: string;
    coverUrl: string;
    logoUrl: string;
    timeIntervalMinutes: 15 | 20 | 30 | 60;
    minAdvanceHours: number; // Min hours before booking
    maxFutureDays: number; // Max days in future to book
    cancellationPolicyHours: number; // Hours before to cancel
    showStudioInSearch: boolean;
}

export interface Review {
    id: number;
    clientName: string;
    rating: number; // 1-5
    comment: string;
    date: Date;
    reply?: string;
    serviceName?: string;
}

export interface AnalyticsData {
    pageViews: {
        profile: number;
        gallery: number;
        details: number;
        reviews: number;
    };
    conversion: {
        started: number;
        completed: number;
        whatsappClicks: number;
    };
}

// --- Financial Types (New) ---

export type TransactionType = 'receita' | 'despesa';
export type TransactionCategory = 
  | 'servico' 
  | 'produto' 
  | 'comissao' 
  | 'aluguel' 
  | 'insumos' 
  | 'marketing' 
  | 'taxas' 
  | 'impostos' 
  | 'outros';

export interface FinancialTransaction {
  id: number;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: Date;
  paymentMethod: PaymentMethod;
  status: 'pago' | 'pendente';
  professionalId?: number; // If linked to a specific professional (commission or revenue gen)
  clientId?: number;
}

// --- WhatsApp & Chat Types (New) ---

export interface ChatMessage {
    id: string;
    sender: 'user' | 'client' | 'system';
    text: string;
    timestamp: Date;
    status: 'sent' | 'delivered' | 'read';
}

export interface ChatConversation {
    id: number;
    clientId: number;
    clientName: string;
    clientAvatar?: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    messages: ChatMessage[];
    tags?: string[];
}
