
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
  // Allow string or number for IDs
  id: string | number;
  professional_id: string | number | null; 
  start_time: string; 
  end_time: string;   
  reason: string;
  created_at?: string;
}

export interface Client {
  // Allow string or number for IDs
  id?: number | string;
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
  // Allow string or number for IDs
  id: number | string;
  name: string;
  avatarUrl: string;
  role?: string;
  order_index?: number;
  services_enabled?: (number | string)[];
  commission_rate?: number;
  active?: boolean;
  online_booking?: boolean;
  permissions?: any;
  work_schedule?: any;
  pix_key?: string; 
  // FIX: Added resource_id to fix "Property 'resource_id' does not exist on type 'LegacyProfessional'" errors.
  resource_id?: string | null;
}

export interface LegacyService {
  // Allow string or number for IDs
  id: number | string;
  name: string;
  duration: number;
  price: number;
  color: string;
  category?: string;
}

export interface Service {
  // Allow string or number for IDs
  id: number | string;
  nome: string;
  duracao_min: number;
  preco: number;
  cor_hex: string;
  ativo: boolean;
  categoria?: string;
  descricao?: string;
}

export interface LegacyAppointment {
  // Allow string or number for IDs
  id: number | string;
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
  // Allow string or number for IDs
  id: number | string;
  description: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: Date | string;
  paymentMethod: PaymentMethod;
  status: 'pago' | 'pendente';
  professionalId?: number | string;
  appointment_id?: number | string;
  client_id?: number | string;
}

export interface CommandItem {
    // Allow string or number for IDs
    id: string | number;
    command_id: string | number;
    service_id?: string | number;
    product_id?: string | number;
    appointment_id?: string | number;
    title: string;
    price: number; 
    quantity: number; 
    created_at: string;
    professional_id?: string | number;
    studio_id?: string | number;
}

export interface Command {
    // Allow string or number for IDs
    id: string | number;
    client_id: number | string;
    studio_id: string | number;
    status: 'open' | 'paid' | 'canceled';
    total_amount: number;
    created_at: string;
    closed_at?: string;
    clients?: any; 
    command_items: CommandItem[];
}

export interface ChatMessage {
  // Allow string or number for IDs
  id: string | number;
  sender: 'user' | 'client' | 'system';
  text: string;
  timestamp: Date | string;
  status: 'sent' | 'read' | 'delivered';
}

export interface ChatConversation {
  // Allow string or number for IDs
  id: number | string;
  clientId: number | string;
  clientName: string;
  clientAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date | string;
  unreadCount: number;
  messages: ChatMessage[];
  tags?: string[];
}

export interface Product {
  // Allow string or number for IDs
  id: number | string;
  name: string;
  sku?: string;
  price: number;
  cost_price?: number;
  stock_quantity: number;
  min_stock?: number;
  active: boolean;
  category?: string;
  supplier_id?: string | null;
  studio_id?: string;
}

export interface Supplier {
  // Allow string or number for IDs
  id: string | number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  studio_id: string | number;
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

// FIX: Added missing AnalyticsData interface
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

export interface Review {
  // Allow string or number for IDs
  id: number | string;
  clientName: string;
  rating: number;
  comment: string;
  date: Date;
  serviceName?: string;
  reply?: string;
}
