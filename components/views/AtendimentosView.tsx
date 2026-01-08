
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    ShoppingBag, Ban, Settings as SettingsIcon, Maximize2, 
    LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, Clock,
    AlertTriangle, ArrowRight, CalendarDays, Globe, User, ThumbsUp, MapPin, 
    CheckCircle2, Scissors, ShieldAlert, Trash2, DollarSign, CheckCircle
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, isSameMonth, parseISO, addMinutes, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

import { LegacyAppointment, AppointmentStatus, FinancialTransaction, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
import BlockTimeModal from '../modals/BlockTimeModal';
import NewTransactionModal from '../modals/NewTransactionModal';
import JaciBotPanel from '../JaciBotPanel';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const START_HOUR = 8;
const END_HOUR = 20; 
const SLOT_PX_HEIGHT = 80; 

const STATUS_PRIORITY: Record<string, number> = {
    'em_atendimento': 1,
    'chegou': 2,
    'confirmado_whatsapp': 3,
    'confirmado': 4,
    'agendado': 5,
    'pendente': 5, 
    'em_espera': 6,
    'concluido': 7,
    'faltou': 8,
    'cancelado': 9,
    'bloqueado': 10
};

const ConflictAlertModal = ({ newApp, conflictApp, onConfirm, onCancel }: any) => {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-orange-100">
                <div className="bg-orange-50 p-8 text-center border-b border-orange-100">
                    <div className="w-20 h-20 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200 animate-bounce">
                        <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 leading-tight">Conflito de Horário!</h2>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <p className="text-slate-600 text-sm leading-relaxed text-center font-medium">
                            O horário das <b className="text-slate-800">{format(newApp.start, 'HH:mm')}</b> às <b className="text-slate-800">{format(newApp.end, 'HH:mm')}</b> choca com o atendimento de:
                        </p>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                                <CalendarDays size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-800 truncate">{conflictApp.client_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{conflictApp.service_name}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={onConfirm} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-100 transition-all active:scale-95 flex items-center justify-center gap-2">Salvar Mesmo Assim</button>
                        <button onClick={onCancel} className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors">Voltar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getAppointmentPosition = (start: Date, end: Date, timeSlot: number) => {
    const pixelsPerMinute = SLOT_PX_HEIGHT / timeSlot;
    const startMinutesSinceDayStart = (start.getHours() * 60 + start.getMinutes()) - (START_HOUR * 60);
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;

    const top = Math.floor(startMinutesSinceDayStart * pixelsPerMinute);
    const height = Math.max(20, Math.floor(durationMinutes * pixelsPerMinute));
    
    return { 
        position: 'absolute' as const,
        top: `${top}px`, 
        height: `${height}px`,
        width: '100%', 
        zIndex: 20,
        left: '0px'
    };
};

const getCardStyle = (app: any) => {
    const baseClasses = "rounded-none shadow-sm border-l-4 p-1.5 cursor-pointer hover:brightness-95 transition-all overflow-hidden flex flex-col group/card !m-0 border-r border-b border-slate-200/50 relative";
    
    if (app.type === 'block') {
        return "absolute rounded-none border-l-4 border-rose-400 bg-[repeating-linear-gradient(45deg,#fcfcfc,#fcfcfc_10px,#f8fafc_10px,#f8fafc_20px)] text-slate-500 p-2 overflow-hidden flex flex-col cursor-not-allowed opacity-95 z-[25] pointer-events-auto shadow-sm";
    }

    return baseClasses;
};

const TimelineIndicator = ({ timeSlot }: { timeSlot: number }) => {
    const [topPosition, setTopPosition] = useState(0);
    useEffect(() => {
        const calculatePosition = () => {
            const now = new Date();
            const startMinutes = START_HOUR * 60;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (nowMinutes < startMinutes || nowMinutes > (END_HOUR * 60)) { setTopPosition(-1); return; }
            const pixelsPerMinute = SLOT_PX_HEIGHT / timeSlot;
            const top = (nowMinutes - startMinutes) * pixelsPerMinute;
            setTopPosition(top);
        };
        calculatePosition();
        const intervalId = setInterval(calculatePosition, 60000); 
        return () => clearInterval(intervalId);
    }, [timeSlot]);
    if (topPosition < 0) return null;
    return (
        <div className="absolute w-full z-10 pointer-events-none" style={{ top: `${topPosition}px` }}>
            <div className="h-px bg-red-500 w-full relative"><div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm"></div></div>
        </div>
    );
};

interface AtendimentosViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
    onNavigateToCommand?: (id: string) => void;
}

const AtendimentosView: React.FC<AtendimentosViewProps> = ({ onAddTransaction, onNavigateToCommand }) => {
    const { user, loading: authLoading } = useAuth(); 
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [periodType, setPeriodType] = useState<'Dia' | 'Semana' | 'Mês' | 'Lista'>('Dia');
    const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block' | 'sale'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [isJaciBotOpen, setIsJaciBotOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, time: Date, professional: LegacyProfessional } | null>(null);

    const [pendingConflict, setPendingConflict] = useState<{ newApp: LegacyAppointment, conflictWith: any } | null>(null);
    const [viewMode, setViewMode] = useState<'profissional' | 'andamento' | 'pagamento'>('profissional');
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [colWidth, setColWidth] = useState(220);
    const [isAutoWidth, setIsAutoWidth] = useState(false);
    const [timeSlot, setTimeSlot] = useState(30);

    const isMounted = useRef(true);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const gridScrollRef = useRef<HTMLDivElement>(null); 
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastRequestId = useRef(0);

    // --- LEITURA OBRIGATÓRIA DA VIEW PARA EVITAR ERRO 400 ---
    const fetchAppointments = async () => {
        if (!isMounted.current || authLoading || !user) return;
        
        const requestId = ++lastRequestId.current;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        setIsLoadingData(true);

        try {
            let rangeStart: Date, rangeEnd: Date;
            if (periodType === 'Semana') {
                rangeStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else if (periodType === 'Mês') {
                rangeStart = startOfMonth(currentDate);
                rangeEnd = endOfMonth(currentDate);
            } else {
                rangeStart = startOfDay(currentDate);
                rangeEnd = endOfDay(currentDate);
            }

            // Mudança Crítica: Sempre ler de vw_agenda_completa (View que resolve nomes)
            const [apptRes, blocksRes] = await Promise.all([
                supabase
                    .from('vw_agenda_completa') 
                    .select('*')
                    .gte('date', rangeStart.toISOString())
                    .lte('date', rangeEnd.toISOString())
                    .neq('status', 'cancelado') 
                    .abortSignal(abortControllerRef.current.signal),
                supabase
                    .from('schedule_blocks')
                    .select('*')
                    .gte('start_time', rangeStart.toISOString())
                    .lte('start_time', rangeEnd.toISOString())
                    .abortSignal(abortControllerRef.current.signal)
            ]);

            if (apptRes.error) throw apptRes.error;
            if (blocksRes.error) throw blocksRes.error;

            if (isMounted.current && requestId === lastRequestId.current) {
                const mappedAppts = (apptRes.data || []).map(row => ({
                    ...mapRowToAppointment(row),
                    type: 'appointment'
                }));

                const mappedBlocks = (blocksRes.data || []).map(row => ({
                    id: row.id,
                    start: new Date(row.start_time),
                    end: new Date(row.end_time),
                    professional: { id: row.professional_id }, 
                    service: { name: row.reason, color: '#fca5a5' },
                    status: 'bloqueado',
                    type: 'block'
                }));

                setAppointments([...mappedAppts, ...mappedBlocks]);
            }
        } catch (e: any) { 
            if (e.name !== 'AbortError') {
                console.error("Fetch Agenda Error:", e);
                setToast({ message: "Erro de sincronização. View indisponível.", type: 'error' });
            }
        } finally { 
            if (isMounted.current) setIsLoadingData(false); 
        }
    };

    const fetchResources = async () => {
        if (authLoading || !user) return;
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select('id, name, photo_url, role, active, show_in_calendar, order_index, services_enabled') 
                .eq('active', true)
                .order('order_index', { ascending: true }) 
                .order('name', { ascending: true });
            if (error) throw error;
            if (data && isMounted.current) {
                const mapped = data.filter((m: any) => m.show_in_calendar !== false).map((p: any) => ({
                    id: p.id, name: p.name, avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                    role: p.role, order_index: p.order_index || 0, services_enabled: p.services_enabled || [] 
                }));
                setResources(mapped);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (!authLoading && user && resources.length > 0) {
            fetchAppointments();
        }
    }, [currentDate, periodType, resources, user, authLoading]);

    useEffect(() => {
        isMounted.current = true;
        fetchResources();
        
        const channel = supabase.channel('agenda-live-view')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { if (isMounted.current) fetchAppointments(); })
            .subscribe();

        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
            supabase.removeChannel(channel).catch(console.error);
        };
    }, []);

    // Mapeamento Simplificado: A View já fornece nomes prontos
    const mapRowToAppointment = (row: any): LegacyAppointment => {
        const start = new Date(row.date);
        const dur = row.duration || 30;

        return {
            id: row.id, 
            start, 
            end: new Date(start.getTime() + dur * 60000), 
            status: row.status as AppointmentStatus,
            notas: row.notes || '', 
            origem: row.origin || 'agenda',
            client: { 
                id: row.client_id, 
                nome: row.client_name || 'Cliente', 
                consent: true 
            },
            professional: { 
                id: row.professional_id, 
                name: row.professional_name || 'Profissional', 
                avatarUrl: '' 
            },
            service: { 
                id: row.service_id, 
                name: row.service_name || 'Serviço', 
                price: Number(row.value || 0), 
                duration: dur, 
                color: row.service_color || '#3b82f6' 
            }
        } as LegacyAppointment;
    };

    // Escrita ESTRITA na tabela appointments (A View é somente leitura)
    const handleSaveAppointment = async (app: LegacyAppointment, force: boolean = false) => {
        setIsLoadingData(true);
        try {
            if (!force) {
                // Checagem de conflito via tabela base
                const { data: existingOnDay } = await supabase
                    .from('appointments')
                    .select('id, date, duration')
                    .eq('professional_id', app.professional.id)
                    .neq('status', 'cancelado')
                    .gte('date', startOfDay(app.start).toISOString())
                    .lte('date', endOfDay(app.start).toISOString());
                
                const conflict = existingOnDay?.find(row => {
                    if (app.id && row.id === app.id) return false;
                    return (app.start < addMinutes(new Date(row.date), row.duration || 30)) && (app.end > new Date(row.date));
                });
                if (conflict) { 
                    setPendingConflict({ newApp: app, conflictWith: conflict }); 
                    setIsLoadingData(false); 
                    return; 
                }
            }

            // Payload Sanitizado: Apenas IDs e primitivos para a tabela base
            const payload = {
                date: new Date(app.start).toISOString(),
                status: app.status || 'scheduled',
                notes: app.notas || '',
                origin: 'agenda',
                client_id: Number(app.client?.id),
                service_id: Number(app.service.id),
                professional_id: String(app.professional.id),
                value: Number(app.service.price),
                duration: Number(app.service.duration)
            };
            
            let res;
            if (app.id && appointments.some(a => a.id === app.id)) {
                res = await supabase.from('appointments').update(payload).eq('id', app.id);
            } else {
                res = await supabase.from('appointments').insert([payload]);
            }

            if (res.error) throw res.error;

            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null); 
            setPendingConflict(null);
            fetchAppointments(); // Refresh via View
        } catch (e: any) { 
            console.error("Save error:", e);
            setToast({ message: `Erro ao salvar. Verifique se o cliente e serviço estão cadastrados.`, type: 'error' }); 
        } finally { setIsLoadingData(false); }
    };

    const handleDeleteBlock = async (e: React.MouseEvent, blockId: string | number) => {
        e.stopPropagation();
        if (!window.confirm("Remover este bloqueio?")) return;
        try {
            const { error } = await supabase.from('schedule_blocks').delete().eq('id', blockId);
            if (error) throw error;
            fetchAppointments();
            setToast({ message: 'Horário liberado!', type: 'info' });
        } catch (e: any) {
            setToast({ message: 'Erro ao remover bloqueio.', type: 'error' });
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: AppointmentStatus) => {
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        if (!error) fetchAppointments();
        setActiveAppointmentDetail(null);
    };

    const handleDateChange = (direction: number) => {
        if (periodType === 'Dia' || periodType === 'Lista') setCurrentDate(prev => addDays(prev, direction));
        else if (periodType === 'Semana') setCurrentDate(prev => addWeeks(prev, direction));
        else if (periodType === 'Mês') setCurrentDate(prev => addMonths(prev, direction));
    };

    const columns = useMemo(() => {
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end: endOfWeek(currentDate, { weekStartsOn: 1 }) }).map(day => ({ id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), subtitle: format(day, 'dd/MM'), type: 'date' as const, data: day }));
        }
        return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional' as const, data: p }));
    }, [periodType, currentDate, resources]);

    const filteredAppointments = useMemo(() => {
        let baseList = appointments.filter(a => {
            if (periodType === 'Dia' || periodType === 'Lista') return isSameDay(a.start, currentDate);
            if (periodType === 'Semana') return isWithinInterval(a.start, { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) });
            return isSameMonth(a.start, currentDate);
        });
        return [...baseList].sort((a, b) => (STATUS_PRIORITY[a.status] || 99) - (STATUS_PRIORITY[b.status] || 99) || a.start.getTime() - b.start.getTime());
    }, [appointments, periodType, currentDate]);

    const timeSlotsLabels = useMemo(() => {
        const labels = [];
        for (let i = 0; i < (END_HOUR - START_HOUR) * 60 / timeSlot; i++) {
            const minutes = i * timeSlot;
            labels.push(`${String(START_HOUR + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
        }
        return labels;
    }, [timeSlot]);

    const handleGridClick = (e: React.MouseEvent, professional: LegacyProfessional, colDate?: Date) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const minutes = ((e.clientY - rect.top) / (SLOT_PX_HEIGHT / timeSlot));
        const targetDate = new Date(colDate || currentDate);
        targetDate.setHours(Math.floor((START_HOUR * 60 + minutes) / 60), Math.round((START_HOUR * 60 + minutes) % 60 / 15) * 15, 0, 0);
        setSelectionMenu({ x: e.clientX, y: e.clientY, time: targetDate, professional });
    };

    return (
        <div className="flex h-full bg-white relative flex-col font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Agenda {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}</h2>
                        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button onClick={() => setViewMode('profissional')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'profissional' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={14} /> Equipe</button>
                            <button onClick={() => setViewMode('andamento')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'andamento' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}><PlayCircle size={14} /> Andamento</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                        <button onClick={() => setIsPeriodModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">{periodType} <ChevronDown size={16} /></button>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all active:scale-95">Agendar</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">HOJE</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={20} /></button>
                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-bold text-lg capitalize tracking-tight">{format(currentDate, "EEE, dd 'de' MMMM", { locale: pt })}</span>
                </div>
            </header>

            <div ref={gridScrollRef} className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
                <div className="min-w-fit">
                    <div className="grid sticky top-0 z-[50] border-b border-slate-200 bg-white shadow-sm" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-[60] bg-white border-r border-slate-200 h-24 min-w-[60px] flex items-center justify-center"><Maximize2 size={16} className="text-slate-300" /></div>
                        {columns.map((col) => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24 bg-white relative group">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-[200px] overflow-hidden">
                                    {(col as any).photo && <img src={(col as any).photo} alt={col.title} className="w-8 h-8 rounded-full object-cover border border-orange-100" />}
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[11px] font-black text-slate-800 leading-tight truncate">{col.title}</span>
                                        {(col as any).subtitle && <span className="text-[9px] text-slate-400 font-bold uppercase">{ (col as any).subtitle}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-[50] bg-white border-r border-slate-200 min-w-[60px]">
                            {timeSlotsLabels.map(time => (
                                <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                    <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                </div>
                            ))}
                        </div>

                        {columns.map((col, idx) => (
                            <div key={col.id} className={`relative border-r border-slate-200 cursor-crosshair ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/[0.03]'}`} style={{ minHeight: `${timeSlotsLabels.length * SLOT_PX_HEIGHT}px` }} onClick={(e) => { if (e.target === e.currentTarget) handleGridClick(e, col.type === 'professional' ? (col.data as LegacyProfessional) : resources[0], col.type === 'date' ? (col.data as Date) : currentDate); }}>
                                {timeSlotsLabels.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed pointer-events-none"></div>)}
                                {filteredAppointments.filter(app => periodType === 'Semana' ? isSameDay(app.start, col.data as Date) : String(app.professional.id) === String(col.id)).map(app => (
                                    <div key={app.id} ref={(el) => { if (el && app.type === 'appointment') appointmentRefs.current.set(app.id, el); }} onClick={(e) => { e.stopPropagation(); if (app.type === 'appointment') setActiveAppointmentDetail(app); }} className={getCardStyle(app)} style={{ ...getAppointmentPosition(app.start, app.end, timeSlot), borderLeftColor: app.type === 'block' ? '#f87171' : (app.service.color || '#3b82f6'), backgroundColor: `${app.service.color || '#3b82f6'}15` }}>
                                        <div className="absolute top-1 right-1 flex gap-0.5">
                                            {app.status === 'concluido' && <DollarSign size={10} className="text-emerald-600" strokeWidth={3} />}
                                            {['confirmado', 'confirmado_whatsapp'].includes(app.status) && <CheckCircle size={10} className="text-blue-600" strokeWidth={3} />}
                                        </div>
                                        <div className="flex flex-col h-full justify-between relative z-0 pointer-events-none">
                                            <div>
                                                <p className="text-[10px] font-medium text-slate-500 leading-none mb-0.5">{format(app.start, 'HH:mm')}</p>
                                                <p className="text-xs font-bold text-slate-800 truncate leading-tight">{app.type === 'block' ? 'INDISPONÍVEL' : (app.client?.nome || 'Bloqueado')}</p>
                                            </div>
                                            {(app.end.getTime() - app.start.getTime()) / 60000 > 25 && <p className="text-[10px] text-slate-500 truncate leading-none mt-auto opacity-80">{app.service.name}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        <TimelineIndicator timeSlot={timeSlot} />
                    </div>
                </div>
            </div>

            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={() => handleDeleteBlock(null as any, activeAppointmentDetail.id)} 
                    onUpdateStatus={handleUpdateStatus}
                />
            )}
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
            {isPeriodModalOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPeriodModalOpen(false)}></div><div className="relative w-full max-w-xs bg-white rounded-[32px] p-4 animate-in zoom-in-95">{['Dia', 'Semana', 'Mês', 'Lista'].map((item) => (<button key={item} onClick={() => { setPeriodType(item as any); setIsPeriodModalOpen(false); }} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold ${periodType === item ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'}`}>{item}{periodType === item && <Check size={18} />}</button>))}</div></div>}
            {pendingConflict && <ConflictAlertModal newApp={pendingConflict.newApp} conflictApp={pendingConflict.conflictWith} onConfirm={() => handleSaveAppointment(pendingConflict.newApp, true)} onCancel={() => setPendingConflict(null)} />}
        </div>
    );
};

export default AtendimentosView;
