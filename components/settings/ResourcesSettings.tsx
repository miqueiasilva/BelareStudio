
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Armchair, Plus, Trash2, Search, ArrowLeft, 
    Save, X, Loader2, Info, Package, Hash, 
    AlertCircle, LayoutGrid, Edit2
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';

interface Resource {
    id: string | number;
    name: string;
    quantity: number;
    active: boolean;
    created_at?: string;
}

const ResourcesSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Estado do Formulário
    const [newResource, setNewResource] = useState({ name: '', quantity: 1 });

    const fetchResources = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('resources')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setResources(data || []);
        } catch (err: any) {
            setToast({ message: "Erro ao carregar recursos.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();
    }, []);

    const handleOpenModal = (resource?: Resource) => {
        if (resource) {
            setEditingId(resource.id);
            setNewResource({ name: resource.name, quantity: resource.quantity });
        } else {
            setEditingId(null);
            setNewResource({ name: '', quantity: 1 });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newResource.name.trim()) return;

        setIsSaving(true);
        try {
            const payload = { 
                name: newResource.name, 
                quantity: Number(newResource.quantity),
                active: true 
            };

            if (editingId) {
                const { error } = await supabase
                    .from('resources')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
                setToast({ message: "Recurso atualizado com sucesso!", type: 'success' });
            } else {
                const { error } = await supabase
                    .from('resources')
                    .insert([payload]);
                if (error) throw error;
                setToast({ message: "Recurso adicionado com sucesso!", type: 'success' });
            }

            setIsModalOpen(false);
            setEditingId(null);
            setNewResource({ name: '', quantity: 1 });
            fetchResources();
        } catch (err: any) {
            setToast({ message: "Erro ao salvar recurso.", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string | number) => {
        if (!confirm("Deseja realmente excluir este recurso? Isso pode afetar a disponibilidade de novos agendamentos.")) return;

        try {
            const { error } = await supabase
                .from('resources')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setResources(prev => prev.filter(r => r.id !== id));
            setToast({ message: "Recurso removido.", type: 'info' });
        } catch (err: any) {
            setToast({ message: "Erro ao excluir recurso.", type: 'error' });
        }
    };

    const filteredResources = useMemo(() => {
        return resources.filter(r => 
            r.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [resources, searchTerm]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Cabeçalho */}
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-500 transition-all shadow-sm group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Recursos</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão de macas, salas e equipamentos</p>
                    </div>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                >
                    <Plus size={18} /> Adicionar Recurso
                </button>
            </header>

            {/* Busca */}
            <div className="relative group max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Procurar por nome..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-50 focus:border-orange-400 outline-none font-bold text-slate-700 transition-all shadow-sm"
                />
            </div>

            {/* Listagem */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin mb-4 text-orange-500" size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando inventário...</p>
                    </div>
                ) : filteredResources.length === 0 ? (
                    <div className="py-24 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-200 mb-4 border-2 border-dashed border-slate-200">
                            <Armchair size={40} />
                        </div>
                        <h3 className="font-black text-slate-700 uppercase tracking-tighter">Nenhum recurso cadastrado</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase mt-1">Clique no botão superior para adicionar itens à sua estrutura</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        <div className="grid grid-cols-12 px-8 py-4 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <div className="col-span-7">Identificação do Item</div>
                            <div className="col-span-2 text-center">Quantidade</div>
                            <div className="col-span-3 text-right">Ações</div>
                        </div>
                        {filteredResources.map((resource) => (
                            <div key={resource.id} className="grid grid-cols-12 px-8 py-5 items-center hover:bg-orange-50/30 transition-all group">
                                <div className="col-span-7 flex items-center gap-4">
                                    <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl group-hover:bg-white group-hover:text-orange-500 transition-all">
                                        <Armchair size={20} />
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">{resource.name}</span>
                                </div>
                                <div className="col-span-2 text-center">
                                    <span className="inline-flex items-center justify-center px-4 py-1.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                        {resource.quantity} un
                                    </span>
                                </div>
                                <div className="col-span-3 text-right flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleOpenModal(resource)}
                                        className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                        title="Editar"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(resource.id)}
                                        className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                        title="Excluir"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Card Informativo */}
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-[32px] flex gap-4 max-w-3xl mx-auto shadow-sm">
                <div className="p-3 bg-blue-100 rounded-2xl h-fit text-blue-600">
                    <Info size={24} />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight">Otimização de Agenda</h4>
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                        Os recursos limitam quantos agendamentos simultâneos podem ocorrer para serviços que dependem de infraestrutura específica (ex: salas de estética, macas de cílios ou cadeiras de corte). O sistema bloqueia automaticamente novos horários se todos os recursos de um tipo estiverem ocupados.
                    </p>
                </div>
            </div>

            {/* Modal de Adição/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">
                                    {editingId ? 'Editar Recurso' : 'Novo Recurso'}
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                    {editingId ? 'Atualizar infraestrutura' : 'Expandir infraestrutura'}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X size={24} /></button>
                        </header>

                        <form onSubmit={handleSave} className="p-8 space-y-6 text-left">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nome do Recurso</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500">
                                        <Package size={18} />
                                    </div>
                                    <input 
                                        autoFocus
                                        required
                                        value={newResource.name}
                                        onChange={e => setNewResource({...newResource, name: e.target.value})}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all"
                                        placeholder="Ex: Maca 01"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Quantidade Disponível</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500">
                                        <Hash size={18} />
                                    </div>
                                    <input 
                                        type="number"
                                        min="1"
                                        required
                                        value={newResource.quantity}
                                        onChange={e => setNewResource({...newResource, quantity: parseInt(e.target.value)})}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {editingId ? 'Salvar Alterações' : 'Salvar Recurso'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourcesSettings;
