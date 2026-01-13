
import React, { useState, useEffect, useCallback } from 'react';
import { X, Tag, Plus, Trash2, Edit2, Save, Loader2, Check, Palette, AlertTriangle } from 'lucide-react';
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

    const fetchCategories = useCallback(async () => {
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
    }, [activeStudioId]);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

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
            await fetchCategories();
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
        // Scroll para o topo para mostrar o formulário
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("⚠️ ATENÇÃO: Serviços vinculados a esta categoria ficarão sem categoria no catálogo.\n\nDeseja realmente excluir?")) return;
        
        try {
            const { error } = await supabase.from('service_categories').delete().eq('id', id);
            if (error) throw error;
            await fetchCategories();
            onUpdate();
        } catch (e: any) {
            alert("Erro ao excluir: " + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            <Tag className="text-orange-500" size={20} />
                            Gestão de Categorias
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sincronização Ativa SaaS</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* FORMULÁRIO DE ADIÇÃO/EDIÇÃO */}
                    <form onSubmit={handleSave} className="space-y-5 bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100 shadow-inner relative">
                        {editingId && (
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-md animate-bounce">
                                Modo Edição Ativo
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                                Nome do Agrupamento
                            </label>
                            <input 
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 font-black text-slate-700 shadow-sm"
                                placeholder="Ex: Manicure, Cabelo, Barba..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1.5">
                                <Palette size={12} className="text-orange-500" /> Cor Visual da Etiqueta
                            </label>
                            <div className="flex flex-wrap gap-2 justify-between">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setSelectedColor(c)}
                                        className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: c }}
                                    >
                                        {selectedColor === c && <Check size={16} className="text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            {editingId && (
                                <button 
                                    type="button" 
                                    onClick={() => { setEditingId(null); setName(''); setSelectedColor(colors[0]); }}
                                    className="flex-1 py-3.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="flex-[2] bg-slate-800 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />}
                                {editingId ? 'Atualizar Categoria' : 'Criar Categoria'}
                            </button>
                        </div>
                    </form>

                    {/* LISTAGEM */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] ml-1">Categorias no Banco</h4>
                        <div className="space-y-2">
                            {loading ? (
                                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                            ) : categories.length === 0 ? (
                                <div className="text-center p-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                                    <Tag className="mx-auto text-slate-200 mb-2" size={32} />
                                    <p className="text-slate-400 text-[10px] font-black uppercase">Nenhuma categoria configurada.</p>
                                </div>
                            ) : (
                                categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-3xl hover:border-orange-200 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-inner" style={{ backgroundColor: cat.color_hex || colors[0] }}></div>
                                            <span className="font-black text-slate-700 text-sm truncate uppercase tracking-tight">{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(cat)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all" title="Editar"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(cat.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="Excluir"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <footer className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase flex items-center justify-center gap-1.5">
                        <AlertTriangle size={10} /> As alterações impactam todos os serviços do estúdio.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default CategoryManagerModal;
