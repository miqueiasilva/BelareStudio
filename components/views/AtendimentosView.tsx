
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    ShoppingBag, Ban, Settings as SettingsIcon, Maximize2, 
    LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, Clock
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

import { LegacyAppointment, AppointmentStatus, FinancialTransaction, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
import BlockTimeModal from '../modals/BlockTimeModal';
import NewTransactionModal from '../modals/NewTransactionModal';
import JaciBotPanel from '../JaciBotPanel';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';

const START_HOUR = 8;
const END_HOUR = 20; 
const PIXELS_PER_MINUTE = 80 / 60; 

interface DynamicColumn {
    id: string | number;
    title: string;
    subtitle?: string;
    photo?: string; 
    type: 'professional' | 'status' | 'payment' | 'date';
    data?: LegacyProfessional | Date; 
}

const getAppointmentPosition = (start: Date, end: Date) => {
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const top = (startMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE;
    const height = (endMinutes - startMinutes) * PIXELS_PER_MINUTE;
    return { top: `${top}px`, height: `${height - 2}px` };
};

const getCardStyle = (app: LegacyAppointment, viewMode: 'profissional' | 'andamento' | 'pagamento') => {
    const baseClasses = "absolute left-0 right-0 mx-1 rounded-md shadow-sm border border-l-4 p-1.5 cursor-pointer z-10 hover:brightness-95 transition-all overflow-hidden flex flex-col";
    
    if (viewMode === 'pagamento') {
        const isPaid = app.status === 'concluido'; 
        if (isPaid) return `${baseClasses} bg-emerald-50 border-emerald-500 text-emerald-900`;
        return `${baseClasses} bg-rose-50 border-rose-500 text-rose-900`;
    }

    if (viewMode === 'andamento') {
        switch (app.status) {
            case 'concluido': return `${baseClasses} bg-green-100 border-green-600 text-green-900`;
            case 'cancelado': return `${baseClasses} bg-red-100 border-red-600 text-red-900 opacity-60`;
            case 'faltou': return `${baseClasses} bg-orange-100 border-orange-600 text-orange-900`;
            case 'confirmado':
            case 'confirmado_whatsapp': return `${baseClasses} bg-blue-100 border-blue-600 text-blue-900`;
            case 'em_atendimento': return `${baseClasses} bg-indigo-100 border-indigo-600 text-indigo-900 animate-pulse`;
            default: return `${baseClasses} bg-slate-100 border-slate-400 text-slate-700`;
        }
    }

    switch (app.status) {
        case 'concluido': return `${baseClasses} bg-green-50 border-green-200 text-green-900`;
        case 'bloqueado': return `${baseClasses} bg-slate-100 border-slate-300 text-slate-500 opacity-80`;
        case 'confirmado': return `${baseClasses} bg-cyan-50 border-cyan-200 text-cyan-900`;
        case 'confirmado_whatsapp': return `${baseClasses} bg-teal-50 border-teal-200 text-teal-900`;
        case 'chegou': return `${baseClasses} bg-purple-50 border-purple-200 text-purple-900`;
        case 'em_atendimento': return `${baseClasses} bg-indigo-50 border-indigo-200 text-indigo-900 animate-pulse`;
        case 'faltou': return `${baseClasses} bg-orange-50 border-orange-200 text-orange-900`;
        case 'cancelado': return `${baseClasses} bg-rose-50 border-rose-200 text-rose-800 opacity-60`;
        case 'em_espera': return `${baseClasses} bg-stone-50 border-stone-200 text-stone-900`;
        default: return `${baseClasses} bg-blue-50 border-blue-200 text-blue-900`;
    }
}

const TimelineIndicator = () => {
    const [topPosition, setTopPosition] = useState(0);
    useEffect(() => {
        const calculatePosition = () => {
            const now = new Date();
            const startOfDayMinutes = START_HOUR * 60;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (nowMinutes < startOfDayMinutes || nowMinutes > END_HOUR * 60) {
                setTopPosition(-1); return;
            }
            const top = (nowMinutes - startOfDayMinutes) * PIXELS_PER_MINUTE;
            setTopPosition(top);
        };
        calculatePosition();
        const intervalId = setInterval(calculatePosition, 60000); 
        return () => clearInterval(intervalId);
    }, []);
    if (topPosition < 0) return null;
    return (
        <div className="absolute w-full z-10 pointer-events-none" style={{ top: `${topPosition}px` }}>
            <div className="h-px bg-red-500 w-full relative">
                <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm"></div>
            </div>
        </div>
    );
};

interface AtendimentosViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

type PeriodType = 'Dia' | 'Semana' | 'Mês' | 'Lista';
type ViewMode = 'profissional' | 'andamento' | 'pagamento';

const AtendimentosView: React.FC<AtendimentosViewProps> = ({ onAddTransaction }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [orderedProfessionals, setOrderedProfessionals] = useState<LegacyProfessional[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [periodType, setPeriodType] = useState<PeriodType>('Dia');
    const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block' | 'sale'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [isJaciBotOpen, setIsJaciBotOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, time: Date, professional: LegacyProfessional } | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>('profissional');
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [colWidth, setColWidth] = useState(220);
    const [isAutoWidth, setIsAutoWidth] = useState(false);
    const [timeSlot, setTimeSlot] = useState(30);

    const isMounted = useRef(true);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        isMounted.current = true;
        fetchResources();
        const channel = supabase.channel('agenda-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                if (isMounted.current) fetchAppointments();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'professionals' }, () => {
                if (isMounted.current) fetchResources();
            })
            .subscribe();
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (resources.length > 0) {
            setOrderedProfessionals(resources);
        }
    }, [resources]);

    const fetchResources = async () => {
        try {
            // Seleciona incluindo order_index e ordena por ele
            const { data, error } = await supabase
                .from('professionals')
                .select('id, name, photo_url, role, order_index')
                .order('order_index', { ascending: true });

            if (error) throw error;
            if (data && isMounted.current) {
                const mapped = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                    role: p.role,
                    order_index: p.order_index // Mantemos no objeto para facilitar a troca
                }));
                setResources(mapped);
            }
        } catch (e) { console.error("Error resources:", e); }
    };

    const fetchAppointments = async () => {
        if (!isMounted.current) return;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase.from('appointments').select('*').abortSignal(abortControllerRef.current.signal);
            if (error) throw error;
            if (data && isMounted.current) {
                const mapped = data.map(row => {
                    const start = new Date(row.date);
                    const dur = row.duration || 30;
                    return {
                        id: row.id,
                        start,
                        end: new Date(start.getTime() + dur * 60000),
                        status: row.status as AppointmentStatus,
                        notas: row.notes || '',
                        client: { id: 0, nome: row.client_name || 'Cliente', consent: true },
                        professional: resources.find(p => p.id === Number(row.resource_id)) || { id: 0, name: row.professional_name, avatarUrl: '' },
                        service: { id: 0, name: row.service_name, price: Number(row.value), duration: dur, color: row.status === 'bloqueado' ? '#64748b' : '#3b82f6' }
                    } as LegacyAppointment;
                });
                setAppointments(mapped);
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Fetch error:", e);
        } finally { if (isMounted.current) setIsLoadingData(false); }
    };

    const persistProfessionalOrder = async (pA: any, pB: any) => {
        try {
            // Upsert dos dois registros com os índices trocados
            const { error } = await supabase
                .from('professionals')
                .upsert([
                    { id: pA.id, order_index: pA.order_index },
                    { id: pB.id, order_index: pB.order_index }
                ]);
            if (error) throw error;
        } catch (e) {
            console.error("Erro ao persistir ordem:", e);
            setToast({ message: 'Erro ao salvar ordem no servidor.', type: 'error' });
        }
    };

    const moverEsq = (index: number) => {
        if (index === 0) return;
        const newOrder = [...orderedProfessionals] as any[];
        
        // Elementos envolvidos
        const currentProf = { ...newOrder[index] };
        const neighborProf = { ...newOrder[index - 1] };

        // Troca os índices de ordenação
        const tempIndex = currentProf.order_index;
        currentProf.order_index = neighborProf.order_index;
        neighborProf.order_index = tempIndex;

        // Atualiza UI instantaneamente
        newOrder[index] = neighborProf;
        newOrder[index - 1] = currentProf;
        setOrderedProfessionals(newOrder);

        // Persiste no Banco
        persistProfessionalOrder(currentProf, neighborProf);
    };

    const moverDir = (index: number) => {
        if (index === orderedProfessionals.length - 1) return;
        const newOrder = [...orderedProfessionals] as any[];
        
        // Elementos envolvidos
        const currentProf = { ...newOrder[index] };
        const neighborProf = { ...newOrder[index + 1] };

        // Troca os índices de ordenação
        const tempIndex = currentProf.order_index;
        currentProf.order_index = neighborProf.order_index;
        neighborProf.order_index = tempIndex;

        // Atualiza UI instantaneamente
        newOrder[index] = neighborProf;
        newOrder[index + 1] = currentProf;
        setOrderedProfessionals(newOrder);

        // Persiste no Banco
        persistProfessionalOrder(currentProf, neighborProf);
    };

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        setIsLoadingData(true);
        try {
            const payload = {
                client_name: app.client?.nome, resource_id: app.professional.id, professional_name: app.professional.name,
                service_name: app.service.name, value: app.service.price, duration: app.service.duration,
                date: app.start.toISOString(), status: app.status, notes: app.notas, origem: 'interno'
            };
            if (app.id && appointments.some(a => a.id === app.id)) {
                const { error } = await supabase.from('appointments').update(payload).eq('id', app.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('appointments').insert([payload]);
                if (error) throw error;
            }
            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null);
            fetchAppointments();
        } catch (e: any) { setToast({ message: 'Erro ao salvar.', type: 'error' }); } finally { setIsLoadingData(false); }
    };

    const handleSaveBlock = async (block: LegacyAppointment) => {
        setIsLoadingData(true);
        try {
            const payload = {
                resource_id: block.professional.id, professional_name: block.professional.name, service_name: 'Bloqueio',
                value: 0, duration: block.service.duration, date: block.start.toISOString(), status: 'bloqueado', notes: block.notas, origem: 'interno'
            };
            const { error } = await supabase.from('appointments').insert([payload]);
            if (error) throw error;
            setToast({ message: 'Horário bloqueado!', type: 'info' });
            setModalState(null);
            fetchAppointments();
        } catch (e: any) { setToast({ message: 'Erro ao bloquear.', type: 'error' }); } finally { setIsLoadingData(false); }
    };

    useEffect(() => { if (resources.length > 0) fetchAppointments(); }, [resources, currentDate]);

    const handleDateChange = (direction: number) => {
        if (periodType === 'Dia' || periodType === 'Lista') setCurrentDate(prev => addDays(prev, direction));
        else if (periodType === 'Semana') setCurrentDate(prev => addWeeks(prev, direction));
        else if (periodType === 'Mês') setCurrentDate(prev => addMonths(prev, direction));
    };

    const columns = useMemo<DynamicColumn[]>(() => {
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end }).map(day => ({ 
                id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), 
                subtitle: format(day, 'dd/MM'), type: 'date', data: day 
            }));
        }
        return orderedProfessionals.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional', data: p }));
    }, [periodType, currentDate, orderedProfessionals]);

    const filteredAppointments = useMemo(() => {
        if (periodType === 'Dia' || periodType === 'Lista') return appointments.filter(a => isSameDay(a.start, currentDate));
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return appointments.filter(a => isWithinInterval(a.start, { start, end }));
        }
        if (periodType === 'Mês') return appointments.filter(a => isSameMonth(a.start, currentDate));
        return appointments;
    }, [appointments, periodType, currentDate]);

    const timeSlotsLabels = useMemo(() => {
        const labels = [];
        const totalMinutes = (END_HOUR - START_HOUR) * 60;
        const slotsCount = totalMinutes / timeSlot;
        for (let i = 0; i < slotsCount; i++) {
            const minutesFromStart = i * timeSlot;
            const hour = START_HOUR + Math.floor(minutesFromStart / 60);
            const min = minutesFromStart % 60;
            labels.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        }
        return labels;
    }, [timeSlot]);

    const handleGridClick = (e: React.MouseEvent, professional: LegacyProfessional, colDate?: Date) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const minutes = (offsetY / PIXELS_PER_MINUTE);
        const totalMinutesFromDayStart = (START_HOUR * 60) + minutes;
        const roundedMinutes = Math.round(totalMinutesFromDayStart / 15) * 15;
        const targetDate = new Date(colDate || currentDate);
        targetDate.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
        setSelectionMenu({ x: e.clientX, y: e.clientY, time: targetDate, professional });
    };

    return (
        <div className="flex h-full bg-white relative flex-col font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            Agenda {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
                        </h2>

                        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button 
                                onClick={() => setViewMode('profissional')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'profissional' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <LayoutGrid size={14} /> Equipe
                            </button>
                            <button 
                                onClick={() => setViewMode('andamento')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'andamento' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <PlayCircle size={14} /> Andamento
                            </button>
                            <button 
                                onClick={() => setViewMode('pagamento')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'pagamento' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <CreditCard size={14} /> Pagamento
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                        <button 
                            onClick={() => setIsConfigModalOpen(true)}
                            className="p-2 rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 transition-all"
                            title="Configurações de Exibição"
                        >
                            <SlidersHorizontal size={20} />
                        </button>

                        <button onClick={() => setIsPeriodModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
                            {periodType} <ChevronDown size={16} />
                        </button>
                        
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all active:scale-95">Agendar</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">HOJE</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-bold text-lg capitalize tracking-tight">{format(currentDate, "EEE, dd 'de' MMMM", { locale: pt }).replace('.', '')}</span>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
                <div className="min-w-fit">
                    {/* Header Grid */}
                    <div className="grid sticky top-0 z-40 border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-50 bg-white border-r border-slate-200 h-24 min-w-[60px] flex items-center justify-center shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
                            <Maximize2 size={16} className="text-slate-300" />
                        </div>
                        {columns.map((col, idx) => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24 bg-slate-50/10 relative group transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-[200px] overflow-hidden">
                                    {col.photo && <img src={col.photo} alt={col.title} className="w-8 h-8 rounded-full object-cover border border-orange-100 flex-shrink-0" />}
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[11px] font-black text-slate-800 leading-tight truncate">{col.title}</span>
                                        {col.subtitle && <span className="text-[9px] text-slate-400 font-bold uppercase">{col.subtitle}</span>}
                                    </div>
                                </div>
                                
                                {/* REORDER CONTROLS */}
                                {periodType === 'Dia' && col.type === 'professional' && (
                                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); moverEsq(idx); }}
                                            disabled={idx === 0}
                                            className="p-1 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-orange-500 disabled:opacity-30"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); moverDir(idx); }}
                                            disabled={idx === orderedProfessionals.length - 1}
                                            className="p-1 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-orange-500 disabled:opacity-30"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Main Grid Body */}
                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        {/* Time Column Sticky */}
                        <div className="sticky left-0 z-20 bg-white border-r border-slate-200 min-w-[60px] shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
                            {timeSlotsLabels.map(time => (
                                <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black pt-2 border-b border-slate-100/50 border-dashed bg-white">
                                    <span>{time}</span>
                                </div>
                            ))}
                        </div>
                        
                        {columns.map((col, idx) => (
                            <div 
                                key={col.id} 
                                className={`relative border-r border-slate-200 min-h-[1000px] cursor-crosshair ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/[0.03]'}`}
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) {
                                        const prof = col.type === 'professional' ? (col.data as LegacyProfessional) : resources[0];
                                        const date = col.type === 'date' ? (col.data as Date) : currentDate;
                                        handleGridClick(e, prof, date);
                                    }
                                }}
                            >
                                {timeSlotsLabels.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed pointer-events-none"></div>)}
                                {filteredAppointments.filter(app => (periodType === 'Semana' ? isSameDay(app.start, col.data as Date) : (app.professional.id === col.id || app.professional.name === col.title))).map(app => {
                                    const durationInMinutes = (app.end.getTime() - app.start.getTime()) / 60000;
                                    const isVeryShort = durationInMinutes <= 20;
                                    const isShort = durationInMinutes <= 35;

                                    return (
                                        <div
                                            key={app.id}
                                            ref={(el) => { if (el) appointmentRefs.current.set(app.id, el); }}
                                            onClick={(e) => { e.stopPropagation(); setActiveAppointmentDetail(app); }}
                                            title={`${format(app.start, 'HH:mm')} - ${app.client?.nome || 'Bloqueado'} (${app.service.name})`}
                                            className={getCardStyle(app, viewMode)}
                                            style={{ ...getAppointmentPosition(app.start, app.end), borderLeftColor: app.service.color }}
                                        >
                                            <div className="flex items-center gap-1 overflow-hidden">
                                                <span className="text-[9px] font-bold opacity-70 leading-none flex-shrink-0">{format(app.start, 'HH:mm')}</span>
                                                {isVeryShort && <span className="font-bold text-slate-900 text-[10px] truncate leading-none flex-1">{app.client?.nome || 'Bloqueado'}</span>}
                                            </div>
                                            {!isVeryShort && <p className="font-bold text-slate-900 text-[11px] truncate leading-tight mt-0.5">{app.client?.nome || 'Bloqueado'}</p>}
                                            {!isShort && <p className="text-[10px] font-medium text-slate-600 truncate leading-tight">{app.service.name}</p>}
                                            {viewMode === 'pagamento' && app.status === 'concluido' && (
                                                <div className="absolute top-1 right-1 text-emerald-600"><Check size={12} /></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        <TimelineIndicator />
                    </div>
                </div>
            </div>

            {/* Modals e Popovers... */}
            {isConfigModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsConfigModalOpen(false)}></div>
                    <div className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <header className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-extrabold text-slate-800">Aparência da Grade</h3>
                            <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                        </header>
                        <div className="p-8 space-y-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Largura das Colunas</label>
                                    <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-lg font-mono font-bold">{colWidth}px</span>
                                </div>
                                <input 
                                    type="range" min="150" max="450" step="10" 
                                    disabled={isAutoWidth}
                                    value={colWidth} onChange={e => setColWidth(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-30"
                                />
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" id="autoWidth" checked={isAutoWidth} onChange={e => setIsAutoWidth(e.target.checked)} className="w-5 h-5 rounded text-orange-500 border-slate-300 focus:ring-orange-500" />
                                    <label htmlFor="autoWidth" className="text-sm font-bold text-slate-600 cursor-pointer">Ajustar ao conteúdo</label>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider block">Intervalo de Tempo</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[15, 30, 60].map(min => (
                                        <button 
                                            key={min} onClick={() => { setTimeSlot(min); setIsConfigModalOpen(false); }}
                                            className={`py-3 rounded-2xl border-2 font-bold transition-all ${timeSlot === min ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}
                                        >
                                            {min} min
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <footer className="p-6 bg-slate-50 flex justify-end">
                            <button onClick={() => setIsConfigModalOpen(false)} className="px-8 py-3 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all">Fechar</button>
                        </footer>
                    </div>
                </div>
            )}

            {isPeriodModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPeriodModalOpen(false)}></div>
                    <div className="relative w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b bg-slate-50 font-extrabold text-slate-800 text-center">Visualizar por:</div>
                        <div className="p-4 space-y-2">
                            {['Dia', 'Semana', 'Mês', 'Lista'].map((item) => (
                                <button 
                                    key={item} 
                                    onClick={() => { setPeriodType(item as PeriodType); setIsPeriodModalOpen(false); }} 
                                    className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all ${periodType === item ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {item}
                                    {periodType === item && <Check size={18} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectionMenu && (
                <>
                    <div className="fixed inset-0 z-50" onClick={() => setSelectionMenu(null)} />
                    <div 
                        className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 w-64 py-2 animate-in fade-in zoom-in-95 duration-150"
                        style={{ top: Math.min(selectionMenu.y, window.innerHeight - 200), left: Math.min(selectionMenu.x, window.innerWidth - 260) }}
                    >
                        <button onClick={() => { setModalState({ type: 'appointment', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                            <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600"><CalendarIcon size={16} /></div> Novo Agendamento
                        </button>
                        <button onClick={() => { setModalState({ type: 'sale', data: { professionalId: selectionMenu.professional.id } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-green-50 hover:text-orange-600 transition-colors">
                            <div className="p-1.5 bg-green-100 rounded-lg text-green-600"><ShoppingBag size={16} /></div> Nova Venda
                        </button>
                        <button onClick={() => { setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-orange-600 transition-colors">
                            <div className="p-1.5 bg-rose-100 rounded-lg text-orange-600"><Ban size={16} /></div> Bloqueio
                        </button>
                    </div>
                </>
            )}

            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={async (id) => { 
                        setAppointments(prev => prev.filter(p => p.id !== id));
                        await supabase.from('appointments').delete().eq('id', id); 
                        setActiveAppointmentDetail(null);
                        setToast({ message: 'Agendamento removido.', type: 'info' });
                    }} 
                    onUpdateStatus={async (id, status) => { 
                        setAppointments(prev => prev.map(p => p.id === id ? { ...p, status } : p));
                        await supabase.from('appointments').update({ status }).eq('id', id); 
                        setActiveAppointmentDetail(null); 
                    }} 
                />
            )}

            {modalState?.type === 'appointment' && (
                <AppointmentModal 
                    appointment={modalState.data} 
                    onClose={() => setModalState(null)} 
                    onSave={handleSaveAppointment} 
                />
            )}

            {modalState?.type === 'block' && (
                <BlockTimeModal 
                    professional={modalState.data.professional} 
                    startTime={modalState.data.start} 
                    onClose={() => setModalState(null)} 
                    onSave={handleSaveBlock} 
                />
            )}

            {modalState?.type === 'sale' && (
                <NewTransactionModal 
                    type="receita"
                    onClose={() => setModalState(null)}
                    onSave={(t) => { onAddTransaction(t); setModalState(null); setToast({ message: 'Venda registrada!', type: 'success' }); }}
                />
            )}
            
            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
            <div className="fixed bottom-8 right-8 z-10"><button onClick={() => setIsJaciBotOpen(true)} className="w-16 h-16 bg-orange-500 rounded-3xl shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all"><MessageSquare className="w-8 h-8" /></button></div>
        </div>
    );
};

export default AtendimentosView;
