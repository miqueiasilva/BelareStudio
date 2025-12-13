
import { LegacyProfessional, Client, LegacyService, LegacyAppointment, OnlineBookingConfig, Review, AnalyticsData, FinancialTransaction, ChatConversation, Product } from '../types';
import { startOfDay, setHours, setMinutes, subDays, addDays, subMinutes } from 'date-fns';

const today = new Date();
const createTime = (hour: number, minute: number) => setMinutes(setHours(startOfDay(today), hour), minute);

export const professionals: LegacyProfessional[] = [
    { id: 1, name: 'Jacilene Félix', avatarUrl: 'https://i.pravatar.cc/150?img=1' },
    { id: 2, name: 'Graziela Oliveira', avatarUrl: 'https://i.pravatar.cc/150?img=2' },
    { id: 3, name: 'Jéssica Félix', avatarUrl: 'https://i.pravatar.cc/150?img=3' },
    { id: 4, name: 'Glezia', avatarUrl: 'https://i.pravatar.cc/150?img=4' },
    { id: 5, name: 'Elda Priscila', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80' },
    { id: 6, name: 'Herlon', avatarUrl: 'https://i.pravatar.cc/150?img=6' },
];

export const clients: Client[] = [
    { 
        id: 1, 
        nome: 'Alemão', 
        whatsapp: '11999990001', 
        email: 'alemao@email.com', 
        nascimento: '1990-05-15',
        tags: ['VIP', 'Frequente'], 
        consent: true 
    }, 
    { 
        id: 2, 
        nome: 'Juanita Estefano', 
        whatsapp: '11999990002', 
        email: 'juanita@email.com', 
        tags: ['Indicação'],
        consent: true 
    }, 
    { 
        id: 3, 
        nome: 'Clara Coelho', 
        whatsapp: '11999990003', 
        email: 'clara@email.com', 
        nascimento: '1995-10-20',
        tags: ['Noiva', 'Pacote'],
        consent: true 
    },
    { 
        id: 4, 
        nome: 'Eliude Alves', 
        whatsapp: '11999990004', 
        consent: true 
    }, 
    { 
        id: 5, 
        nome: 'Janniles', 
        whatsapp: '11999990005', 
        tags: ['Preferência: Jaciene'],
        consent: true 
    }, 
    { 
        id: 6, 
        nome: 'Bárbara Salles', 
        whatsapp: '11999990006', 
        email: 'babi@email.com',
        tags: ['Alergia a Esmalte Comum'],
        consent: true 
    }, 
    { 
        id: 7, 
        nome: 'Naná', 
        whatsapp: '11999990007', 
        consent: true 
    }
];

export const services: { [key: string]: LegacyService } = {
    designSimples: { id: 1, name: 'Design Simples', duration: 30, price: 50, color: '#3b82f6', category: 'Sobrancelhas' },
    designComTintura: { id: 2, name: 'Design Com Tintura', duration: 40, price: 70, color: '#8b5cf6', category: 'Sobrancelhas' },
    designComHenna: { id: 4, name: 'Design Com Henna', duration: 40, price: 75, color: '#a855f7', category: 'Sobrancelhas' },
    volumeEgipcio: { id: 5, name: 'Volume EGÍPCIO', duration: 110, price: 250, color: '#ec4899', category: 'Cílios' },
    manutencaoVolume: { id: 6, name: 'Manutenção Volume Brasileiro', duration: 150, price: 180, color: '#ef4444', category: 'Cílios' },
    limpezaPele: { id: 7, name: 'Limpeza de Pele Premium', duration: 50, price: 120, color: '#10b981', category: 'Estética' },
    bloqueio: { id: 8, name: 'Horário Bloqueado', duration: 300, price: 0, color: '#64748b', category: 'Geral' },
    extensaoFioAFio: { id: 9, name: 'Extensão de Cílios Fio A Fio', duration: 150, price: 130, color: '#3b82f6', category: 'Cílios' },
    foxEyes: { id: 10, name: 'FOX EYES', duration: 150, price: 140, color: '#3b82f6', category: 'Cílios' },
    lashLifting: { id: 11, name: 'Lash Lifting', duration: 120, price: 110, color: '#3b82f6', category: 'Cílios' },
};

export const initialAppointments: LegacyAppointment[] = [
    // Jacilene Félix
    { id: 1, client: clients[0], professional: professionals[0], service: services.designSimples, start: createTime(9, 30), end: createTime(10, 0), status: 'confirmado', notas: 'Cliente pediu para não usar o produto X.' },
    { id: 2, client: clients[1], professional: professionals[0], service: services.designComTintura, start: createTime(10, 30), end: createTime(11, 10), status: 'confirmado' },
    { id: 3, client: clients[2], professional: professionals[0], service: services.designSimples, start: createTime(11, 10), end: createTime(11, 40), status: 'agendado' },
    { id: 4, client: clients[0], professional: professionals[0], service: services.designSimples, start: createTime(11, 40), end: createTime(12, 10), status: 'agendado' },
    { id: 5, client: clients[3], professional: professionals[0], service: services.designComHenna, start: createTime(14, 0), end: createTime(14, 40), status: 'concluido' },
    
    // Jéssica Félix
    { id: 6, client: clients[4], professional: professionals[2], service: services.volumeEgipcio, start: createTime(9, 30), end: createTime(11, 20), status: 'confirmado' },
    { id: 7, client: clients[5], professional: professionals[2], service: services.manutencaoVolume, start: createTime(13, 30), end: createTime(16, 0), status: 'agendado' },
    
    // Glezia
    { id: 9, professional: professionals[3], service: services.bloqueio, start: createTime(13, 0), end: createTime(18, 0), status: 'bloqueado' },

    // Elda Priscila
    { id: 8, client: clients[6], professional: professionals[4], service: services.limpezaPele, start: createTime(9, 30), end: createTime(10, 20), status: 'confirmado' },
];

// --- Online Booking Mock Data ---

export const mockOnlineConfig: OnlineBookingConfig = {
    isActive: true,
    slug: 'belissima-studio',
    studioName: 'Belíssima Studio',
    description: 'Especialistas em realçar sua beleza com design de sobrancelhas, cílios e estética facial avançada.',
    coverUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    logoUrl: 'https://i.pravatar.cc/150?u=studio',
    timeIntervalMinutes: 30,
    minAdvanceHours: 2,
    maxFutureDays: 30,
    cancellationPolicyHours: 24,
    showStudioInSearch: true,
};

export const mockReviews: Review[] = [
    { id: 1, clientName: 'Juliana Paes', rating: 5, comment: 'Atendimento impecável! A Jacilene é maravilhosa.', date: new Date('2023-10-15'), serviceName: 'Design com Henna', reply: 'Obrigada pelo carinho, Ju! Sempre um prazer te atender.' },
    { id: 2, clientName: 'Marina Ruy', rating: 5, comment: 'Amei o resultado do volume egípcio. Durou muito!', date: new Date('2023-10-20'), serviceName: 'Volume Egípcio' },
    { id: 3, clientName: 'Giovanna A.', rating: 4, comment: 'O serviço é ótimo, mas atrasei um pouco e quase perdi a vez. Regras rígidas.', date: new Date('2023-10-22'), serviceName: 'Limpeza de Pele', reply: 'Olá Giovanna, prezamos muito pela pontualidade para não prejudicar os próximos clientes. Esperamos você novamente!' },
];

export const mockAnalytics: AnalyticsData = {
    pageViews: {
        profile: 1250,
        gallery: 890,
        details: 450,
        reviews: 320,
    },
    conversion: {
        started: 180,
        completed: 65,
        whatsappClicks: 42,
    }
};

// --- Mock Financial Data ---
const createTransaction = (
  id: number, 
  desc: string, 
  amount: number, 
  type: 'receita' | 'despesa', 
  cat: any, 
  daysOffset: number,
  profId?: number
): FinancialTransaction => ({
    id,
    description: desc,
    amount,
    type,
    category: cat,
    date: daysOffset === 0 ? new Date() : (daysOffset > 0 ? addDays(new Date(), daysOffset) : subDays(new Date(), Math.abs(daysOffset))),
    paymentMethod: 'pix',
    status: 'pago',
    professionalId: profId
});

export const mockTransactions: FinancialTransaction[] = [
    // Today
    createTransaction(1, 'Corte e Barba - João', 80, 'receita', 'servico', 0, 1),
    createTransaction(2, 'Manicure - Ana', 45, 'receita', 'servico', 0, 2),
    createTransaction(3, 'Pagamento Fornecedor Cosméticos', 350, 'despesa', 'insumos', 0),
    createTransaction(4, 'Venda Produto: Shampoo', 60, 'receita', 'produto', 0),
    
    // Yesterday
    createTransaction(5, 'Luzes - Carla', 250, 'receita', 'servico', -1, 1),
    createTransaction(6, 'Design Sobrancelha', 50, 'receita', 'servico', -1, 3),
    createTransaction(7, 'Uber Flash (Entrega)', 25, 'despesa', 'outros', -1),

    // Last Week
    createTransaction(8, 'Aluguel do Mês', 2000, 'despesa', 'aluguel', -5),
    createTransaction(9, 'Internet', 120, 'despesa', 'taxas', -3),
    createTransaction(10, 'Dia da Noiva (Pacote)', 800, 'receita', 'servico', -2, 1),

    // Future (Provisão)
    createTransaction(11, 'Conta de Luz (Previsão)', 450, 'despesa', 'taxas', 5),
];

// --- Mock Conversations ---

export const mockConversations: ChatConversation[] = [
    {
        id: 1,
        clientId: 2,
        clientName: 'Juanita Estefano',
        lastMessage: 'Oi! Tudo bem? Gostaria de confirmar meu horário de amanhã.',
        lastMessageTime: subMinutes(new Date(), 15),
        unreadCount: 2,
        messages: [
            { id: '1', sender: 'user', text: 'Olá Juanita! Tudo ótimo e você?', timestamp: subMinutes(new Date(), 120), status: 'read' },
            { id: '2', sender: 'client', text: 'Tudo bem também. Queria confirmar se é às 14h mesmo?', timestamp: subMinutes(new Date(), 20), status: 'sent' },
            { id: '3', sender: 'client', text: 'Oi! Tudo bem? Gostaria de confirmar meu horário de amanhã.', timestamp: subMinutes(new Date(), 15), status: 'sent' }
        ]
    },
    {
        id: 2,
        clientId: 3,
        clientName: 'Clara Coelho',
        lastMessage: 'Amei o resultado! Obrigada ❤️',
        lastMessageTime: subDays(new Date(), 1),
        unreadCount: 0,
        messages: [
            { id: '1', sender: 'system', text: 'Olá Clara, seu agendamento está confirmado para hoje às 10:00.', timestamp: subDays(new Date(), 1), status: 'sent' },
            { id: '2', sender: 'client', text: 'Obrigada! Já estou chegando.', timestamp: subDays(new Date(), 1), status: 'read' },
            { id: '3', sender: 'client', text: 'Amei o resultado! Obrigada ❤️', timestamp: subDays(new Date(), 1), status: 'read' }
        ]
    },
    {
        id: 3,
        clientId: 6,
        clientName: 'Bárbara Salles',
        lastMessage: 'Tem horário para sábado?',
        lastMessageTime: subMinutes(new Date(), 5),
        unreadCount: 1,
        tags: ['Alergia'],
        messages: [
            { id: '1', sender: 'client', text: 'Bom dia! Tem horário para sábado?', timestamp: subMinutes(new Date(), 5), status: 'sent' }
        ]
    }
];

// --- Mock Products ---
export const mockProducts: Product[] = [
    { id: 101, nome: 'Shampoo Hidratante 300ml', preco: 85.00, custo: 35.00, qtd: 12, ativo: true, sku: 'SH-300' },
    { id: 102, nome: 'Condicionador Reparador', preco: 92.00, custo: 40.00, qtd: 8, ativo: true, sku: 'CD-REP' },
    { id: 103, nome: 'Óleo Reparador de Pontas', preco: 45.00, custo: 15.00, qtd: 25, ativo: true, sku: 'OL-RP' },
    { id: 104, nome: 'Máscara de Nutrição', preco: 120.00, custo: 55.00, qtd: 3, ativo: true, sku: 'MS-NUT' },
    { id: 105, nome: 'Kit Manicure Descartável', preco: 5.00, custo: 1.50, qtd: 150, ativo: true, sku: 'KT-MAN' },
    { id: 106, nome: 'Esmalte Importado Vermelho', preco: 35.00, custo: 12.00, qtd: 15, ativo: true, sku: 'ES-VRM' },
    { id: 107, nome: 'Cílios Fio a Fio (Caixa)', preco: 0, custo: 25.00, qtd: 4, ativo: false, sku: 'CX-CIL' }, // Uso interno
];
