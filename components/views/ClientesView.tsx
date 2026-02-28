
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  UserPlus, Search, Phone, Trash2, Users, Loader2, 
  ChevronRight, FileSpreadsheet, MessageCircle, PhoneCall,
  LayoutGrid, List, PlusCircle, RefreshCw
} from 'lucide-react';
import { Client } from '../../types';
import ClientProfile from './ClientProfile'; 
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import ImportClientsModal from '../modals/ImportClientsModal';
import { useConfirm } from '../../utils/useConfirm';

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
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
            .select('*', { count: 'exact' })
            .eq('studio_id', activeStudioId)
            .abortSignal(abortControllerRef.current.signal);

        if (searchVal.trim()) {
            query = query.or(`nome.ilike.%${searchVal}%,whatsapp.ilike.%${searchVal}%`);
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
            setToast({ message: "Erro ao sincronizar com o banco.", type: 'error' });
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

  const handleLoadMore = () => {
    if (clients.length < totalCount) fetchClients(false);
  };

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

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
        showToast('Cliente excluído.', 'info');
      } catch (err: any) {
        showToast('Falha ao excluir.', 'error');
      }
    }
  };

  const handleSaveClient = async (clientData: Client) => {
    if (!activeStudioId) return;
    const isEditing = !!clientData.id;
    try {
        if (isEditing) {
            const { data, error } = await supabase.from('clients').update(clientData).eq('id', clientData.id).select().single();
            if (error) throw error;
            setClients(prev => prev.map(c => c.id === data.id ? data : c));
            showToast('Perfil atualizado!');
        } else {
            const { data, error } = await supabase.from('clients').insert([{ ...clientData, studio_id: activeStudioId }]).select().single();
            if (error) throw error;
            setClients(prev => [data, ...prev]);
            setTotalCount(prev => prev + 1);
            showToast('Cliente cadastrado!');
        }
        setSelectedClient(null);
    } catch (e: any) {
        showToast("Erro ao processar dados.", 'error');
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500'];
    return colors[name.length % colors.length];
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
            <button onClick={() => setIsImportModalOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 shadow-sm"><FileSpreadsheet size={20} /></button>
            <button onClick={() => setSelectedClient({ nome: '', consent: true } as any)} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg">
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
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {clients.map(client => (
                        <tr key={client.id} onClick={() => setSelectedClient(client)} className="hover:bg-orange-50/30 cursor-pointer transition-colors group">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-xs ${client.photo_url ? 'bg-white' : getAvatarColor(client.nome)}`}>{client.photo_url ? <img src={client.photo_url} className="w-full h-full object-cover rounded-lg" /> : client.nome[0].toUpperCase()}</div>
                              <span className="font-bold text-slate-700">{client.nome}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button onClick={(e) => handleDeleteClient(e, client)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            {clients.length < totalCount && <button onClick={handleLoadMore} className="mt-8 mx-auto flex items-center gap-2 px-8 py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg">{loadingMore ? <Loader2 className="animate-spin" size={18} /> : 'Carregar Mais'}</button>}
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
