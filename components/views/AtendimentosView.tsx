
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    ShoppingBag, Ban, Maximize2, 
    LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, Clock,
    AlertTriangle, CalendarDays, DollarSign, CheckCircle, Trash2, ShieldAlert, CheckCircle2, ArrowRight, ShoppingCart, User, Plus
} from 'lucide-react';
import { 
    format, addDays, addWeeks, addMonths, eachDayOfInterval, 
    isSameDay, isWithinInterval, isSameMonth, addMinutes, 
    endOfDay, endOfWeek, endOfMonth 
} from 'date-fns';
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
import { useStudio } from '../../contexts/StudioContext';

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

const getAppointmentPosition = (start: Date, end: Date, timeSlot: number) => {
    const pixelsPerMinute = SLOT_PX_HEIGHT / timeSlot;
    const startMinutesSinceDayStart = (start.getHours() * 60 + start.getMinutes()) - (START_HOUR * 60);
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    const top = Math.floor(startMinutesSinceDayStart * pixelsPerMinute);
    const height = Math.max(20, Math.floor(durationMinutes * pixelsPerMinute));
    return { position: 'absolute' as const, top: `${top}px`, height: `${height}px`, width: '100%', zIndex: 20, left: '0px' };
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
        return () => intervalId && clearInterval(intervalId);
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
    const { activeStudioId } = useStudio();
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
    
    const [viewMode, setViewMode] = useState<'profissional' | 'andamento' | 'pagamento'>('profissional');
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [colWidth, setColWidth] = useState(220);
    const [isAutoWidth, setIsAutoWidth] = useState(false);
    const [timeSlot, setTimeSlot] = useState(30);
    const isMounted = useRef(true);
    const appointmentRefs = useRef(new Map<number | string, HTMLDivElement | null>());
    const lastRequestId = useRef(0);

    const fetchAppointments = async () => {
        if (!isMounted.current || authLoading || !user || !activeStudioId) return;
        const requestId = ++lastRequestId.current;
        setIsLoadingData(true);
        try {
            let rangeStart: Date, rangeEnd: Date;
            if (periodType === 'Semana') {
                rangeStart = new Date(currentDate);
                const day = rangeStart.getDay();
                const diff = (day < 1 ? -6 : 1) - day;
                rangeStart.setDate(rangeStart.getDate() + diff);
                rangeStart.setHours(0, 0, 0, 0);
                rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else if (periodType === 'Mês') {
                rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
                rangeEnd = endOfMonth(currentDate);
            } else {
                rangeStart = new Date(currentDate);
                rangeStart.setHours(0, 0, 0, 0);
                rangeEnd = endOfDay(currentDate);
            }

            const { data: apptRes, error: apptErr } = await supabase
                .from('appointments')
                .select(`
                    *,
                    professional:team_members (
                        id, name, photo_url
                    )
                `)
                .eq('studio_id', activeStudioId)
                .gte('date', rangeStart.toISOString())
                .lte('date', rangeEnd.toISOString())
                .neq('status', 'cancelado')
                .order('date', { ascending: true });

            const { data: blocksRes, error: blocksErr } = await supabase
                .from('schedule_blocks')
                .select('*')
                .eq('studio_id', activeStudioId)
                .gte('start_time', rangeStart.toISOString())
                .lte('start_time', rangeEnd.toISOString());

            if (apptErr) throw apptErr;
            if (blocksErr) throw blocksErr;

            if (isMounted.current && requestId === lastRequestId.current) {
                const mappedAppts = (apptRes || []).map(row => ({ ...mapRowToAppointment(row, resources), type: 'appointment' }));
                const mappedBlocks = (blocksRes || []).map(row => ({ 
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
            console.error("AtendimentosView Sync Failure:", e);
        } finally { 
            if (isMounted.current) setIsLoadingData(false); 
        }
    };

    const fetchResources = async () => {
        if (authLoading || !user || !activeStudioId) return;
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select('id, name, photo_url, role, active, show_in_calendar, order_index, services_enabled')
                .eq('active', true)
                .eq('studio_id', activeStudioId)
                .order('name', { ascending: true });
            
            if (error) throw error;
            if (data && isMounted.current) {
                const mapped = data.filter((m: any) => m.show_in_calendar !== false).map((p: any) => ({ 
                    id: p.id, 
                    name: p.name, 
                    avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`, 
                    role: p.role, 
                    order_index: p.order_index || 0, 
                    services_enabled: p.services_enabled || [] 
                }));
                setResources(mapped);
            }
        } catch (e) { 
            console.error("fetchResources Error:", e);
        }
    };

    const mapRowToAppointment = (row: any, professionalsList: LegacyProfessional[]): LegacyAppointment => {
        const start = new Date(row.date);
        const dur = row.duration || 30;
        let prof = professionalsList.find(p => String(p.id) === String(row.professional_id));
        return { 
            id: row.id, 
            start, 
            end: new Date(start.getTime() + dur * 60000), 
            status: row.status as AppointmentStatus, 
            notas: row.notes || '', 
            origem: row.origem || 'interno', 
            client: { id: row.client_id, nome: row.client_name || 'Cliente', consent: true }, 
            professional: prof || { id: row.professional_id, name: row.professional_name || 'S/ Prof', avatarUrl: '' }, 
            service: { id: row.service_id, name: row.service_name, price: Number(row.value), duration: dur, color: row.status === 'bloqueado' ? '#64748b' : (row.service_color || '#3b82f6') } 
        } as LegacyAppointment;
    };

    useEffect(() => {
        isMounted.current = true;
        fetchResources();
        
        const channel = supabase.channel(`agenda-realtime-${activeStudioId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `studio_id=eq.${activeStudioId}` }, () => { fetchAppointments(); })
            .subscribe();

        return () => { 
            isMounted.current = false; 
            supabase.removeChannel(channel); 
        };
    }, [activeStudioId]);

    useEffect(() => { 
        if (!authLoading && user && resources.length > 0) fetchAppointments(); 
    }, [currentDate, periodType, resources, activeStudioId]);

    const handleUpdateStatus = async (id: number | string, newStatus: AppointmentStatus) => {
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        if (!error) {
            setToast({ message: "Agenda atualizada!", type: 'success' });
            fetchAppointments();
        }
        setActiveAppointmentDetail(null);
    };

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        if (!activeStudioId) return;
        setIsLoadingData(true);
        try {
            const payload = { 
                studio_id: activeStudioId, 
                client_id: app.client?.id, 
                client_name: app.client?.nome, 
                professional_id: app.professional.id, 
                professional_name: app.professional.name, 
                service_name: app.service.name, 
                value: app.service.price, 
                duration: app.service.duration, 
                date: app.start.toISOString(), 
                status: app.status, 
                notes: app.notas, 
                origem: app.origem || 'interno' 
            };
            
            const { error } = app.id && appointments.some(a => a.id === app.id)
                ? await supabase.from('appointments').update(payload).eq('id', app.id)
                : await supabase.from('appointments').insert([payload]);

            if (error) throw error;
            
            // ✅ OBJETIVO A: Sincronização obrigatória e aguardada
            await fetchAppointments();
            
            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null);
        } catch (e: any) { 
            setToast({ message: "Erro ao salvar agendamento.", type: 'error' });
        } finally { 
            setIsLoadingData(false); 
        }
    };

    const handleDateChange = (direction: number) => {
        if (periodType === 'Dia' || periodType === 'Lista') setCurrentDate(prev => addDays(prev, direction));
        else if (periodType === 'Semana') setCurrentDate(prev => addWeeks(prev, direction));
        else if (periodType === 'Mês') setCurrentDate(prev => addMonths(prev, direction));
    };

    const columns = useMemo(() => {
        if (periodType === 'Semana') {
            const start = new Date(currentDate); const day = start.getDay(); const diff = (day < 1 ? -6 : 1) - day;
            start.setDate(start.getDate() + diff); start.setHours(0, 0, 0, 0);
            return eachDayOfInterval({ start, end: endOfWeek(currentDate, { weekStartsOn: 1 }) }).map(day => ({ id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), subtitle: format(day, 'dd/MM'), type: 'date' as const, data: day }));
        }
        return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional' as const, data: p }));
    }, [periodType, currentDate, resources]);

    const filteredAppointments = useMemo(() => {
        let baseList = appointments.filter(a => {
            if (periodType === 'Dia' || periodType === 'Lista') return isSameDay(a.start, currentDate);
            if (periodType === 'Semana') {
                const start = new Date(currentDate); const day = start.getDay(); const diff = (day < 1 ? -6 : 1) - day;
                start.setDate(start.getDate() + diff); start.setHours(0, 0, 0, 0);
                return isWithinInterval(a.start, { start, end: endOfWeek(currentDate, { weekStartsOn: 1 }) });
            }
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

    const handleGridClick = (col: any, timeIdx: number, e: React.MouseEvent) => {
        // ✅ OBJETIVO B: Handler de clique na grade
        const minutesToAdd = timeIdx * timeSlot;
        const baseDate = periodType === 'Semana' ? new Date(col.data) : new Date(currentDate);
        baseDate.setHours(START_HOUR, 0, 0, 0);
        const targetTime = addMinutes(baseDate, minutesToAdd);
        
        setSelectionMenu({
            x: e.clientX,
            y: e.clientY,
            time: targetTime,
            professional: col.type === 'professional' ? col.data : resources[0]
        });
    };

    return (
        <div className="h-full bg-white relative flex-col font-sans text-left overflow-hidden flex">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Radar de Atendimento {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />}</h2>
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                        <button onClick={() => setIsConfigModalOpen(true)} className="p-2 rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 transition-all"><SlidersHorizontal size={20} /></button>
                        <button onClick={() => setIsPeriodModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">{periodType} <ChevronDown size={16} /></button>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all active:scale-95">Novo Horário</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest text-xs">Hoje</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={20} /></button>
                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-black text-lg capitalize tracking-tight">{format(currentDate, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar" onClick={() => setSelectionMenu(null)}>
                <div className="min-w-fit">
                    <div className="grid sticky top-0 z-[50] border-b border-slate-200 bg-white shadow-sm" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-[60] bg-white border-r border-slate-200 h-24 min-w-[60px] flex items-center justify-center"><Maximize2 size={16} className="text-slate-300" /></div>
                        {columns.map((col) => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24 bg-white relative transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-[200px] overflow-hidden">
                                    {(col as any).photo && <img src={(col as any).photo} alt={col.title} className="w-8 h-8 rounded-full object-cover border border-orange-100 flex-shrink-0" />}
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[11px] font-black text-slate-800 truncate">{col.title}</span>
                                        {(col as any).subtitle && <span className="text-[9px] text-slate-400 font-bold uppercase">{ (col as any).subtitle}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-[50] bg-white border-r border-slate-200 min-w-[60px] shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
                            {timeSlotsLabels.map(time => (
                                <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                    <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                </div>
                            ))}
                        </div>
                        {columns.map((col, idx) => (
                            <div key={col.id} className={`relative border-r border-slate-200 cursor-crosshair ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/[0.03]'}`} style={{ minHeight: `${timeSlotsLabels.length * SLOT_PX_HEIGHT}px` }}>
                                {timeSlotsLabels.map((_, i) => (
                                    <div 
                                        key={i} 
                                        onClick={(e) => handleGridClick(col, i, e)}
                                        className="h-20 border-b border-slate-100/50 border-dashed hover:bg-orange-500/5 transition-colors"
                                    ></div>
                                ))}
                                {filteredAppointments.filter(app => { 
                                    if (periodType === 'Semana') return isSameDay(app.start, col.data as Date); 
                                    return app.professional && String(app.professional?.id) === String(col.id); 
                                }).map(app => {
                                    const cardColor = app.type === 'block' ? '#f87171' : (app.service?.color || '#3b82f6');
                                    return (
                                        <div key={app.id} ref={(el) => { if (el && app.type === 'appointment') appointmentRefs.current.set(app.id, el); }} onClick={(e) => { e.stopPropagation(); if (app.type === 'appointment') { setActiveAppointmentDetail(app); } }} className="rounded-none shadow-sm border-l-4 p-1.5 cursor-pointer hover:brightness-95 transition-all overflow-hidden flex flex-col group/card !m-0 border-r border-b border-slate-200/50 animate-in fade-in" style={{ ...getAppointmentPosition(app.start, app.end, timeSlot), borderLeftColor: cardColor, backgroundColor: `${cardColor}15` }}>
                                            <div className="absolute top-1 right-1 flex gap-0.5 z-10">
                                                {app.status === 'concluido' && <DollarSign size={10} className="text-emerald-600 font-bold" strokeWidth={3} />}
                                                {['confirmado', 'confirmado_whatsapp'].includes(app.status) && <CheckCircle size={10} className="text-blue-600" strokeWidth={3} />}
                                            </div>
                                            <div className="flex flex-col h-full justify-between relative z-0 pointer-events-none">
                                                <div><p className="text-[10px] font-medium text-slate-500 leading-none mb-0.5">{format(app.start, 'HH:mm')}</p><p className="text-xs font-bold text-slate-800 truncate leading-tight">{app.type === 'block' ? 'INDISPONÍVEL' : (app.client?.nome || 'Bloqueado')}</p></div>
                                                <p className="text-[10px] text-slate-500 truncate leading-none mt-auto opacity-80">{app.service?.name}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        <TimelineIndicator timeSlot={timeSlot} />
                    </div>
                </div>

                {/* MENU DE SELEÇÃO CONTEXTUAL (Aesthetics: BelaApp) */}
                {selectionMenu && (
                    <div 
                        className="fixed z-[100] bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 min-w-[200px] animate-in zoom-in-95 duration-200"
                        style={{ top: selectionMenu.y, left: selectionMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-2 border-b border-slate-50 mb-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Escolher Ação</p>
                            <p className="text-xs font-bold text-slate-700">{format(selectionMenu.time, 'HH:mm')} • {selectionMenu.professional.name.split(' ')[0]}</p>
                        </div>
                        <button 
                            onClick={() => { setModalState({ type: 'appointment', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 rounded-2xl transition-all"
                        >
                            <CalendarIcon size={18} /> Novo Agendamento
                        </button>
                        <button 
                            onClick={() => { setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all"
                        >
                            <Ban size={18} /> Bloquear Horário
                        </button>
                    </div>
                )}
            </div>

            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={async (id) => { if(confirm("Apagar horário?")) { await supabase.from('appointments').delete().eq('id', id); fetchAppointments(); setActiveAppointmentDetail(null); } }} 
                    onUpdateStatus={handleUpdateStatus}
                />
            )}
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
        </div>
    );
};

export default AtendimentosView;
