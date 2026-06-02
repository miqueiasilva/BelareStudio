import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  UserPlus, Search, Phone, Trash2, Users, Loader2, 
  ChevronRight, FileSpreadsheet, MessageCircle, PhoneCall,
  LayoutGrid, List, PlusCircle, RefreshCw, Clock, Sparkles, Send,
  AlertCircle, Download
} from 'lucide-react';
import { Client } from '../../types';
import ClientProfile from './ClientProfile'; 
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import ImportClientsModal from '../modals/ImportClientsModal';
import { useConfirm } from '../../utils/useConfirm';
import { toast } from 'sonner'; // ← CORREÇÃO: import do Sonner

const ITEMS_PER_PAGE = 50;

const ClientesView: React.FC = () => {
  const { activeStudioId } = useStudio();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [clients, setClients] = useState<Client[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'ausente' | 'esquecido' | 'sem_atendimento'>('all');

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const fetchClients = useCallback(async (reset = false, searchVal = searchTerm) => {
    if (!activeStudioId) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    if (reset) {
        setLoading(true);
        setPage(0);
    } else {
        setLoadingMore(true);
    }

    try {
        const currentPage = reset ? 0 : page;
        const from = currentPage * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
            .from('clients')
            .select('id, nome, whatsapp, telefone, email, nascimento, tags, consent, photo_url, referral_source, apelido, instagram, cpf, rg, sexo, profissao, cep, endereco, numero, complemento, bairro, cidade, estado, online_booking_enabled, observacoes, studio_id', { count: 'exact' })
            .eq('studio_id', activeStudioId)
            .abortSignal(abortControllerRef.current.signal);

        if (searchVal.trim()) {
            query = query.or(`nome.ilike.%${searchVal}%,whatsapp.ilike.%${searchVal}%,telefone.ilike.%${searchVal}%,apelido.ilike.%${searchVal}%`);
        }

        const { data, error, count } = await query
            .order('nome', { ascending: true })
            .range(from, to);
        
        if (error) throw error;

        if (reset) {
            if (isMounted.current) setClients(data || []);
        } else {
            if (isMounted.current) setClients(prev => [...prev, ...(data || [])]);
        }
        
        if (isMounted.current) {
            if (count !== null) setTotalCount(count);
            if (!reset) setPage(currentPage + 1);
            else setPage(1);
        }

    } catch (e: any) {
        const isAbortError = e.name === 'AbortError' || e.message?.includes('aborted');
        if (isMounted.current && !isAbortError) {
            console.error("Erro ao carregar clientes:", e);
            toast.error("Erro ao sincronizar com o banco."); // ← CORREÇÃO
        }
    } finally {
        if (isMounted.current) {
            setLoading(false);
            setLoadingMore(false);
        }
    }
  }, [page, searchTerm, activeStudioId]);

  useEffect(() => {
    const timer = setTimeout(() => {
        fetchClients(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, activeStudioId]);

  const fetchAppointments = useCallback(async () => {
    if (!activeStudioId) return;
    setLoadingAppointments(true);
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('client_id, date, status')
            .eq('studio_id', activeStudioId)
            .neq('status', 'cancelado');
        if (error) throw error;
        setAppointments(data || []);
    } catch (e) {
        console.error("Erro ao carregar agendamentos para status:", e);
    } finally {
        setLoadingAppointments(false);
    }
  }, [activeStudioId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const clientLastVisitMap = useMemo(() => {
    const map: Record<number, { date: string; status: string }> = {};
    appointments.forEach(app => {
      if (!app.client_id) return;
      const appDate = new Date(app.date);
      const isRealVisit = ['concluido', 'chegou', 'confirmado', 'confirmado_whatsapp', 'em_atendimento'].includes(app.status);
      if (!isRealVisit) return;

      const existing = map[app.client_id];
      if (!existing || appDate > new Date(existing.date)) {
        map[app.client_id] = {
          date: app.date,
          status: app.status
        };
      }
    });
    return map;
  }, [appointments]);

  const getClientStatus = useCallback((clientId: number | undefined) => {
    if (!clientId) return { label: 'Sem Atendimento', days: null, status: 'sem_atendimento', color: 'bg-slate-100 text-slate-500 border-slate-200' };
    const visit = clientLastVisitMap[clientId];
    if (!visit) return { label: 'Sem Atendimento', days: null, status: 'sem_atendimento', color: 'bg-slate-100 text-slate-500 border-slate-200' };

    const diffTime = Math.abs(new Date().getTime() - new Date(visit.date).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 20) {
      return { label: `Ativo (${diffDays}d)`, days: diffDays, status: 'ativo', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    } else if (diffDays >= 20 && diffDays <= 30) {
      return { label: `Ausente (${diffDays}d)`, days: diffDays, status: 'ausente', color: 'text-amber-700 bg-amber-50 border-amber-100' };
    } else {
      return { label: `Esquecido (${diffDays}d)`, days: diffDays, status: 'esquecido', color: 'text-rose-700 bg-rose-50 border-rose-100' };
    }
  }, [clientLastVisitMap]);

  const stats = useMemo(() => {
    let ativo = 0;
    let ausente = 0;
    let esquecido = 0;
    let sem_atendimento = 0;

    clients.forEach(c => {
      const s = getClientStatus(c.id);
      if (s.status === 'ativo') ativo++;
      else if (s.status === 'ausente') ausente++;
      else if (s.status === 'esquecido') esquecido++;
      else sem_atendimento++;
    });

    return {
      all: clients.length,
      ativo,
      ausente,
      esquecido,
      sem_atendimento
    };
  }, [clients, getClientStatus]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      if (statusFilter === 'all') return true;
      const s = getClientStatus(client.id);
      return s.status === statusFilter;
    });
  }, [clients, getClientStatus, statusFilter]);

  const handleReengage = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    const phone = client.whatsapp || client.telefone;
    if (!phone) {
      toast.error("Este cliente não possui telefone/WhatsApp cadastrado.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const statusObj = getClientStatus(client.id);
    const bookingUrl = `${window.location.origin}/#/public-preview?sid=${activeStudioId || ''}`;
    
    const message = statusObj.status === 'ausente'
      ? `Olá, ${client.nome}! Tudo bem?\n\nFaz ${statusObj.days} dias que você não visita nosso estúdio. Passando para dizer que estamos com saudades e te convidar para agendar uma sessão esta semana! ❤️\n\nClique no link abaixo para conferir os horários disponíveis e reservar o seu:\n${bookingUrl}`
      : statusObj.status === 'esquecido'
      ? `Olá, ${client.nome}! Que saudade!\n\nJá faz ${statusObj.days || 30} dias desde sua última visita. Preparamos novidades e horários exclusivos para você. Vamos agendar seu momento de cuidado esta semana? 🥰\n\nEscolha o melhor dia e horário por aqui:\n${bookingUrl}`
      : `Olá, ${client.nome}! Tudo bem?\n\nCadastramos seu contato de forma segura, mas vimos que você ainda não agendou nenhuma sessão conosco. Que tal marcar a sua primeira experiência? ✨\n\nConfira todos os serviços e agende de forma fácil por aqui:\n${bookingUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const formatLastVisitDate = (clientId: number | undefined) => {
    if (!clientId) return 'Nunca atendeu';
    const visit = clientLastVisitMap[clientId];
    if (!visit) return 'Nunca atendeu';
    try {
      const d = new Date(visit.date);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  const handleLoadMore = () => {
    if (clients.length < totalCount) fetchClients(false);
  };

  const handleDeleteClient = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    
    const isConfirmed = await confirm({
      title: 'Excluir Cliente',
      message: `Tem certeza que deseja apagar o cliente "${client.nome}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (isConfirmed && client.id) {
      try {
        const { error } = await supabase.from('clients').delete().eq('id', client.id);
        if (error) throw error;
        setClients(prev => prev.filter(c => c.id !== client.id));
        setTotalCount(prev => prev - 1);
        toast.info('Cliente excluído.'); // ← CORREÇÃO
      } catch (err: any) {
        toast.error('Falha ao excluir.'); // ← CORREÇÃO
      }
    }
  };

  const handleSaveClient = async (clientData: Client) => {
    if (!activeStudioId) return;
    
    // Remove campos com valor null, undefined ou string 'null'
    const cleanData = Object.entries(clientData).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined && value !== 'null' && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    // Mapeia 'origem' para 'referral_source' se existir
    if (cleanData.origem) {
      cleanData.referral_source = cleanData.origem;
      delete cleanData.origem;
    }
    
    const isEditing = !!cleanData.id;
    
    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('clients')
          .update(cleanData)
          .eq('id', cleanData.id)
          .select()
          .single();
        
        if (error) throw error;
        setClients(prev => prev.map(c => c.id === data.id ? data : c));
        toast.success('Perfil atualizado!');
      } else {
        const { id, ...dataWithoutId } = cleanData;
        const { data, error } = await supabase
          .from('clients')
          .insert([{ ...dataWithoutId, studio_id: activeStudioId }])
          .select()
          .single();
        
        if (error) throw error;
        setClients(prev => [data, ...prev]);
        setTotalCount(prev => prev + 1);
        toast.success('Cliente cadastrado!');
      }
      setSelectedClient(null);
    } catch (e: any) {
      console.error('Erro ao salvar cliente:', e);
      toast.error(`Erro: ${e.message || 'Falha ao processar'}`);
    }
  };

  const handleExportClients = async () => {
    if (!activeStudioId) return;
    const loadingToastId = toast.loading("Buscando todos os clientes para exportação...");
    try {
      let allClients: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('clients')
          .select('nome, whatsapp, telefone')
          .eq('studio_id', activeStudioId)
          .order('nome', { ascending: true })
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allClients = [...allClients, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      if (allClients.length === 0) {
        toast.dismiss(loadingToastId);
        toast.error("Nenhum cliente cadastrado para exportar.");
        return;
      }

      // Generate CSV content with UTF-8 BOM for Excel import compatibility
      let csvContent = "\uFEFF";
      csvContent += "Nome;Telefone/WhatsApp\n";

      allClients.forEach(client => {
        const nome = client.nome ? client.nome.replace(/;/g, ',').replace(/\r?\n|\r/g, ' ').trim() : '';
        const contato = (client.whatsapp || client.telefone || '').replace(/;/g, ',').replace(/\r?\n|\r/g, ' ').trim();
        csvContent += `${nome};${contato}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `clientes_belare.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.dismiss(loadingToastId);
      toast.success(`${allClients.length} clientes exportados com sucesso!`);
    } catch (err: any) {
      console.error("Erro ao exportar clientes:", err);
      toast.dismiss(loadingToastId);
      toast.error("Falha ao exportar clientes.");
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500'];
    return colors[name.length % colors.length];
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
              <Users className="text-orange-500" size={28} /> Clientes
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
             {totalCount.toLocaleString('pt-BR')} NA UNIDADE ATIVA
          </p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExportClients} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 shadow-sm" title="Exportar Clientes para CSV"><Download size={20} /></button>
            <button onClick={() => setIsImportModalOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 shadow-sm" title="Importar Clientes"><FileSpreadsheet size={20} /></button>
            <button onClick={() => setSelectedClient({ nome: '', consent: true, studio_id: activeStudioId } as any)} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg">
              <UserPlus size={20} /> <span className="hidden sm:inline">Novo</span>
            </button>
        </div>
      </header>
      <div className="p-4 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="relative group max-w-2xl mx-auto">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${loading ? 'text-orange-500' : 'text-slate-300'}`} />
            <input type="text" placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[20px] focus:ring-4 focus:ring-orange-100 focus:border-orange-400 focus:bg-white outline-none font-bold transition-all shadow-inner" />
        </div>
      </div>

      {/* Segmentações de Inatividade */}
      <div className="px-6 py-3 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border flex-shrink-0 ${
            statusFilter === 'all'
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm shadow-slate-300'
              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>Todos</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-black ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
            {stats.all}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter('ativo')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border flex-shrink-0 ${
            statusFilter === 'ativo'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-100/70 hover:bg-emerald-100/50'
          }`}
        >
          <Sparkles size={14} />
          <span>Ativos (&lt; 20 dias)</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-black ${statusFilter === 'ativo' ? 'bg-white/20 text-white' : 'bg-emerald-100/80 text-emerald-800'}`}>
            {stats.ativo}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter('ausente')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border flex-shrink-0 ${
            statusFilter === 'ausente'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200'
              : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100/50'
          }`}
        >
          <Clock size={14} />
          <span>Ausentes (20-30d)</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-black ${statusFilter === 'ausente' ? 'bg-white/20 text-white' : 'bg-amber-100/80 text-amber-800'}`}>
            {stats.ausente}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter('esquecido')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border flex-shrink-0 ${
            statusFilter === 'esquecido'
              ? 'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-200'
              : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/50'
          }`}
        >
          <AlertCircle size={14} />
          <span>Esquecidos (&gt; 30 dias)</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-black ${statusFilter === 'esquecido' ? 'bg-white/20 text-white' : 'bg-rose-100/80 text-rose-800'}`}>
            {stats.esquecido}
          </span>
        </button>
        <button
          onClick={() => setStatusFilter('sem_atendimento')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border flex-shrink-0 ${
            statusFilter === 'sem_atendimento'
              ? 'bg-slate-500 text-white border-slate-500 shadow-sm shadow-slate-200'
              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>Nunca Agendaram</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-black ${statusFilter === 'sem_atendimento' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
            {stats.sem_atendimento}
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading && clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Loader2 className="animate-spin mb-4 text-orange-500" size={40} /><p className="text-xs font-black uppercase">Sincronizando unidade...</p></div>
        ) : (
          <div className="max-w-7xl mx-auto pb-24">
              <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Atividade</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Visita</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredClients.map(client => {
                        const statusObj = getClientStatus(client.id);
                        return (
                          <tr key={client.id} onClick={() => setSelectedClient(client)} className="hover:bg-orange-50/10 cursor-pointer transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs border border-slate-100 shadow-sm ${client.photo_url ? 'bg-white' : getAvatarColor(client.nome)}`}>{client.photo_url ? <img src={client.photo_url} className="w-full h-full object-cover rounded-xl" /> : client.nome[0].toUpperCase()}</div>
                                <div className="text-left">
                                  <p className="font-extrabold text-slate-800 text-sm leading-tight flex items-center gap-1.5">{client.nome}{client.apelido && <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">"{client.apelido}"</span>}</p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{client.whatsapp || client.telefone || 'Sem contato'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${statusObj.color}`}>
                                {statusObj.label}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-extrabold text-slate-600 font-mono">
                                {formatLastVisitDate(client.id)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => handleReengage(e, client)}
                                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm border flex items-center gap-1.5 transition-all active:scale-95 ${
                                    statusObj.status === 'ativo' ? 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-150 hover:bg-emerald-50/30' :
                                    statusObj.status === 'ausente' ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600' :
                                    statusObj.status === 'esquecido' ? 'bg-rose-500 border-rose-500 text-white hover:bg-rose-600' :
                                    'bg-slate-800 border-slate-800 text-white hover:bg-slate-900'
                                  }`}
                                  title="Enviar mensagem de incentivo/retorno"
                                >
                                  <Send size={11} />
                                  <span>{statusObj.status === 'ativo' ? 'Agradecer' : statusObj.status === 'sem_atendimento' ? 'Convidar' : 'Reengajar'}</span>
                                </button>
                                <button onClick={(e) => handleDeleteClient(e, client)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            {filteredClients.length < totalCount && <button onClick={handleLoadMore} className="mt-8 mx-auto flex items-center gap-2 px-8 py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg">{loadingMore ? <Loader2 className="animate-spin" size={18} /> : 'Carregar Mais'}</button>}
          </div>
        )}
      </div>
      {selectedClient && <ClientProfile client={selectedClient} onClose={() => setSelectedClient(null)} onSave={handleSaveClient} />}
      {isImportModalOpen && <ImportClientsModal onClose={() => setIsImportModalOpen(false)} onSuccess={() => fetchClients(true)} />}
      <ConfirmDialogComponent />
    </div>
  );
};

export default ClientesView;
