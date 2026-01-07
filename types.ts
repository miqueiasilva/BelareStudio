
export type ViewState = 
  | 'dashboard' 
  | 'agenda' 
  | 'agenda_online' 
  | 'whatsapp' 
  | 'financeiro' 
  | 'clientes' 
  | 'relatorios' 
  | 'configuracoes' 
  | 'remuneracoes' 
  | 'vendas' 
  | 'comandas' 
  | 'comanda_detalhe'
  | 'caixa' 
  | 'produtos' 
  | 'servicos' 
  | 'public_preview' 
  | 'equipe';

export type UserRole = 'admin' | 'gestor' | 'recepcao' | 'profissional';

export type AppointmentStatus = 
  | 'confirmado' 
  | 'confirmado_whatsapp' 
  | 'agendado' 
  | 'chegou' 
  | 'concluido' 
  | 'cancelado' 
  | 'bloqueado' 
  | 'faltou' 
  | 'em_atendimento' 
  | 'em_espera';

export type TransactionType = 'receita' | 'despesa' | 'income' | 'expense';

export type TransactionCategory = string;

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto';

export interface ScheduleBlock {
  id: string;
  professional_id: string | null; // null significa "Loja Inteira"
  start_time: string; // ISO Timestamp
  end_time: string;   // ISO Timestamp
  reason: string;
  created_at?: string;
}

export interface Client {
  id?: number;
  nome: string;
  whatsapp?: string;
  telefone?: string;
  email?: string;
  nascimento?: string;
  tags?: string[];
  consent: boolean;
  photo_url?: string | null;
  origem?: string;
  apelido?: string;
  instagram?: string;
  cpf?: string;
  rg?: string;
  sexo?: string;
  profissao?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  online_booking_enabled?: boolean;
  observacoes?: string;
}

export interface LegacyProfessional {
  id: number;
  name: string;
  avatarUrl: string;
  role?: string;
  order_index?: number;
  services_enabled?: number[];
  commission_rate?: number;
  active?: boolean;
  online_booking?: boolean;
  permissions?: any;
  work_schedule?: any;
  pix_key?: string; 
}

export interface LegacyService {
  id: number;
  name: string;
  duration: number;
  price: number;
  color: string;
  category?: string;
}

export interface Service {
  id: number;
  nome: string;
  duracao_min: number;
  preco: number;
  cor_hex: string;
  ativo: boolean;
  categoria?: string;
  descricao?: string;
}

export interface LegacyAppointment {
  id: number;
  client?: Client;
  professional: LegacyProfessional;
  service: LegacyService;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  notas?: string;
  origem?: string;
}

export interface FinancialTransaction {
  id: number;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: Date | string;
  paymentMethod: PaymentMethod;
  status: 'pago' | 'pendente';
  professionalId?: number;
  appointment_id?: number;
  client_id?: number;
}

// --- NOVAS INTERFACES DE COMANDA ---

export interface CommandItem {
    id: string;
    command_id: string;
    service_id?: number;
    product_id?: number;
    appointment_id?: number;
    title: string;
    price: number;
    quantity: number;
    created_at: string;
}

export interface Command {
    id: string;
    client_id: number;
    status: 'open' | 'paid' | 'canceled';
    total_amount: number;
    created_at: string;
    closed_at?: string;
    clients?: { nome: string; whatsapp: string }; // Join relation
    command_items: CommandItem[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'client' | 'system';
  text: string;
  timestamp: Date | string;
  status: 'sent' | 'read' | 'delivered';
}

export interface ChatConversation {
  id: number;
  clientId: number;
  clientName: string;
  clientAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date | string;
  unreadCount: number;
  messages: ChatMessage[];
  tags?: string[];
}

export interface Product {
  id: number;
  name: string;
  sku?: string;
  price: number;
  cost_price?: number;
  stock_quantity: number;
  min_stock?: number;
  active: boolean;
  category?: string;
}

export interface OnlineBookingConfig {
  isActive: boolean;
  slug: string;
  studioName: string;
  description: string;
  coverUrl?: string;
  logoUrl?: string;
  timeIntervalMinutes: number;
  minAdvanceHours: number;
  maxFutureDays: number;
  cancellationPolicyHours: number;
  showStudioInSearch: boolean;
}

export interface Review {
  id: number;
  clientName: string;
  rating: number;
  comment: string;
  date: Date;
  serviceName?: string;
  reply?: string;
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
