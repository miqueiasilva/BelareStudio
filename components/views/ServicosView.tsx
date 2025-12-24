
import React, { useState, useEffect } from 'react';
import { 
    Plus, Scissors, Clock, DollarSign, Edit2, Trash2, 
    Loader2, Search, X, CheckCircle, Hash
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

    const fetchServices = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .order('nome', { ascending: true });
            
            if (error) throw error;
            setServices(data || []);
        } catch (error: any) {
            setToast({ message: `Error: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const handleOpenModal = (service?: Service) => {
        setEditingService(service || {
            nome: '',
            preco: 0,
            duracao_min: 30,
            cor_hex: '#f97316',
            ativo: true
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingService?.nome) return;
        
        setIsSaving(true);
        try {
            if (editingService.id) {
                const { error } = await supabase
                    .from('services')
                    .update(editingService)
                    .eq('id', editingService.id);
                if (error) throw error;
                setToast({ message: 'Serviço atualizado com sucesso!', type: 'success' });
            } else {
                const { error } = await supabase
                    .from('services')
                    .insert([editingService]);
                if (error) throw error;
                setToast({ message: 'Novo serviço cadastrado!', type: 'success' });
            }
            setIsModalOpen(false);
            fetchServices();
        } catch (error: any) {
            setToast({ message: `Erro ao salvar: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Deseja realmente excluir este serviço?')) return;
        
        try {
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: 'Serviço removido.', type: 'info' });
            fetchServices();
        } catch (error: any) {
            setToast({ message: `Erro ao excluir: ${error.message}`, type: 'error' });
        }
    };

    const filteredServices = services.filter(s => 
        s.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Scissors className="text-orange-500" />
                        Serviços
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Cadastre e gerencie os procedimentos do seu estúdio.</p>
                </div>
                
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Novo Serviço
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-8 relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar serviço..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="font-medium">Carregando serviços...</p>
                        </div>
                    ) : filteredServices.length === 0 ? (
                        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 border-dashed">
                            <Scissors size={64} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-600">Nenhum serviço encontrado</h3>
                            <p className="text-slate-400 mt-2">Clique no botão "Novo Serviço" para começar.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: service.cor_hex || '#f97316' }}></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{service.nome}</h3>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(service)} className="p-2 bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(service.id)} className="p-2 bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
                                            <Clock size={16} className="text-slate-400" />
                                            <span>{service.duracao_min} minutos</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-600 text-sm font-bold">
                                            <DollarSign size={16} className="text-green-500" />
                                            <span className="text-slate-800">R$ {service.preco.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {isModalOpen && editingService && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingService.id ? 'Editar Serviço' : 'Novo Serviço'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </header>
                        
                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Procedimento</label>
                                <input 
                                    required
                                    value={editingService.nome}
                                    onChange={e => setEditingService({...editingService, nome: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                                    placeholder="Ex: Corte e Escova"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço (R$)</label>
                                    <input 
                                        required
                                        type="number"
                                        step="0.01"
                                        value={editingService.preco}
                                        onChange={e => setEditingService({...editingService, preco: parseFloat(e.target.value)})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duração (min)</label>
                                    <input 
                                        required
                                        type="number"
                                        value={editingService.duracao_min}
                                        onChange={e => setEditingService({...editingService, duracao_min: parseInt(e.target.value)})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor de Identificação</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color"
                                        value={editingService.cor_hex || '#f97316'}
                                        onChange={e => setEditingService({...editingService, cor_hex: e.target.value})}
                                        className="w-12 h-12 rounded-xl cursor-pointer border-none p-0 bg-transparent"
                                    />
                                    <span className="text-sm font-mono text-slate-500 uppercase font-bold">{editingService.cor_hex || '#F97316'}</span>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                    {editingService.id ? 'Salvar Alterações' : 'Cadastrar Serviço'}
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
