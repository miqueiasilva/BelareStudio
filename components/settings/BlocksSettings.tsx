
import React, { useState, useEffect, useMemo } from 'react';
import { 
    CalendarX, Plus, Trash2, Clock, Calendar, 
    User, AlertTriangle, Loader2, Save, X, ArrowLeft,
    ShieldAlert, Info, Store, Check, ChevronLeft, ChevronRight, Users
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { 
    format, endOfMonth, 
    endOfWeek, eachDayOfInterval, 
    isSameDay, addMonths, isSameMonth, 
    isBefore
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';

const BlocksSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { activeStudioId } = useStudio();
    const [blocks, setBlocks] = useState<any[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [selectedProfIds, setSelectedProfIds] = useState<string[]>([]);
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [timeRange, setTimeRange] = useState({ start: '08:00', end: '18:00' });
    const [reason, setReason] = useState('');

    const fetchData = async () => {
        if (!activeStudioId) return;
        setLoading(true);
        try {
            const [blocksRes, profsRes] = await Promise.all([
                supabase
                    .from('schedule_blocks')
                    .select('id, professional_id, start_time, end_time, reason')
                    .eq('studio_id', activeStudioId)
                    .order('start_time', { ascending: true }),
                supabase.from('team_members').select('id, name, photo_url').eq('studio_id', activeStudioId).eq('active', true)
            ]);

            if (blocksRes.error) throw blocksRes.error;
            if (profsRes.error) throw profsRes.error;

            const formattedData = (blocksRes.data || []).map(block => ({
                id: block.id,
                resourceId: block.professional_id,
                start: new Date(block.start_time),
                end: new Date(block.end_time),
                title: block.reason
            }));

            setBlocks(formattedData);
            setProfessionals(profsRes.data || []);
        } catch (err: any) {
            setToast({ message: "Erro ao sincronizar dados.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [activeStudioId]);

    const calendarDays = useMemo(() => {
        // FIX: Replaced startOfMonth and startOfWeek with manual implementation
        const som = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const d = new Date(som);
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);
        const start = d;

        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const toggleDate = (day: Date) => {
        const isSelected = selectedDates.some(d => isSameDay(d, day));
        if (isSelected) setSelectedDates(prev => prev.filter(d => !isSameDay(d, day)));
        else setSelectedDates(prev => [...prev, day]);
    };

    const toggleProf = (id: string) => {
        setSelectedProfIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const toggleAllProfs = () => {
        if (selectedProfIds.length === professionals.length) setSelectedProfIds([]);
        else setSelectedProfIds(professionals.map(p => p.id));
    };

    const handleSaveBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedProfIds.length === 0 || selectedDates.length === 0 || !reason.trim() || !activeStudioId) return;

        setIsSaving(true);
        try {
            const [startH, startM] = timeRange.start.split(':').map(Number);
            const [endH, endM] = timeRange.end.split(':').map(Number);
            const blocksToInsert: any[] = [];

            selectedProfIds.forEach(profId => {
                selectedDates.forEach(date => {
                    // FIX: Replaced set with manual Date implementation
                    const startTime = new Date(date);
                    startTime.setHours(startH, startM, 0, 0);
                    const endTime = new Date(date);
                    endTime.setHours(endH, endM, 0, 0);

                    blocksToInsert.push({
                        studio_id: activeStudioId,
                        professional_id: profId === 'store' ? null : profId,
                        start_time: startTime.toISOString(),
                        end_time: endTime.toISOString(),
                        reason: reason
                    });
                });
            });

            const { error } = await supabase.from('schedule_blocks').insert(blocksToInsert);
            if (error) throw error;
            setToast({ message: `${blocksToInsert.length} bloqueios criados!`, type: 'success' });
            setIsModalOpen(false);
            setSelectedDates([]); setSelectedProfIds([]); setReason('');
            fetchData();
        } catch (err: any) {
            setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remover este bloqueio?") || !activeStudioId) return;
        try {
            const { error } = await supabase.from('schedule_blocks').delete().eq('id', id).eq('studio_id', activeStudioId);
            if (error) throw error;
            setBlocks(prev => prev.filter(b => b.id !== id));
            setToast({ message: "Bloqueio removido.", type: 'info' });
        } catch (err: any) {
            setToast({ message: "Erro ao excluir.", type: 'error' });
        }
    };

    const getProfessionalName = (id: string | null) => id ? professionals.find(p => p.id === id)?.name || "Profissional" : "Loja Inteira";

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4"><button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-500 transition-all shadow-sm"><ArrowLeft size={20} /></button><div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Bloqueios de Agenda</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão de indisponibilidades em lote</p></div></div>
                <button onClick={() => setIsModalOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"><Plus size={18} /> Novo Bloqueio</button>
            </header>
            {loading ? (<div className="py-24 flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4 text-orange-500" size={32} /><p className="text-[10px] font-black uppercase tracking-widest">Sincronizando dados...</p></div>) : blocks.length === 0 ? (<div className="bg-white rounded-[40px] p-20 text-center border-2 border-slate-100 border-dashed max-w-2xl mx-auto"><CalendarX size={64} className="mx-auto text-slate-100 mb-6" /><h3 className="text-xl font-black text-slate-800">Sem Bloqueios</h3><p className="text-slate-400 text-sm mt-2">Clique no botão acima para registrar folgas ou horários indisponíveis.</p></div>) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{blocks.map(block => (
                    <div key={block.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"><div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><div className={`p-3 rounded-2xl ${!block.resourceId ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>{!block.resourceId ? <Store size={20}/> : <User size={20} />}</div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escopo</p><h4 className="font-black text-slate-800 text-sm">{getProfessionalName(block.resourceId)}</h4></div></div><button onClick={() => handleDelete(block.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button></div><div className="grid grid-cols-2 gap-4"><div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3"><Calendar size={16} className="text-slate-400" /><span className="text-xs font-bold text-slate-600">{format(block.start, 'dd/MM/yyyy')}</span></div><div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3"><Clock size={16} className="text-slate-400" /><span className="text-xs font-bold text-slate-600">{format(block.start, 'HH:mm')} - {format(block.end, 'HH:mm')}</span></div></div><div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2"><ShieldAlert size={14} className="text-orange-400" /><p className="text-[11px] font-medium text-slate-500 italic">"{block.title}"</p></div></div>
                ))}</div>
            )}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <header className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 flex-shrink-0"><div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Novo Bloqueio em Lote</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Multiplique folgas em segundos</p></div><button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all"><X size={24} /></button></header>
                        <form onSubmit={handleSaveBatch} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                            <div className="space-y-4"><div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">1. Profissionais Afetados</label><button type="button" onClick={toggleAllProfs} className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:underline">{selectedProfIds.length === professionals.length ? 'Desmarcar Todos' : 'Selecionar Todos'}</button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><button type="button" onClick={() => toggleProf('store')} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${selectedProfIds.includes('store') ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}><div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${selectedProfIds.includes('store') ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200'}`}>{selectedProfIds.includes('store') && <Check size={14} strokeWidth={4} />}</div><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Store size={14}/></div><span className="text-xs font-bold text-slate-700">Toda a Loja</span></button>
                                {professionals.map(p => (<button key={p.id} type="button" onClick={() => toggleProf(p.id)} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${selectedProfIds.includes(p.id) ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}><div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${selectedProfIds.includes(p.id) ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200'}`}>{selectedProfIds.includes(p.id) && <Check size={14} strokeWidth={4} />}</div><div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200"><img src={p.photo_url || `https://ui-avatars.com/api/?name=${p.name}`} className="w-full h-full object-cover" /></div><span className="text-xs font-bold text-slate-700 truncate">{p.name}</span></button>))}
                            </div></div>
                            <div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">2. Selecione os Dias ({selectedDates.length})</label><div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"><div className="flex justify-between items-center mb-6"><h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Calendar size={16} className="text-orange-500" /><span className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: pt })}</span></h4><div className="flex gap-2"><button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><ChevronLeft size={20} /></button><button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><ChevronRight size={20} /></button></div></div><div className="grid grid-cols-7 gap-1">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (<div key={d} className="text-center text-[10px] font-black text-slate-300 py-2">{d}</div>))}
                                {calendarDays.map((day) => { const isSelected = selectedDates.some(d => isSameDay(d, day)); const isCurrMonth = isSameMonth(day, currentMonth); const isPast = isBefore(new Date(new Date(day).setHours(0, 0, 0, 0)), new Date(new Date().setHours(0, 0, 0, 0))); return (<button key={day.toISOString()} type="button" disabled={!isCurrMonth || isPast} onClick={() => toggleDate(day)} className={`aspect-square rounded-2xl flex items-center justify-center text-xs font-bold transition-all relative ${!isCurrMonth ? 'opacity-0 pointer-events-none' : ''} ${isSelected ? 'bg-orange-500 text-white shadow-lg scale-110 z-10' : isPast ? 'text-slate-200 cursor-not-allowed' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'}`}>{format(day, 'd')}</button>); })}
                            </div></div></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">3. Janela de Horário</label><div className="flex items-center gap-3"><input type="time" value={timeRange.start} onChange={e => setTimeRange({...timeRange, start: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-orange-300" /><span className="text-slate-300 font-bold">até</span><input type="time" value={timeRange.end} onChange={e => setTimeRange({...timeRange, end: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-orange-300" /></div></div><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">4. Motivo do Bloqueio</label><input required value={reason} onChange={e => setReason(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-orange-300" placeholder="Ex: Almoço, Folga, Reforma..." /></div></div>
                        </form>
                        <footer className="p-8 bg-slate-50 border-t border-slate-100 flex-shrink-0"><button onClick={handleSaveBatch} disabled={isSaving || selectedDates.length === 0 || selectedProfIds.length === 0} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-orange-100 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest disabled:opacity-50 disabled:grayscale">{isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}{isSaving ? 'Registrando...' : `Confirmar ${selectedProfIds.length * selectedDates.length} Bloqueios`}</button></footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlocksSettings;
