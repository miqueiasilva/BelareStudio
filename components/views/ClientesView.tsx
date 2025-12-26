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

  const fetchClients = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('nome', { ascending: true });
        
        if (error) throw error;
        setClients(data || []);
    } catch (e: any) {
        console.error("Erro ao carregar clientes:", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const handleSaveClient = async (clientData: Client) => {
    console.log("Iniciando persistência de cliente. Dados recebidos:", clientData);
    
    // Payload limpo para evitar erros de tipos no Postgres
    const payload = { ...clientData };
    const isEditing = !!payload.id;

    try {
        if (isEditing) {
            // OPERAÇÃO: EDITAR
            console.log("Modo: EDIÇÃO. ID:", payload.id);
            const { data, error } = await supabase
                .from('clients')
                .update(payload)
                .eq('id', payload.id)
                .select()
                .single();

            if (error) throw error;
            
            setClients(prev => prev.map(c => c.id === data.id ? data : c));
            showToast('Perfil atualizado com sucesso!');
        } else {
            // OPERAÇÃO: NOVO
            console.log("Modo: CRIAÇÃO (Novo Registro)");
            // Remove o ID para o banco gerar automaticamente
            delete (payload as any).id;
            
            const { data, error } = await supabase
                .from('clients')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            setClients(prev => [data, ...prev]);
            showToast('Novo cliente cadastrado com sucesso!');
        }
        
        // Fecha o modal após sucesso
        setSelectedClient(null);

    } catch (e: any) {
        console.error("ERRO CRÍTICO NA PERSISTÊNCIA:", e);
        // Alert exibe o erro real vindo do Supabase (ex: RLS, Constraint, Type error)
        alert(`Erro ao salvar no banco: ${e.message || 'Erro desconhecido'}`);
        showToast("Falha ao salvar dados.", 'error');
    }
  };

  const filteredClients = clients.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.whatsapp?.includes(searchTerm)
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans">
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
        ) : (
            <div className="divide-y divide-slate-100">
                {filteredClients.map(client => (
                    <div 
                        key={client.id} 
                        onClick={() => setSelectedClient(client)}
                        className="p-5 flex items-center justify-between hover:bg-orange-50/30 cursor-pointer transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-orange-600 font-black text-xl shadow-sm">
                                {client.nome.charAt(0)}
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