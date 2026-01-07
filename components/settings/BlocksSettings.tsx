
import React, { useState, useEffect } from 'react';
import { 
    CalendarX, Plus, Trash2, Clock, Calendar, 
    User, AlertTriangle, Loader2, Save, X, ArrowLeft,
    ShieldAlert, Info, Store
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format, parseISO } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

const BlocksSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // Estado do bloco adaptado para a UI
    const [blocks, setBlocks] = useState<any[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Form State (Mantido para compatibilidade com inputs)
    const [formData, setFormData] = useState({
        resource_id: 'all',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '08:00',
        end_time: '18:00',
        reason: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // FIX: Query explícita para evitar Erro 400 (Bad Request) por colunas inexistentes
            const [blocksRes, profsRes] = await Promise.all([
                supabase
                    .from('schedule_blocks')
                    .select('id, professional_id, start_time, end_time, reason')
                    .order('start_time', { ascending: true }),
                supabase.from('team_members').select('id, name').eq('active', true)
            ]);

            if (blocksRes.error) throw blocksRes.error;
            if (profsRes.error) throw profsRes.error;

            // --- ADAPTER PATTERN: Mapeamento de Banco -> UI ---
            const formattedData = (blocksRes.data || []).map(block => ({
                id: block.id,
                resourceId: block.professional_id, // Mapeia professional_id para resourceId
                start: new Date(block.start_time),  // Converte string ISO para Date JS
                end: new Date(block.end_time),
                title: block.reason                // Mapeia reason para title
            }));

            setBlocks(formattedData);
            setProfessionals(profsRes.data || []);
        } catch (err: any) {
            console.error("Erro ao carregar bloqueios:", err);
            setToast({ message: "Erro ao sincronizar dados.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Combinação de Data + Hora para ISO String
        const startIso = new Date(`${formData.start_date}T${formData.start_time}`).toISOString();
        const endIso = new Date(`${formData.start_date}T${formData.end_time}`).toISOString();
        
        if (new Date(endIso) <= new Date(startIso)) {
            alert("O horário de término deve ser posterior ao de início.");
            return;
        }

        setIsSaving(true);
        try {
            // Payload respeitando estritamente o esquema do banco
            const payload = {
                professional_id: formData.resource_id === 'all' ? null : formData.resource_id,
                start_time: startIso,
                end_time: endIso,
                reason: formData.reason || 'Bloqueio administrativo'
            };

            const { error } = await supabase.from('schedule_blocks').insert([payload]);
            if (error) throw error;

            setToast({ message: "Bloqueio registrado com sucesso!", type: 'success' });
            setIsModalOpen(false);
            setFormData({ ...formData, reason: '' }); 
            fetchData(); // Recarrega aplicando o adaptador
        } catch (err: any) {
            setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja remover este bloqueio?")) return;

        try {
            const { error } = await supabase.from('schedule_blocks').delete().eq('id', id);
            if (error) throw error;
            setBlocks(prev => prev.filter(b => b.id !== id));
            setToast({ message: "Bloqueio removido.", type: 'info' });
        } catch (err: any) {
            setToast({ message: "Erro ao excluir.", type: 'error' });
        }
    };

    const getProfessionalName = (id: string | null) => {
        if (!id) return "Loja Inteira";
        return professionals.find(p => p.id === id)?.name || "Profissional";
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-500 transition-all shadow-sm">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Bloqueios de Agenda</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão de indisponibilidades</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                    <Plus size={18} /> Novo Bloqueio
                </button>
            </header>

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-orange-500" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Consultando banco de dados...</p>
                </div>
            ) : blocks.length === 0 ? (
                <div className="bg-white rounded-[40px] p-20 text-center border-2 border-slate-100 border-dashed max-w-2xl mx-auto">
                    <CalendarX size={64} className="mx-auto text-slate-100 mb-6" />
                    <h3 className="text-xl font-black text-slate-800">Agenda Livre</h3>
                    <p className="text-slate-400 text-sm mt-2">Não há bloqueios futuros registrados.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {blocks.map(block => (
                        <div key={block.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-2xl ${!block.resourceId ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                                        {!block.resourceId ? <Store size={20}/> : <User size={20} />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escopo</p>
                                        <h4 className="font-black text-slate-800 text-sm">{getProfessionalName(block.resourceId)}</h4>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(block.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3">
                                    <Calendar size={16} className="text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600">{format(block.start, 'dd/MM/yyyy')}</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3">
                                    <Clock size={16} className="text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600">{format(block.start, 'HH:mm')} - {format(block.end, 'HH:mm')}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                                <ShieldAlert size={14} className="text-orange-400" />
                                <p className="text-[11px] font-medium text-slate-500 italic">"{block.title}"</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Formulário */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <header className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Novo Bloqueio</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Definir indisponibilidade</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all"><X size={24} /></button>
                        </header>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Responsável</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"><User size={18} /></div>
                                    <select 
                                        value={formData.resource_id}
                                        onChange={e => setFormData({...formData, resource_id: e.target.value})}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-orange-200"
                                    >
                                        <option value="all">⚠️ Toda a Loja / Estúdio</option>
                                        {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Data</label>
                                <input 
                                    type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({...formData, start_date: e.target.value})}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-orange-200"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Início</label>
                                    <input 
                                        type="time"
                                        value={formData.start_time}
                                        onChange={e => setFormData({...formData, start_time: e.target.value})}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-orange-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Término</label>
                                    <input 
                                        type="time"
                                        value={formData.end_time}
                                        onChange={e => setFormData({...formData, end_time: e.target.value})}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-orange-200"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Motivo</label>
                                <input 
                                    required
                                    value={formData.reason}
                                    onChange={e => setFormData({...formData, reason: e.target.value})}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-orange-200"
                                    placeholder="Ex: Almoço, Reunião..."
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-[24px] shadow-xl flex items-center justify-center gap-3 text-lg uppercase disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                                {isSaving ? 'Salvando...' : 'Confirmar Bloqueio'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlocksSettings;
