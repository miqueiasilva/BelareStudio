
import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, Edit2, Save, Loader2, Check, Palette } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

interface CategoryManagerModalProps {
    onClose: () => void;
    onUpdate: () => void;
}

const colors = [
    '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', 
    '#10b981', '#ef4444', '#64748b', '#0f172a'
];

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ onClose, onUpdate }) => {
    const { activeStudioId } = useStudio();
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(colors[0]);

    const fetchCategories = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('service_categories')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('name');
            if (error) throw error;
            setCategories(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCategories(); }, [activeStudioId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !activeStudioId) return;

        setIsSaving(true);
        try {
            const payload = {
                name: name.trim(),
                color_hex: selectedColor,
                studio_id: activeStudioId
            };

            const { error } = editingId 
                ? await supabase.from('service_categories').update(payload).eq('id', editingId)
                : await supabase.from('service_categories').insert([payload]);

            if (error) throw error;

            setName('');
            setEditingId(null);
            setSelectedColor(colors[0]);
            fetchCategories();
            onUpdate();
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (cat: any) => {
        setEditingId(cat.id);
        setName(cat.name);
        setSelectedColor(cat.color_hex || colors[0]);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Ao excluir a categoria, os serviços vinculados ficarão 'Sem Categoria'. Confirmar?")) return;
        try {
            const { error } = await supabase.from('service_categories').delete().eq('id', id);
            if (error) throw error;
            fetchCategories();
            onUpdate();
        } catch (e: any) {
            alert("Erro ao excluir: " + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            <Tag className="text-orange-500" size={20} />
                            Gerenciar Categorias
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Organização do Portfólio</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8">
                    {/* FORMULÁRIO DE ADIÇÃO/EDIÇÃO */}
                    <form onSubmit={handleSave} className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                                {editingId ? 'Editar Categoria' : 'Nova Categoria'}
                            </label>
                            <input 
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-4 focus:ring-orange-100 font-bold text-slate-700"
                                placeholder="Nome da categoria..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1.5">
                                <Palette size={12} className="text-orange-500" /> Cor Visual
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setSelectedColor(c)}
                                        className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 shadow-md' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: c }}
                                    >
                                        {selectedColor === c && <Check size={14} className="text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            {editingId && (
                                <button 
                                    type="button" 
                                    onClick={() => { setEditingId(null); setName(''); }}
                                    className="flex-1 py-3 text-slate-500 font-bold text-xs uppercase"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="flex-[2] bg-slate-800 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />}
                                {editingId ? 'Atualizar' : 'Salvar Categoria'}
                            </button>
                        </div>
                    </form>

                    {/* LISTAGEM */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Categorias Existentes</h4>
                        <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                            {loading ? (
                                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                            ) : categories.length === 0 ? (
                                <p className="text-center text-slate-400 text-xs py-10 font-medium">Nenhuma categoria cadastrada.</p>
                            ) : (
                                categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl hover:border-orange-200 transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color_hex || colors[0] }}></div>
                                            <span className="font-bold text-slate-700 text-sm truncate">{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(cat)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryManagerModal;
