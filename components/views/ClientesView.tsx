
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Search, Phone, Trash2, Users, Loader2, 
  ChevronRight, FileSpreadsheet, MessageCircle, PhoneCall,
  LayoutGrid, List
} from 'lucide-react';
import { Client } from '../../types';
import ClientProfile from './ClientProfile'; 
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import ImportClientsModal from '../modals/ImportClientsModal';

const ClientesView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

  const handleDeleteClient = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    
    const confirmed = window.confirm(`⚠️ EXCLUSÃO DEFINITIVA\n\nTem certeza que deseja apagar o cliente "${client.nome}" da sua base?\n\nEsta ação não pode ser revertida.`);
    
    if (confirmed && client.id) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', client.id);

        if (error) throw error;

        setClients(prev => prev.filter(c => c.id !== client.id));
        showToast('Cliente excluído com sucesso.', 'info');
      } catch (err: any) {
        showToast('Falha ao excluir no banco de dados.', 'error');
      }
    }
  };

  const handleSaveClient = async (clientData: Client) => {
    const payload = { ...clientData };
    const isEditing = !!payload.id;

    try {
        if (isEditing) {
            const { data, error } = await supabase
                .from('clients')
                .update(payload)
                .eq('id', payload.id)
                .select()
                .single();

            if (error) throw error;
            setClients(prev => prev.map(c => c.id === data.id ? data : c));
            showToast('Perfil atualizado!');
        } else {
            const { data, error } = await supabase
                .from('clients')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            setClients(prev => [data, ...prev]);
            showToast('Cliente cadastrado!');
        }
        setSelectedClient(null);
    } catch (e: any) {
        showToast("Erro ao processar dados.", 'error');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-indigo-500'];
    return colors[name.length % colors.length];
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const name = (c.nome || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const tel = (c.whatsapp || '');
      return name.includes(term) || tel.includes(term);
    });
  }, [clients, searchTerm]);

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
              <Users className="text-orange-500" size={28} /> Clientes
          </h1>
          <p className="hidden sm:block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{clients.length} cadastrados</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle View Mode */}
          <div className="hidden md:flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em Grade"
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em Lista"
            >
              <List size={18} />
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setIsImportModalOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"><FileSpreadsheet size={20} /></button>
            <button onClick={() => setSelectedClient({ nome: '', consent: true } as any)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg active:scale-95">
              <UserPlus size={20} /> <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="relative group max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 w-5 h-5 transition-colors" />
            <input 
                type="text" 
                placeholder="Pesquisar por nome ou telefone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-[20px] focus:ring-4 focus:ring-orange-100 focus:border-orange-400 focus:bg-white outline-none font-bold text-slate-700 transition-all shadow-inner"
            />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
                <p className="text-xs font-black uppercase tracking-widest">Sincronizando base de dados...</p>
            </div>
        ) : (
          <div className="max-w-7xl mx-auto pb-24">
            {viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClients.map(client => (
                      <div 
                          key={client.id} 
                          onClick={() => setSelectedClient(client)}
                          className="group bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-orange-200 cursor-pointer transition-all active:scale-[0.98] flex flex-col relative overflow-hidden"
                      >
                          <div className="flex items-center gap-4 mb-5">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-inner flex-shrink-0 ${client.photo_url ? 'bg-white' : getAvatarColor(client.nome)}`}>
                                  {client.photo_url ? <img src={client.photo_url} className="w-full h-full object-cover rounded-2xl" alt="" /> : getInitials(client.nome)}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <h4 className="font-black text-slate-800 text-base truncate leading-tight group-hover:text-orange-600 transition-colors">{client.nome}</h4>
                                  <p className="text-xs text-slate-400 font-bold tracking-tighter mt-1">{client.whatsapp || 'Sem telefone'}</p>
                              </div>
                          </div>
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                              <div className="flex gap-2">
                                  <a href={`https://wa.me/55${client.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"><MessageCircle size={18} strokeWidth={2.5} /></a>
                                  <a href={`tel:${client.whatsapp}`} onClick={(e) => e.stopPropagation()} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"><PhoneCall size={18} strokeWidth={2.5} /></a>
                              </div>
                              <button onClick={(e) => handleDeleteClient(e, client)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100"><Trash2 size={18} strokeWidth={2.5} /></button>
                          </div>
                          <ChevronRight className="absolute -right-3 top-1/2 -translate-y-1/2 text-slate-50 group-hover:text-orange-50 transition-colors" size={60} strokeWidth={3} />
                      </div>
                  ))}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone / WhatsApp</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredClients.map(client => (
                        <tr 
                          key={client.id} 
                          onClick={() => setSelectedClient(client)}
                          className="hover:bg-orange-50/30 cursor-pointer transition-colors group"
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm flex-shrink-0 ${client.photo_url ? 'bg-white' : getAvatarColor(client.nome)}`}>
                                {client.photo_url ? <img src={client.photo_url} className="w-full h-full object-cover rounded-lg" alt="" /> : getInitials(client.nome)}
                              </div>
                              <span className="font-bold text-slate-700 group-hover:text-orange-600 transition-colors">{client.nome}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className="text-sm font-medium text-slate-500">{client.whatsapp || '---'}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <a href={`https://wa.me/55${client.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><MessageCircle size={18} strokeWidth={2.5} /></a>
                              <a href={`tel:${client.whatsapp}`} onClick={(e) => e.stopPropagation()} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><PhoneCall size={18} strokeWidth={2.5} /></a>
                              <button onClick={(e) => handleDeleteClient(e, client)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={18} strokeWidth={2.5} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {filteredClients.length === 0 && (
               <div className="py-20 text-center flex flex-col items-center">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-200">
                    <Users size={48} />
                  </div>
                  <h3 className="font-black text-slate-700">Nenhum cliente encontrado</h3>
                  <p className="text-slate-400 text-sm mt-1 uppercase tracking-tighter font-bold">Tente mudar o termo da sua pesquisa</p>
               </div>
            )}
          </div>
        )}
      </div>

      {selectedClient && (
        <ClientProfile client={selectedClient} onClose={() => setSelectedClient(null)} onSave={handleSaveClient} />
      )}

      {isImportModalOpen && (
        <ImportClientsModal onClose={() => setIsImportModalOpen(false)} onSuccess={fetchClients} />
      )}
    </div>
  );
};

export default ClientesView;
