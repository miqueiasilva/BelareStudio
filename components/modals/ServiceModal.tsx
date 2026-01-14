
import React, { useState, useEffect } from 'react';
import { X, Save, Scissors, DollarSign, Clock, Tag, AlignLeft, Info, Loader2, ChevronDown, Plus } from 'lucide-react';
import { Service } from '../../types';

interface ServiceModalProps {
    service?: Partial<Service> | null;
    dbCategories: any[];
    onClose: () => void;
    onSave: (service: any) => Promise<void>;
    onOpenCategoryManager: () => void;
}

const ServiceModal: React.FC<ServiceModalProps> = ({ service, dbCategories, onClose, onSave, onOpenCategoryManager }) => {
    const [formData, setFormData] = useState<any>({
        nome: '',
        preco: 0,
        categoria: '',
        category_id: '',
        descricao: '',
        cor_hex: '#f97316',
        ativo: true
    });

    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (service) {
            setFormData({
                ...formData,
                ...service,
                nome: service.nome || '',
                preco: Number(service.preco) || 0,
                categoria: (service as any).categoria || '',
                category_id: (service as any).category_id || '',
                descricao: (service as any).descricao || '',
                cor_hex: service.cor_hex || '#f97316',
                ativo: service.ativo ?? true
            });
            
            if (service.duracao_min) {
                setHours(Math.floor(service.duracao_min / 60));
                setMinutes(service.duracao_min % 60);
            }
        }
    }, [service]);

    const handleCategoryChange = (id: string) => {
        const selected = dbCategories?.find(c => String(c.id) === String(id));
        setFormData({
            ...formData,
            category_id: id,
            categoria: selected ? selected.name : ''
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nome.trim()) return;

        setIsSaving(true);
        const totalMinutes = (Number(hours) * 60) + Number(minutes);
        
        // Payload garantindo tanto nome quanto ID da categoria para compatibilidade
        const payload = { 
            ...formData, 
            duracao_min: totalMinutes,
            category_id: formData.category_id || null,
            categoria: formData.categoria || 'Sem Categoria'
        };

        try {
            await onSave(payload);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const colors = ['#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#ef4444', '#64748b', '#0f172a'];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                                <Scissors size={20} />
                            </div>
                            {service?.id ? 'Configurar Serviço' : 'Novo Serviço'}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-12">Unidade Ativa - BelareStudio</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </header>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-left">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Procedimento</label>
                        <input 
                            required 
                            autoFocus
                            value={formData.nome} 
                            onChange={e => setFormData({...formData, nome: e.target.value})} 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-black text-slate-700 text-lg shadow-inner" 
                            placeholder="Ex: Escova Progressiva Premium" 
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1 group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors pointer-events-none">
                                        <Tag size={18} />
                                    </div>
                                    <select 
                                        value={formData.category_id}
                                        onChange={e => handleCategoryChange(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-10 py-3.5 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                                    >
                                        <option value="">Sem Categoria</option>
                                        {dbCategories?.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                        <ChevronDown size={16} />
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onOpenCategoryManager();
                                    }}
                                    className="p-3.5 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 active:scale-95 flex items-center justify-center group"
                                    title="Gerenciar Categorias"
                                >
                                    <Plus size={22} strokeWidth={3} className="transition-transform group-hover:rotate-90" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Identificadora</label>
                            <div className="flex items-center gap-2 p-2 bg-slate-50 border-2 border-slate-100 rounded-2xl h-[54px] justify-between">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setFormData({...formData, cor_hex: c})}
                                        className={`w-7 h-7 rounded-full transition-all flex-shrink-0 ${formData.cor_hex === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Sugerido (R$)</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                    <DollarSign size={20} />
                                </div>
                                <input 
                                    required 
                                    type="number" 
                                    step="0.01" 
                                    value={formData.preco} 
                                    onChange={e => setFormData({...formData, preco: parseFloat(e.target.value)})} 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-black text-slate-800 text-xl" 
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duração do Bloco</label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1 group">
                                    <input
                                        type="number"
                                        min="0"
                                        value={hours}
                                        onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-black text-center text-lg text-slate-700"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-4 text-slate-300 text-[8px] font-black uppercase">hrs</span>
                                </div>
                                <span className="text-xl font-bold text-slate-200">:</span>
                                <div className="relative flex-1 group">
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={minutes}
                                        onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all font-black text-center text-lg text-slate-700"
                                        placeholder="00"
                                    />
                                    <span className="absolute right-3 top-4 text-slate-300 text-[8px] font-black uppercase">min</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Técnica / Notas Internas</label>
                        <div className="relative group">
                            <AlignLeft className="absolute left-4 top-4 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={20} />
                            <textarea 
                                value={formData.descricao} 
                                onChange={e => setFormData({...formData, descricao: e.target.value})} 
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl pl-12 pr-4 py-4 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-medium text-slate-600 h-28 resize-none shadow-inner" 
                                placeholder="Instruções especiais..." 
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-5 bg-slate-50 border-2 border-slate-100 rounded-[28px] group transition-all hover:border-orange-200">
                        <input 
                            type="checkbox" 
                            id="service_active_toggle"
                            checked={formData.ativo}
                            onChange={e => setFormData({...formData, ativo: e.target.checked})}
                            className="w-6 h-6 rounded-lg text-orange-500 border-slate-300 focus:ring-orange-500 cursor-pointer"
                        />
                        <label htmlFor="service_active_toggle" className="flex-1 cursor-pointer">
                            <p className="font-black text-slate-700 text-sm">Disponível para venda?</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Define se o serviço aparece na agenda e PDV</p>
                        </label>
                    </div>
                </form>

                <footer className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSaving} 
                        className="flex-[2] bg-slate-800 text-white py-4 rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
                    >
                        {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save size={18} />}
                        Confirmar e Salvar
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ServiceModal;
