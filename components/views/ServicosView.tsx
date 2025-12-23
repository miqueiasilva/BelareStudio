
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Plus, Scissors, Clock, DollarSign, Edit2, Trash2, 
    Loader2, Search, X, CheckCircle, Upload, Download, AlertCircle
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Service } from '../../types';
import Toast, { ToastType } from '../shared/Toast';

const ServicosView: React.FC = () => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchServices = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .order('nome', { ascending: true })
                .abortSignal(controller.signal);
            
            if (error) throw error;
            setServices(data || []);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
            console.error("Erro serviços:", error);
        } finally {
            if (abortControllerRef.current === controller) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchServices();
        return () => abortControllerRef.current?.abort();
    }, [fetchServices]);

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
                const columns = line.split(',').map(s => s.trim().replace(/"/g, ''));
                if (columns[0]) {
                    batch.push({ 
                        nome: columns[0], 
                        preco: parseFloat(columns[1]) || 0, 
                        duracao_min: parseInt(columns[2]) || 30, 
                        ativo: true 
                    });
                }
            }

            if (batch.length === 0) return;

            setLoading(true);
            try {
                const { error } = await supabase.from('services').insert(batch);
                if (error) throw error;
                setToast({ message: `${batch.length} serviços importados!`, type: 'success' });
                fetchServices();
            } catch (err: any) {
                alert("Erro importação: " + err.message);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);
    };

    const handleOpenModal = (service?: Service) => {
        setEditingService(service || { nome: '', preco: 0, duracao_min: 30, cor_hex: '#f97316', ativo: true });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingService?.nome) return;
        
        setIsSaving(true);
        try {
            const res = editingService.id 
                ? await supabase.from('services').update(editingService).eq('id', editingService.id)
                : await supabase.from('services').insert([editingService]);

            if (res.error) throw res.error;
            setToast({ message: 'Serviço salvo!', type: 'success' });
            setIsModalOpen(false);
            fetchServices();
        } catch (error: any) {
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Excluir permanentemente?')) return;
        try {
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: 'Removido.', type: 'info' });
            fetchServices();
        } catch (error: any) {
            alert("Erro ao excluir: " + error.message);
        }
    };

    const filteredServices = services.filter(s => s.nome.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Scissors className="text-orange-500" /> Serviços
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Procedimentos e precificação.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition" title="Importar CSV"><Upload size={20} /></button>
                    <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
                    <button onClick={() => handleOpenModal()} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                        <Plus size={20} /> Novo Serviço
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-8 relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar serviço..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                    </div>

                    {loading && services.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="font-medium text-sm">Sincronizando serviços...</p>
                        </div>
                    ) : filteredServices.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic">
                             Nenhum serviço disponível.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: service.cor_hex || '#f97316' }}></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{service.nome}</h3>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(service)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(service.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                        <div className="flex items-center gap-1 text-slate-500 font-bold text-xs uppercase tracking-widest">
                                            <Clock size={14}/> {service.duracao_min} min
                                        </div>
                                        <div className="font-black text-slate-900 text-base">R$ {service.preco.toFixed(2)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {isModalOpen && editingService && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">{editingService.id ? 'Editar Serviço' : 'Novo Serviço'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </header>
                        <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Procedimento</label>
                                <input required value={editingService.nome} onChange={e => setEditingService({...editingService, nome: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none transition-all font-medium" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço (R$)</label>
                                    <input required type="number" step="0.01" value={editingService.preco} onChange={e => setEditingService({...editingService, preco: parseFloat(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duração (min)</label>
                                    <input required type="number" value={editingService.duracao_min} onChange={e => setEditingService({...editingService, duracao_min: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
                                <button type="submit" disabled={isSaving} className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70">
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicosView;
