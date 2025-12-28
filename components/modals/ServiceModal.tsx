
import React, { useState, useEffect } from 'react';
import { X, Save, Scissors, DollarSign, Clock, Tag, AlignLeft, Info, Loader2 } from 'lucide-react';
import { Service } from '../../types';

interface ServiceModalProps {
    service?: Partial<Service> | null;
    availableCategories: string[];
    onClose: () => void;
    onSave: (service: any) => Promise<void>;
}

const ServiceModal: React.FC<ServiceModalProps> = ({ service, availableCategories, onClose, onSave }) => {
    const [formData, setFormData] = useState<any>({
        nome: '',
        preco: 0,
        categoria: '',
        descricao: '',
        cor_hex: '#f97316',
        ativo: true
    });

    // Estados para o Seletor de Tempo (HH:MM)
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (service) {
            setFormData({
                ...formData,
                ...service,
                nome: service.nome || '',
                preco: service.preco || 0,
                categoria: (service as any).categoria || '',
                descricao: (service as any).descricao || '',
            });
            
            if (service.duracao_min) {
                setHours(Math.floor(service.duracao_min / 60));
                setMinutes(service.duracao_min % 60);
            }
        }
    }, [service]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        // Converte horas/minutos de volta para o total de minutos
        const totalMinutes = (Number(hours) * 60) + Number(minutes);
        const payload = { ...formData, duracao_min: totalMinutes };

        try {
            await onSave(payload);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const colors = ['#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#ef4444', '#64748b'];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Scissors className="text-orange-500" size={24} />
                            {service?.id ? 'Editar Serviço' : 'Novo Serviço'}
                        </h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Configurações de Procedimento</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                </header>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {/* Nome do Serviço */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Procedimento</label>
                        <div className="relative group">
                            <input 
                                required 
                                value={formData.nome} 
                                onChange={e => setFormData({...formData, nome: e.target.value})} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-bold text-slate-700" 
                                placeholder="Ex: Escova Progressiva" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Categoria com sugestão */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                            <div className="relative">
                                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input 
                                    list="categories-list"
                                    value={formData.categoria}
                                    onChange={e => setFormData({...formData, categoria: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-medium"
                                    placeholder="Selecione ou digite..."
                                />
                                <datalist id="categories-list">
                                    {availableCategories.map(cat => <option key={cat} value={cat} />)}
                                </datalist>
                            </div>
                        </div>

                        {/* Cor do Bloco */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor na Agenda</label>
                            <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-200 rounded-2xl h-[54px]">
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
                        {/* Preço */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço de Venda (R$)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                                <input 
                                    required 
                                    type="number" 
                                    step="0.01" 
                                    value={formData.preco} 
                                    onChange={e => setFormData({...formData, preco: parseFloat(e.target.value)})} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-black text-slate-800 text-lg" 
                                />
                            </div>
                        </div>

                        {/* Duração Inteligente */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duração Estimada</label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1 group">
                                    <input
                                        type="number"
                                        min="0"
                                        value={hours}
                                        onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-mono text-center text-lg font-bold"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-4 text-slate-400 text-[10px] font-black uppercase pointer-events-none">h</span>
                                </div>
                                <span className="text-xl font-bold text-slate-300">:</span>
                                <div className="relative flex-1 group">
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={minutes}
                                        onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-mono text-center text-lg font-bold"
                                        placeholder="00"
                                    />
                                    <span className="absolute right-3 top-4 text-slate-400 text-[10px] font-black uppercase pointer-events-none">m</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        {/* Ativo/Inativo */}
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 h-[54px]">
                            <input 
                                type="checkbox" 
                                id="status_service"
                                checked={formData.ativo}
                                onChange={e => setFormData({...formData, ativo: e.target.checked})}
                                className="w-5 h-5 rounded text-orange-500 border-slate-300 focus:ring-orange-500"
                            />
                            <label htmlFor="status_service" className="text-sm font-bold text-slate-600 cursor-pointer">Serviço Ativo para Venda</label>
                        </div>
                    </div>

                    {/* Descrição */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Detalhada</label>
                        <div className="relative group">
                            <AlignLeft className="absolute left-4 top-4 text-slate-300" size={18} />
                            <textarea 
                                value={formData.descricao} 
                                onChange={e => setFormData({...formData, descricao: e.target.value})} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all font-medium h-24 resize-none" 
                                placeholder="Dicas para o profissional ou detalhes para o cliente..." 
                            />
                        </div>
                    </div>
                </form>

                <footer className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-all">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSaving} 
                        className="flex-[2] bg-orange-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save size={20} />}
                        {service?.id ? 'Salvar Alterações' : 'Cadastrar Serviço'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ServiceModal;
