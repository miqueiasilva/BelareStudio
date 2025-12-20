
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserPlus, Search, Filter, Phone, Mail, Tag, Edit, Trash2, User, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Client } from '../../types';
import ClientModal from '../modals/ClientModal';
import Toast, { ToastType } from '../shared/Toast';

const ClientesView: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('nome', { ascending: true });
            
            if (error) throw error;
            setClients(data || []);
        } catch (error: any) {
            setToast({ message: `Erro ao buscar clientes: ${error?.message || 'Falha na conexão'}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const handleSaveClient = async (clientData: Client) => {
        setIsLoading(true);
        try {
            const payload = {
                nome: clientData.nome,
                whatsapp: clientData.whatsapp,
                email: clientData.email,
                nascimento: clientData.nascimento || null,
                tags: clientData.tags,
                consent: clientData.consent
            };

            let res;
            if (selectedClient) {
                res = await supabase.from('clients').update(payload).eq('id', selectedClient.id);
            } else {
                res = await supabase.from('clients').insert([payload]);
            }

            if (res.error) throw res.error;

            setToast({ message: selectedClient ? 'Cliente atualizado!' : 'Novo cliente cadastrado!', type: 'success' });
            setIsModalOpen(false);
            setSelectedClient(null);
            fetchClients();
        } catch (error: any) {
            const errorMsg = error?.message || (typeof error === 'string' ? error : 'Erro desconhecido');
            setToast({ message: `Erro ao salvar: ${errorMsg}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Tem certeza que deseja remover este cliente permanentemente?')) return;
        try {
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: 'Cliente removido.', type: 'info' });
            fetchClients();
        } catch (error: any) {
            setToast({ message: 'Erro ao excluir.', type: 'error' });
        }
    };

    const filteredClients = useMemo(() => {
        return clients.filter(c => 
            c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.whatsapp?.includes(searchTerm)
        );
    }, [clients, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <User className="text-orange-500" />
                        Base de Clientes
                    </h1>
                    <p className="text-slate-500 text-sm">Gerenciamento centralizado de sua rede de contatos.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchClients} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
                    <button 
                        onClick={() => { setSelectedClient(null); setIsModalOpen(true); }}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2"
                    >
                        <UserPlus className="w-5 h-5" /> Novo Cliente
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 flex flex-col overflow-hidden">
                <div className="mb-6 relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome ou celular..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    />
                </div>

                <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {isLoading && clients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p>Carregando base de dados...</p>
                        </div>
                    ) : filteredClients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
                            <User size={64} className="text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">Nenhum cliente encontrado</h3>
                            <p className="text-slate-400">Ajuste seu filtro ou adicione um novo contato.</p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-black text-slate-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="p-4 pl-8">Cliente</th>
                                        <th className="p-4">WhatsApp</th>
                                        <th className="p-4">Tags</th>
                                        <th className="p-4 pr-8 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredClients.map(client => (
                                        <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 pl-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                                                        {client.nome.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{client.nome}</p>
                                                        <p className="text-xs text-slate-400">{client.email || 'Sem e-mail'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm font-medium text-slate-600">{client.whatsapp || '---'}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {client.tags?.map((tag, i) => (
                                                        <span key={i} className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100">{tag}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4 pr-8 text-center">
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setSelectedClient(client); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition">
                                                        <Edit size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

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
