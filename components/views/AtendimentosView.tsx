
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
    endOfDay, endOfWeek, endOfMonth, startOfDay
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
    
    const [colWidth] = useState(220);
    const [timeSlot] = useState(30);
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
                rangeStart = startOfDay(addDays(currentDate, -(currentDate.getDay() || 7) + 1));
                rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else if (periodType === 'Mês') {
                rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
                rangeEnd = endOfMonth(currentDate);
            } else {
                rangeStart = startOfDay(currentDate);
                rangeEnd = addDays(rangeStart, 1); // Fim exclusivo (Início do próximo dia)
            }

            // ✅ OBJETIVO 2: Filtragem obrigatória por start_at para consistência total
            const { data: apptRes, error: apptErr } = await supabase
                .from('appointments')
                .select(`*, professional:team_members(id, name, photo_url)`)
                .eq('studio_id', activeStudioId)
                .gte('start_at', rangeStart.toISOString())
                .lt('start_at', rangeEnd.toISOString())
                .neq('status', 'cancelado')
                .order('start_at', { ascending: true });

            const { data: blocksRes, error: blocksErr } = await supabase
                .from('schedule_blocks')
                .select('*')
                .eq('studio_id', activeStudioId)
                .gte('start_time', rangeStart.toISOString())
                .lt('start_time', rangeEnd.toISOString());

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
            console.error("fetchAppointments Failure:", e);
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
                .eq('show_in_calendar', true)
                .eq('studio_id', activeStudioId)
                .order('order_index', { ascending: true });
            
            if (error) throw error;
            if (data && isMounted.current) {
                setResources(data.map((p: any) => ({ 
                    id: p.id, 
                    name: p.name, 
                    avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`, 
                    role: p.role, 
                    order_index: p.order_index || 0, 
                    services_enabled: p.services_enabled || [] 
                })));
            }
        } catch (e) { 
            console.error("fetchResources Error:", e);
        }
    };

    const mapRowToAppointment = (row: any, professionalsList: LegacyProfessional[]): LegacyAppointment => {
        const start = new Date(row.start_at || row.date);
        const dur = row.duration || 30;
        let prof = professionalsList.find(p => String(p.id) === String(row.professional_id));
        return { 
            id: row.id, 
            start, 
            end: new Date(start.getTime() + dur * 60000), 
            status: row.status as AppointmentStatus, 
            notas: row.notes || '', 
            client: { id: row.client_id, nome: row.client_name || 'Cliente', consent: true }, 
            professional: prof || { id: row.professional_id, name: row.professional_name || 'Profissional', avatarUrl: '' }, 
            service: { id: row.service_id, name: row.service_name, price: Number(row.value), duration: dur, color: row.status === 'bloqueado' ? '#64748b' : (row.service_color || '#3b82f6') } 
        } as LegacyAppointment;
    };

    useEffect(() => {
        isMounted.current = true;
        fetchResources();
        return () => { isMounted.current = false; };
    }, [activeStudioId]);

    useEffect(() => { 
        if (resources.length > 0) fetchAppointments(); 
    }, [currentDate, periodType, resources]);

    const handleUpdateStatus = async (id: number | string, newStatus: AppointmentStatus) => {
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        if (!error) {
            setToast({ message: "Status atualizado!", type: 'success' });
            fetchAppointments();
        }
    };

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        if (!activeStudioId) return;
        setIsLoadingData(true);
        try {
            const startAt = app.start;
            const endAt = new Date(startAt.getTime() + (app.service.duration || 30) * 60000);

            // ✅ OBJETIVO 1: Preencher obrigatoriamente start_at e end_at (ISO UTC)
            const payload = { 
                studio_id: activeStudioId, 
                client_id: app.client?.id, 
                client_name: app.client?.nome, 
                professional_id: app.professional.id, 
                professional_name: app.professional.name, 
                service_id: app.service.id,
                service_name: app.service.name, 
                value: app.service.price, 
                duration: app.service.duration, 
                date: startAt.toISOString(), 
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
                status: app.status || 'agendado', 
                notes: app.notas, 
                origem: app.origem || 'interno' 
            };
            
            const { data, error } = app.id && appointments.some(a => a.id === app.id)
                ? await supabase.from('appointments').update(payload).eq('id', app.id).select('id, start_at, end_at')
                : await supabase.from('appointments').insert([payload]).select('id, start_at, end_at');

            if (error) throw error;
            
            // ✅ OBJETIVO 3: Validar retorno e aguardar fetchAppointments antes de fechar
            if (!data?.[0]?.start_at || !data?.[0]?.end_at) {
                throw new Error("Agendamento salvo com campos de tempo nulos no banco.");
            }

            await fetchAppointments(); 
            setToast({ message: 'Agendamento salvo com sucesso!', type: 'success' });
            setModalState(null);
        } catch (e: any) { 
            setToast({ message: "Erro ao salvar: " + e.message, type: 'error' });
        } finally { 
            setIsLoadingData(false); 
        }
    };

    const moveProfessional = async (profId: string | number, direction: 'left' | 'right') => {
        const index = resources.findIndex(r => r.id === profId);
        if (index === -1) return;
        
        const targetIndex = direction === 'left' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= resources.length) return;

        const newResources = [...resources];
        const profA = newResources[index];
        const profB = newResources[targetIndex];

        // ✅ OBJETIVO 5: Swap persistido no banco
        const oldIndexA = profA.order_index || 0;
        const oldIndexB = profB.order_index || 0;

        profA.order_index = oldIndexB;
        profB.order_index = oldIndexA;

        setResources([...newResources].sort((a,b) => (a.order_index || 0) - (b.order_index || 0)));

        try {
            await Promise.all([
                supabase.from('team_members').update({ order_index: profA.order_index }).eq('id', profA.id),
                supabase.from('team_members').update({ order_index: profB.order_index }).eq('id', profB.id)
            ]);
        } catch (e) {
            fetchResources(); // Reverte em caso de falha
        }
    };

    const handleGridClick = (col: any, timeIdx: number, e: React.MouseEvent) => {
        // ✅ OBJETIVO 4: Garantir que o container receba clique e identifique professional/data
        e.stopPropagation();
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

    // FIX: Added missing 'columns' definition to manage columns dynamically based on periodType.
    const columns = useMemo(() => {
        if (periodType === 'Semana') {
            const start = startOfDay(addDays(currentDate, -(currentDate.getDay() || 7) + 1));
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end }).map(day => ({
                id: day.toISOString(),
                title: format(day, 'EEEE, dd/MM', { locale: pt }),
                data: day,
                type: 'day'
            }));
        }
        return resources.map(res => ({
            id: res.id,
            title: res.name,
            photo: res.avatarUrl,
            data: res,
            type: 'professional'
        }));
    }, [periodType, resources, currentDate]);

    // FIX: Added missing 'timeSlotsLabels' to generate the time axis labels for the grid.
    const timeSlotsLabels = useMemo(() => {
        const labels = [];
        for (let hour = START_HOUR; hour < END_HOUR; hour++) {
            labels.push(`${String(hour).padStart(2, '0')}:00`);
            labels.push(`${String(hour).padStart(2, '0')}:30`);
        }
        return labels;
    }, []);

    return (
        <div className="h-full bg-white relative flex-col font-sans text-left overflow-hidden flex">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Radar de Atendimento {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsPeriodModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">{periodType} <ChevronDown size={16} /></button>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all active:scale-95">Novo Horário</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">Hoje</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={20} /></button>
                        <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-black text-lg capitalize tracking-tight">{format(currentDate, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar" onClick={() => setSelectionMenu(null)}>
                <div className="min-w-fit">
                    <div className="grid sticky top-0 z-[50] border-b border-slate-200 bg-white shadow-sm" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${colWidth}px, 1fr))` }}>
                        <div className="sticky left-0 z-[60] bg-white border-r border-slate-200 h-24 min-w-[60px] flex items-center justify-center"><Maximize2 size={16} className="text-slate-300" /></div>
                        {columns.map((col) => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24 bg-white relative group/header">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-[200px] overflow-hidden">
                                    {(col as any).photo && <img src={(col as any).photo} className="w-8 h-8 rounded-full object-cover" />}
                                    <span className="text-[11px] font-black text-slate-800 truncate">{col.title}</span>
                                </div>
                                {periodType === 'Dia' && (
                                    <div className="absolute -bottom-2 flex gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity z-[60]">
                                        <button onClick={(e) => { e.stopPropagation(); moveProfessional(col.id, 'left'); }} className="p-1 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-orange-500 shadow-sm"><ChevronLeft size={12}/></button>
                                        <button onClick={(e) => { e.stopPropagation(); moveProfessional(col.id, 'right'); }} className="p-1 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-orange-500 shadow-sm"><ChevronRight size={12}/></button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${colWidth}px, 1fr))` }}>
                        <div className="sticky left-0 z-[40] bg-white border-r border-slate-200 min-w-[60px]">
                            {timeSlotsLabels.map(time => (
                                <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                    <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                </div>
                            ))}
                        </div>
                        {columns.map((col) => (
                            <div key={col.id} className="relative border-r border-slate-200 cursor-crosshair bg-white" style={{ minHeight: `${timeSlotsLabels.length * SLOT_PX_HEIGHT}px` }}>
                                {timeSlotsLabels.map((_, i) => (
                                    <div key={i} onClick={(e) => handleGridClick(col, i, e)} className="h-20 border-b border-slate-100/50 border-dashed hover:bg-orange-50/30 transition-colors z-0"></div>
                                ))}
                                {appointments.filter(app => { 
                                    if (periodType === 'Semana') return isSameDay(app.start, col.data as Date); 
                                    return String(app.professional?.id) === String(col.id); 
                                }).map(app => {
                                    const color = app.type === 'block' ? '#94a3b8' : (app.service?.color || '#3b82f6');
                                    return (
                                        <div key={app.id} ref={(el) => { if (app.type === 'appointment') appointmentRefs.current.set(app.id, el); }} onClick={(e) => { e.stopPropagation(); if (app.type === 'appointment') setActiveAppointmentDetail(app); }} className="rounded shadow-sm border-l-4 p-2 cursor-pointer hover:brightness-95 transition-all overflow-hidden flex flex-col group/card border-r border-b border-slate-200/50 z-20" style={{ ...getAppointmentPosition(app.start, app.end, timeSlot), borderLeftColor: color, backgroundColor: `${color}15` }}>
                                            <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">{format(app.start, 'HH:mm')}</p>
                                            <p className="text-xs font-bold text-slate-800 truncate leading-tight">{app.client?.nome || 'Bloqueado'}</p>
                                            <p className="text-[9px] text-slate-500 truncate mt-1">{app.service?.name}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        <TimelineIndicator timeSlot={timeSlot} />
                    </div>
                </div>

                {selectionMenu && (
                    <div className="fixed z-[200] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[200px] animate-in zoom-in-95 duration-200" style={{ top: selectionMenu.y, left: selectionMenu.x }} onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-2 border-b border-slate-50 mb-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Escolher Ação</p>
                            <p className="text-xs font-bold text-slate-700">{format(selectionMenu.time, 'HH:mm')} • {selectionMenu.professional.name}</p>
                        </div>
                        <button onClick={() => { setModalState({ type: 'appointment', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all"><CalendarIcon size={18} /> Novo Agendamento</button>
                        <button onClick={() => { setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"><Ban size={18} /> Bloquear Horário</button>
                    </div>
                )}
            </div>

            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => { setModalState({ type: 'appointment', data: app }); setActiveAppointmentDetail(null); }} 
                    onDelete={async (id) => { if(confirm("Apagar horário?")) { await supabase.from('appointments').delete().eq('id', id); fetchAppointments(); setActiveAppointmentDetail(null); } }} 
                    onUpdateStatus={handleUpdateStatus}
                />
            )}
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
        </div>
    );
};

export default AtendimentosView;
