
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    UserPlus, Search, Phone, Edit, Trash2, 
    Users, Loader2, RefreshCw, Download, Upload, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchClients = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('nome', { ascending: true })
                .abortSignal(controller.signal);
            
            if (error) throw error;
            setClients(data || []);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
            console.error("Erro fetch clients:", error);
            setToast({ message: "Não foi possível carregar a lista de clientes.", type: 'error' });
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchClients();
        return () => abortControllerRef.current?.abort();
    }, [fetchClients]);

    const handleExportCSV = () => {
        if (clients.length === 0) return;
        const headers = "Nome,WhatsApp,E-mail\n";
        const rows = clients.map(c => `"${c.nome}","${c.whatsapp || ''}","${c.email || ''}"`).join("\n");
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `belaapp_clientes_${format(new Date(), 'dd_MM_yyyy')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n');
            const batch = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(',').map(s => s.trim().replace(/"/g, ''));
                if (cols[0]) batch.push({ nome: cols[0], whatsapp: cols[1] || null, email: cols[2] || null, consent: true });
            }

            if (batch.length === 0) return;
            setIsLoading(true);
            try {
                const { error } = await supabase.from('clients').insert(batch);
                if (error) throw error;
                setToast({ message: `${batch.length} clientes importados!`, type: 'success' });
                fetchClients();
            } catch (err: any) {
                alert("Erro importação: " + err.message);
            } finally {
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleSaveClient = async (clientData: Client) => {
        setIsLoading(true);
        try {
            const payload = {
                nome: clientData.nome,
                whatsapp: clientData.whatsapp || null,
                email: clientData.email || null,
                consent: clientData.consent
            };

            const res = selectedClient
                ? await supabase.from('clients').update(payload).eq('id', selectedClient.id)
                : await supabase.from('clients').insert([payload]);

            if (res.error) throw res.error;
            setToast({ message: 'Cliente salvo com sucesso!', type: 'success' });
            setIsModalOpen(false);
            fetchClients();
        } catch (error: any) {
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClients = useMemo(() => {
        return clients.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [clients, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-orange-500" /> Clientes
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportCSV} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition" title="Exportar CSV"><Download size={20} /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition" title="Importar CSV"><Upload size={20} /></button>
                    <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
                    <button onClick={() => { setSelectedClient(null); setIsModalOpen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                        <UserPlus size={20} /> Novo Cliente
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 flex flex-col overflow-hidden">
                <div className="mb-6 relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium"
                    />
                </div>

                <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-bold text-xs uppercase tracking-widest">Sincronizando contatos...</p>
                        </div>
                    ) : filteredClients.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 italic p-10">
                            <Users size={48} className="mb-4 opacity-20" />
                            <p>Nenhum cliente encontrado.</p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="p-4 pl-8">Nome</th>
                                        <th className="p-4">WhatsApp</th>
                                        <th className="p-4">E-mail</th>
                                        <th className="p-4 pr-8 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredClients.map(client => (
                                        <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 pl-8 font-bold text-slate-800">{client.nome}</td>
                                            <td className="p-4 text-slate-600 font-medium">{client.whatsapp || '---'}</td>
                                            <td className="p-4 text-slate-500 text-sm">{client.email || 'Sem e-mail'}</td>
                                            <td className="p-4 pr-8 text-center">
                                                <button onClick={() => { setSelectedClient(client); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit size={18} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {isModalOpen && <ClientModal client={selectedClient} onClose={() => setIsModalOpen(false)} onSave={handleSaveClient} />}
        </div>
    );
};

export default ClientesView;
