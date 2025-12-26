
import React, { useState, useMemo, useRef } from 'react';
import { 
  UserPlus, Search, Phone, Edit, 
  Trash2, FileUp, MoreVertical, Cake, Users
} from 'lucide-react';
import { clients as initialClients, initialAppointments } from '../../data/mockData';
import { Client } from '../../types';
import ClientModal from '../modals/ClientModal';
import Toast, { ToastType } from '../shared/Toast';
import { differenceInDays, isSameMonth } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ClientStats {
  totalSpent: number;
  visits: number;
  lastVisitDate: Date | null;
  status: 'Novo' | 'Ativo' | 'Inativo' | 'Recuperar';
}

interface EnrichedClient extends Client {
  stats: ClientStats;
}

// Mock sparkline data for UI aesthetics
const sparkData = [
    { v: 40 }, { v: 30 }, { v: 60 }, { v: 80 }, { v: 50 }, { v: 90 }, { v: 100 }
];

const ClientesView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'aniversariantes'>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const enrichedClients = useMemo<EnrichedClient[]>(() => {
    return clients.map(client => {
      const clientApps = initialAppointments.filter(app => app.client?.id === client.id && app.status === 'concluido');
      const totalSpent = clientApps.reduce((acc, app) => acc + app.service.price, 0);
      const visits = clientApps.length;
      const lastVisitDate = clientApps.length > 0 
        ? new Date(Math.max(...clientApps.map(a => new Date(a.start).getTime())))
        : null;
        
      const daysSinceLastVisit = lastVisitDate ? differenceInDays(new Date(), lastVisitDate) : null;

      let status: 'Novo' | 'Ativo' | 'Inativo' | 'Recuperar' = 'Novo';
      if (visits > 0) {
        if (daysSinceLastVisit !== null && daysSinceLastVisit < 30) status = 'Ativo';
        else if (daysSinceLastVisit !== null && daysSinceLastVisit < 90) status = 'Inativo';
        else status = 'Recuperar';
      }

      return { ...client, stats: { totalSpent, visits, lastVisitDate, status } };
    });
  }, [clients]);

  const filteredClients = useMemo(() => {
    let list = enrichedClients.filter(client => 
      client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.whatsapp?.includes(searchTerm)
    );

    if (activeTab === 'aniversariantes') {
      const today = new Date();
      list = list.filter(c => {
        if (!c.nascimento) return false;
        const bday = new Date(c.nascimento);
        return isSameMonth(bday, today);
      });
    }

    return list;
  }, [enrichedClients, searchTerm, activeTab]);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const handleSaveClient = (client: Client) => {
    setClients(prev => {
      const exists = prev.find(c => c.id === client.id);
      if (exists) return prev.map(c => c.id === client.id ? client : c);
      return [...prev, client];
    });
    setIsModalOpen(false);
    setSelectedClient(null);
    showToast(selectedClient ? 'Cliente atualizado!' : 'Novo cliente cadastrado!');
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja remover este cliente?')) {
      setClients(prev => prev.filter(c => c.id !== id));
      showToast('Cliente removido.', 'info');
      setOpenMenuId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative font-sans overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" aria-hidden="true" />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-orange-500" size={24} />
            Clientes
          </h1>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                <FileUp size={18} /> <span className="text-sm">Importar</span>
            </button>
            <button 
              onClick={() => { setSelectedClient(null); setIsModalOpen(true); }}
              className="flex-[2] md:flex-none bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-100 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <UserPlus size={18} /> <span className="text-sm">Novo Cliente</span>
            </button>
        </div>
      </header>

      {/* KPI Cards com Sparklines Corrigidos */}
      <div className="flex md:grid md:grid-cols-3 gap-4 p-4 overflow-x-auto scrollbar-hide flex-shrink-0">
        <div className="min-w-[240px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
           <div className="flex items-center gap-3">
               <div className="bg-blue-50 p-2.5 rounded-lg text-blue-500"><Users size={20}/></div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                 <p className="text-lg font-bold text-slate-800">{clients.length}</p>
               </div>
           </div>
           {/* Fix: Explicit height container for Recharts */}
           <div className="h-10 w-20">
               <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={sparkData}>
                       <Area type="monotone" dataKey="v" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} isAnimationActive={false} />
                   </AreaChart>
               </ResponsiveContainer>
           </div>
        </div>

        <div className="min-w-[240px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
           <div className="flex items-center gap-3">
               <div className="bg-green-50 p-2.5 rounded-lg text-green-500"><UserPlus size={20}/></div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Novos (Mês)</p>
                 <p className="text-lg font-bold text-slate-800">3</p>
               </div>
           </div>
           <div className="h-10 w-20">
               <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={sparkData}>
                       <Area type="monotone" dataKey="v" stroke="#10b981" fill="#dcfce7" strokeWidth={2} isAnimationActive={false} />
                   </AreaChart>
               </ResponsiveContainer>
           </div>
        </div>

        <div className="min-w-[240px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
           <div className="flex items-center gap-3">
               <div className="bg-orange-50 p-2.5 rounded-lg text-orange-500"><Users size={20}/></div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Ticket Médio</p>
                 <p className="text-lg font-bold text-slate-800">R$ 145</p>
               </div>
           </div>
           <div className="h-10 w-20">
               <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={sparkData}>
                       <Area type="monotone" dataKey="v" stroke="#f97316" fill="#ffedd5" strokeWidth={2} isAnimationActive={false} />
                   </AreaChart>
               </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 flex flex-col min-h-0 bg-white md:mx-4 md:mb-4 md:rounded-2xl border-t md:border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Abas e Busca */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
            <div className="flex p-1 bg-slate-100 rounded-xl self-start">
                <button 
                    onClick={() => setActiveTab('todos')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'todos' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}
                >
                    Todos os Clientes
                </button>
                <button 
                    onClick={() => setActiveTab('aniversariantes')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'aniversariantes' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}
                >
                    <Cake size={14} /> Aniversariantes
                </button>
            </div>
            
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou telefone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-100 text-sm transition-all"
                />
            </div>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto">
            {filteredClients.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    <Users size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhum cliente encontrado.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {filteredClients.map(client => (
                        <div key={client.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-400 font-bold border border-slate-200 overflow-hidden">
                                    {client.nome.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate">{client.nome}</h4>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Phone size={10} className="text-slate-300" /> {client.whatsapp || 'Sem telefone'}
                                    </p>
                                </div>
                            </div>

                            <div className="relative">
                                <button 
                                    onClick={() => setOpenMenuId(openMenuId === client.id ? null : client.id)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                                    aria-label="Menu de opções"
                                >
                                    <MoreVertical size={20} />
                                </button>

                                {openMenuId === client.id && (
                                    <>
                                        <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)}></div>
                                        <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-30 py-2 animate-in fade-in zoom-in-95 duration-100">
                                            <button onClick={() => handleEdit(client)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                                                <Edit size={16} className="text-slate-400" /> Editar Dados
                                            </button>
                                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                                                <History size={16} className="text-slate-400" /> Ver Histórico
                                            </button>
                                            <div className="border-t border-slate-50 my-1"></div>
                                            <button onClick={() => handleDelete(client.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 font-medium">
                                                <Trash2 size={16} /> Excluir Cliente
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {isModalOpen && (
        <ClientModal 
          client={selectedClient} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveClient} 
        />
      )}
    </div>
  );
};

export default ClientesView;

// Fix Chart Rendering
