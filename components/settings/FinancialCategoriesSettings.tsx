
import React, { useState, useEffect, useCallback } from 'react';
import { 
    ArrowLeft, Plus, Edit2, Trash2, Tag, 
    CheckCircle2, XCircle, Loader2, Save, X
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { FinancialCategory } from '../../types';
import toast from 'react-hot-toast';

interface FinancialCategoriesSettingsProps {
    onBack: () => void;
}

const FinancialCategoriesSettings: React.FC<FinancialCategoriesSettingsProps> = ({ onBack }) => {
    const { activeStudioId } = useStudio();
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
    const [formData, setFormData] = useState<Partial<FinancialCategory>>({
        name: '',
        type: 'income',
        dre_line: 'Despesa Operacional',
        active: true
    });

    const fetchCategories = useCallback(async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_categories')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('name', { ascending: true });

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
            toast.error('Erro ao carregar categorias.');
        } finally {
            setLoading(false);
        }
    }, [activeStudioId]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleOpenModal = (category?: FinancialCategory) => {
        if (category) {
            setEditingCategory(category);
            setFormData(category);
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                type: activeTab,
                dre_line: activeTab === 'income' ? 'Receita Bruta' : 'Despesa Operacional',
                active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeStudioId || !formData.name) return;

        try {
            const payload = {
                ...formData,
                studio_id: activeStudioId
            };

            if (editingCategory) {
                const { error } = await supabase
                    .from('financial_categories')
                    .update(payload)
                    .eq('id', editingCategory.id);
                if (error) throw error;
                toast.success('Categoria atualizada!');
            } else {
                const { error } = await supabase
                    .from('financial_categories')
                    .insert([payload]);
                if (error) throw error;
                toast.success('Categoria criada!');
            }

            setIsModalOpen(false);
            fetchCategories();
        } catch (error) {
            console.error('Erro ao salvar categoria:', error);
            toast.error('Erro ao salvar categoria.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

        try {
            const { error } = await supabase
                .from('financial_categories')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Categoria excluída!');
            fetchCategories();
        } catch (error) {
            console.error('Erro ao excluir categoria:', error);
            toast.error('Erro ao excluir categoria.');
        }
    };

    const toggleStatus = async (category: FinancialCategory) => {
        try {
            const { error } = await supabase
                .from('financial_categories')
                .update({ active: !category.active })
                .eq('id', category.id);
            if (error) throw error;
            fetchCategories();
        } catch (error) {
            console.error('Erro ao alterar status:', error);
            toast.error('Erro ao alterar status.');
        }
    };

    const filteredCategories = categories.filter(c => c.type === activeTab);

    const getDreLineBadge = (line: string) => {
        switch (line) {
            case 'Receita Bruta': return 'bg-emerald-100 text-emerald-700';
            case 'Custo Direto': return 'bg-orange-100 text-orange-700';
            case 'Despesa Operacional': return 'bg-rose-100 text-rose-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-colors font-bold uppercase text-[10px] tracking-widest"
                >
                    <ArrowLeft size={16} />
                    Voltar ao Hub
                </button>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95"
                >
                    <Plus size={16} />
                    Nova Categoria
                </button>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
                    <button 
                        onClick={() => setActiveTab('income')}
                        className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Receitas
                    </button>
                    <button 
                        onClick={() => setActiveTab('expense')}
                        className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Despesas
                    </button>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Carregando categorias...</p>
                        </div>
                    ) : filteredCategories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Tag className="text-slate-200" size={32} />
                            </div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma categoria encontrada.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredCategories.map(category => (
                                <div 
                                    key={category.id}
                                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-orange-100 hover:bg-orange-50/10 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${category.active ? 'bg-slate-50 text-slate-400' : 'bg-slate-100 text-slate-300'}`}>
                                            <Tag size={20} />
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm ${category.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                                                {category.name}
                                            </h4>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${getDreLineBadge(category.dre_line)}`}>
                                                {category.dre_line}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => toggleStatus(category)}
                                            className={`p-2 rounded-xl transition-all ${category.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-100'}`}
                                            title={category.active ? "Desativar" : "Ativar"}
                                        >
                                            {category.active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                        </button>
                                        <button 
                                            onClick={() => handleOpenModal(category)}
                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                            title="Editar"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(category.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <header className="p-6 bg-slate-800 text-white flex justify-between items-center">
                            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
                                <Tag size={20} className="text-orange-400" />
                                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </header>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Categoria</label>
                                <input 
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 transition-all"
                                    placeholder="Ex: Aluguel, Venda de Produtos..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                                    <select 
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 transition-all"
                                    >
                                        <option value="income">Receita</option>
                                        <option value="expense">Despesa</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                                        <input 
                                            type="checkbox"
                                            checked={formData.active}
                                            onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                            className="w-5 h-5 rounded-lg text-orange-500 focus:ring-orange-500 border-slate-300"
                                        />
                                        <span className="text-sm font-bold text-slate-600">Ativo</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linha da DRE Gerencial</label>
                                <select 
                                    value={formData.dre_line}
                                    onChange={e => setFormData({ ...formData, dre_line: e.target.value as any })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 transition-all"
                                >
                                    <option value="Receita Bruta">Receita Bruta</option>
                                    <option value="Custo Direto">Custo Direto</option>
                                    <option value="Despesa Operacional">Despesa Operacional</option>
                                    <option value="Não Contabilizar">Não Contabilizar</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={16} />
                                    Salvar Categoria
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialCategoriesSettings;
