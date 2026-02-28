
import React, { useState, useEffect, useMemo } from 'react';
import { 
    CalendarX, Plus, Trash2, Clock, Calendar, 
    User, AlertTriangle, Loader2, Save, X, ArrowLeft,
    ShieldAlert, Info, Store, Check, ChevronLeft, ChevronRight, Users
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { useConfirm } from '../../utils/useConfirm';
import toast from 'react-hot-toast';
// FIX: Grouping date-fns imports and removing problematic members startOfMonth, startOfWeek, subMonths, startOfDay, set.
import { 
    format, endOfMonth, 
    endOfWeek, eachDayOfInterval, 
    isSameDay, addMonths, isSameMonth, 
    isBefore
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';
import Card from '../shared/Card';

const BlocksSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { activeStudioId } = useStudio();
    const { confirm, ConfirmDialogComponent } = useConfirm();
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
        // FIX: Manual startOfMonth and startOfWeek replacements.
        const sm = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 0, 0, 0, 0);
        const start = new Date(sm);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);

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

            const blocksToInsert = [];

            for (const date of selectedDates) {
                // FIX: Manual set replacement using Date object methods.
                const startTime = new Date(date);
                startTime.setHours(startH, startM, 0, 0);
                const endTime = new Date(date);
                endTime.setHours(endH, endM, 0, 0);

                for (const profId of selectedProfIds) {
                    blocksToInsert.push({
                        studio_id: activeStudioId,
                        professional_id: profId === 'all' ? null : profId,
                        start_time: startTime.toISOString(),
                        end_time: endTime.toISOString(),
                        reason: reason
                    });
                }
            }

            const { error } = await supabase.from('schedule_blocks').insert(blocksToInsert);
            if (error) throw error;

            setToast({ message: `${blocksToInsert.length} bloqueios criados!`, type: 'success' });
            setIsModalOpen(false);
            setSelectedDates([]);
            setReason('');
            fetchData();
        } catch (err: any) {
            setToast({ message: "Erro ao salvar bloqueios.", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string | number) => {
        const isConfirmed = await confirm({
            title: 'Remover Bloqueio',
            message: 'Deseja realmente remover este bloqueio?',
            confirmText: 'Remover',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (!isConfirmed) return;
        try {
            const { error } = await supabase.from('schedule_blocks').delete().eq('id', id);
            if (error) throw error;
            setBlocks(prev => prev.filter(b => b.id !== id));
            toast.success("Bloqueio removido.");
        } catch (err) {
            toast.error("Erro ao remover.");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-500 transition-all shadow-sm group">
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Indisponibilidades</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bloqueios de agenda e feriados</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                    <Plus size={18} /> Novo Bloqueio
                </button>
            </header>

            <div className="grid grid-cols-1 gap-6">
                <Card title="Próximos Bloqueios" icon={<CalendarX size={18} className="text-rose-500" />}>
                    {loading ? (
                        <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
                    ) : blocks.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 text-sm italic">Nenhum bloqueio programado.</div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {blocks.map(block => (
                                <div key={block.id} className="py-4 flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">{block.title}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                {format(block.start, "dd/MM/yy")} • {format(block.start, "HH:mm")} às {format(block.end, "HH:mm")}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(block.id)} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Criar Bloqueios em Lote</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
                        </header>
                        <form onSubmit={handleSaveBatch} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-left">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Selecione os Profissionais</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <button 
                                        type="button"
                                        onClick={toggleAllProfs}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 transition-all ${selectedProfIds.length === professionals.length ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        Todos (Estúdio)
                                    </button>
                                    {professionals.map(p => (
                                        <button 
                                            key={p.id}
                                            type="button"
                                            onClick={() => toggleProf(p.id)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 transition-all truncate ${selectedProfIds.includes(p.id) ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Selecione as Datas</label>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><ChevronLeft size={16} /></button>
                                        <span className="text-xs font-black text-slate-700 uppercase">{format(currentMonth, 'MMMM yyyy', { locale: pt })}</span>
                                        <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><ChevronRight size={16} /></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                    {['D','S','T','Q','Q','S','S'].map(d => <div key={d} className="text-center text-[9px] font-black text-slate-300 py-1">{d}</div>)}
                                    {calendarDays.map(day => {
                                        const isSelected = selectedDates.some(d => isSameDay(d, day));
                                        const isCurrMonth = isSameMonth(day, currentMonth);
                                        // FIX: Manual startOfDay replacement.
                                        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
                                        const isPast = isBefore(day, startOfToday);
                                        return (
                                            <button 
                                                key={day.toISOString()}
                                                type="button"
                                                disabled={!isCurrMonth || isPast}
                                                onClick={() => toggleDate(day)}
                                                className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${isSelected ? 'bg-orange-500 text-white shadow-lg scale-110 z-10' : !isCurrMonth || isPast ? 'text-slate-200 cursor-not-allowed' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
                                            >
                                                {format(day, 'd')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Início</label>
                                    <input type="time" value={timeRange.start} onChange={e => setTimeRange({...timeRange, start: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fim</label>
                                    <input type="time" value={timeRange.end} onChange={e => setTimeRange({...timeRange, end: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Motivo do Bloqueio</label>
                                <input required value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Feriado, Almoço, Curso..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100" />
                            </div>

                            <button type="submit" disabled={isSaving || selectedProfIds.length === 0 || selectedDates.length === 0} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50">
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                Confirmar Bloqueios
                            </button>
                        </form>
                    </div>
                </div>
            )}
            <ConfirmDialogComponent />
        </div>
    );
};

export default BlocksSettings;
