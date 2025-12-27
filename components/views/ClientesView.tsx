
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  UserPlus, Search, Phone, Edit, 
  Trash2, FileUp, MoreVertical, Cake, Users, History, Loader2, RefreshCw, AlertCircle, ChevronRight
} from 'lucide-react';
import { Client } from '../../types';
import ClientProfile from './ClientProfile'; 
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';

const ClientesView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchClients = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    setError(null);

    // Watchdog de 8 segundos
    const watchdog = setTimeout(() => {
        if (loading && isMounted.current) {
            setLoading(false);
            setError("O banco de dados não respondeu a tempo.");
        }
    }, 8000);

    try {
        const { data, error: sbError } = await supabase
            .from('clients')
            .select('*')
            .order('nome', { ascending: true });
        
        if (sbError) throw new Error(sbError.message || "Erro ao consultar base de dados.");
        
        if (isMounted.current) {
            setClients(data || []);
        }
    } catch (e: any) {
        console.error("Erro detalhado ao carregar clientes:", e);
        if (isMounted.current) {
            setError(e.message || "Não foi possível carregar a lista de clientes.");
        }
    } finally {
        clearTimeout(watchdog);
        if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => { 
    isMounted.current = true;
    fetchClients(); 
    return () => { isMounted.current = false; };
  }, []);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const handleSaveClient = async (clientData: Client) => {
    const payload = { ...clientData };
    const isEditing = !!payload.id;

    try {
        if (isEditing) {
            const { data, error: upError } = await supabase
                .from('clients')
                .update(payload)
                .eq('id', payload.id)
                .select()
                .single();

            if (upError) throw new Error(upError.message);
            
            setClients(prev => prev.map(c => c.id === data.id ? data : c));
            showToast('Perfil atualizado com sucesso!');
        } else {
            delete (payload as any).id;
            const { data, error: inError } = await supabase
                .from('clients')
                .insert([payload])
                .select()
                .single();

            if (inError) throw new Error(inError.message);

            setClients(prev => [data, ...prev]);
            showToast('Novo cliente cadastrado com sucesso!');
        }
        setSelectedClient(null);
    } catch (e: any) {
        console.error("ERRO CRÍTICO NA PERSISTÊNCIA:", e);
        const msg = e.message || "Falha técnica desconhecida.";
        alert(`Erro ao salvar no banco: ${msg}`);
        showToast("Falha ao salvar dados.", 'error');
    }
  };

  const filteredClients = clients.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.whatsapp?.includes(searchTerm)
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Users className="text-orange-500" /> Clientes
        </h1>
        <button 
          onClick={() => setSelectedClient({ nome: '', consent: true } as any)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-100"
        >
          <UserPlus size={18} /> Novo
        </button>
      </header>

      <div className="p-4 border-b bg-white">
        <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
                type="text" 
                placeholder="Nome ou celular..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-100 outline-none font-medium"
            />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="animate-spin mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando base...</p>
            </div>
        ) : error ? (
            <div className="p-12 text-center max-w-md mx-auto">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <p className="text-slate-800 font-bold mb-2">Ops! Falha ao carregar clientes</p>
                <p className="text-slate-500 text-sm mb-8">{error}</p>
                <button onClick={fetchClients} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 mx-auto hover:bg-black transition-all active:scale-95"><RefreshCw size={16}/> Tentar Novamente</button>
            </div>
        ) : filteredClients.length === 0 ? (
            <div className="p-20 text-center text-slate-400 flex flex-col items-center">
                <Users size={48} className="opacity-20 mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">Nenhum cliente encontrado</p>
                <button onClick={() => setSelectedClient({ nome: '', consent: true } as any)} className="mt-4 text-orange-500 font-black text-sm hover:underline">Cadastrar o primeiro agora</button>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {filteredClients.map(client => (
                    <div 
                        key={client.id} 
                        onClick={() => setSelectedClient(client)}
                        className="p-5 flex items-center justify-between hover:bg-orange-50/30 cursor-pointer transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-orange-600 font-black text-xl shadow-sm overflow-hidden">
                                {client.photo_url ? (
                                    <img 
                                        src={client.photo_url} 
                                        className="w-full h-full object-cover" 
                                        alt={client.nome} 
                                    />
                                ) : (
                                    client.nome.charAt(0)
                                )}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-base">{client.nome}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-slate-400 font-medium">{client.whatsapp || 'Sem celular'}</p>
                                    {(client as any).online_booking_enabled && (
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" title="Link Ativo"></span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-300" size={20} />
                    </div>
                ))}
            </div>
        )}
      </div>

      {selectedClient && (
        <ClientProfile 
          client={selectedClient} 
          onClose={() => setSelectedClient(null)} 
          onSave={handleSaveClient} 
        />
      )}
    </div>
  );
};

export default ClientesView;
