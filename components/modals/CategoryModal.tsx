import React, { useState } from 'react';
import { X, Tag, Save, Loader2, Check } from 'lucide-react';

interface CategoryModalProps {
    onClose: () => void;
    onSave: (category: { name: string; color: string }) => Promise<void>;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ onClose, onSave }) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#f97316');
    const [isSaving, setIsSaving] = useState(false);

    const colors = [
        '#f97316', // Laranja BelaFlow
        '#ef4444', // Vermelho
        '#3b82f6', // Azul
        '#10b981', // Verde
        '#8b5cf6', // Roxo
        '#ec4899', // Rosa
        '#64748b', // Cinza
        '#0f172a', // Preto/Slate
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            await onSave({ name, color });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Tag className="text-orange-500" size={20} />
                            Nova Categoria
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Categoria</label>
                        <input 
                            required 
                            autoFocus
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700" 
                            placeholder="Ex: Cílios, Estética..." 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor da Etiqueta</label>
                        <div className="grid grid-cols-4 gap-3">
                            {colors.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`h-10 rounded-xl transition-all flex items-center justify-center shadow-sm ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-105' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                                    style={{ backgroundColor: c }}
                                >
                                    {color === c && <Check size={16} className="text-white" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving || !name.trim()}
                            className="flex-1 bg-orange-500 text-white py-3 rounded-2xl font-black shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={18} />}
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CategoryModal;