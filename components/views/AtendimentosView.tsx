
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    ShoppingBag, Ban, Settings as SettingsIcon, Maximize2, 
    LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, Clock,
    AlertTriangle, ArrowRight, CalendarDays, Globe, User, ThumbsUp, MapPin, 
    CheckCircle2, Scissors, ShieldAlert, Trash2, DollarSign, CheckCircle, Plus
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, isSameMonth, parseISO, addMinutes, startOfDay, endOfDay, startOfMonth, endOfMonth, setHours, setMinutes } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

import { LegacyAppointment, AppointmentStatus, FinancialTransaction, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
import BlockTimeModal from '../modals/BlockTimeModal';
import ContextMenu from '../shared/ContextMenu';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const START_HOUR = 8;
const END_HOUR = 20; 
const SLOT_PX_HEIGHT = 80; 

const getAppointmentPosition = (start: Date, end: Date, timeSlot: number) => {
    const pixelsPerMinute = SLOT_PX_HEIGHT / timeSlot;
    const startMinutesSinceDayStart = (start.getHours() * 60 + start.getMinutes()) - (START_HOUR * 60);
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    const top = Math.floor(startMinutesSinceDayStart * pixelsPerMinute);
    const height = Math.max(20, Math.floor(durationMinutes * pixelsPerMinute));
    return { position: 'absolute' as const, top: `${top}px`, height: `${height}px`, width: '100%', zIndex: 20, left: '0px' };
};

const getCardStyle = (app: any) => {
    const baseClasses = "rounded-none shadow-sm border-l-4 p-1.5 cursor-pointer hover:brightness-95 transition-all overflow-hidden flex flex-col group/card !m-0 border-r border-b border-slate-200/50 relative";
    if (app.type === 'block') return "absolute rounded-none border-l-4 border-rose-400 bg-[repeating-linear-gradient(45deg,#fcfcfc,#fcfcfc_10px,#f8fafc_10px,#f8fafc_20px)] text-slate-500 p-2 overflow-hidden flex flex-col cursor-not-allowed opacity-95 z-[25] pointer-events-auto shadow-sm";
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
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    // Menu de Clique na Grade
    const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, time: Date, professional: LegacyProfessional } | null>(null);

    const [viewMode, setViewMode] = useState<'profissional' | 'andamento'>('profissional');
    const [colWidth] = useState(220);
    const [timeSlot] = useState(30);

    const isMounted = useRef(true);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const gridScrollRef = useRef<HTMLDivElement>(null); 
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchAppointments = async () => {
        if (!isMounted.current || authLoading || !user) return;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        setIsLoadingData(true);

        try {
            const rangeStart = startOfDay(currentDate);
            const rangeEnd = endOfDay(currentDate);

            const [apptRes, blocksRes] = await Promise.all([
                supabase
                    .from('appointments') 
                    .select(`
                        *,
                        clients!client_id(id, name, phone),
                        services!service_id(id, name, price, color, duration),
                        team_members!professional_id(id, name)
                    `)
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

            if (isMounted.current) {
                const mappedAppts = (apptRes.data || []).map(row => ({
                    ...mapRowToAppointment(row),
                    type: 'appointment'
                }));
                const mappedBlocks = (blocksRes.data || []).map(row => ({
                    id: row.id, start: new Date(row.start_time), end: new Date(row.end_time),
                    professional: { id: row.professional_id }, service: { name: row.reason, color: '#fca5a5' },
                    status: 'bloqueado', type: 'block'
                }));
                setAppointments([...mappedAppts, ...mappedBlocks]);
            }
        } catch (e: any) { 
            if (e.name !== 'AbortError') console.error("Agenda Fetch Error:", e);
        } finally { 
            if (isMounted.current) setIsLoadingData(false); 
        }
    };

    const fetchResources = async () => {
        if (authLoading || !user) return;
        try {
            const { data, error } = await supabase.from('team_members').select('*').eq('active', true).order('order_index');
            if (error) throw error;
            if (data && isMounted.current) {
                setResources(data.map((p: any) => ({
                    id: p.id, name: p.name, avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}`,
                    role: p.role, services_enabled: p.services_enabled || [] 
                })));
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (!authLoading && user && resources.length > 0) fetchAppointments(); }, [currentDate, resources, user, authLoading]);
    useEffect(() => { isMounted.current = true; fetchResources(); return () => { isMounted.current = false; if (abortControllerRef.current) abortControllerRef.current.abort(); }; }, []);

    const mapRowToAppointment = (row: any): LegacyAppointment => {
        const start = new Date(row.date);
        const dur = Number(row.duration) || Number(row.services?.duration) || 30;
        return {
            id: row.id, start, end: new Date(start.getTime() + dur * 60000), status: row.status as AppointmentStatus,
            notas: row.notes || '', origem: row.origin || 'agenda',
            client: { id: row.client_id, nome: row.clients?.name || 'Cliente', consent: true, whatsapp: row.clients?.phone },
            professional: { id: row.professional_id, name: row.team_members?.name || 'Profissional', avatarUrl: '' },
            service: { id: row.service_id, name: row.services?.name || 'Serviço', price: Number(row.value || 0), duration: dur, color: row.services?.color || '#3b82f6' }
        } as LegacyAppointment;
    };

    // --- MANIPULADOR DE CLIQUE NA GRADE ---
    const handleGridClick = (e: React.MouseEvent, professional: LegacyProfessional) => {
        // Apenas abre se o clique for na grade vazia, não sobre um card
        if (e.target !== e.currentTarget) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        // Converte pixel Y em minutos
        const totalMinutesFromDayStart = (y / SLOT_PX_HEIGHT) * timeSlot;
        const roundedMinutes = Math.floor(totalMinutesFromDayStart / 15) * 15;
        
        const clickedTime = new Date(currentDate);
        clickedTime.setHours(START_HOUR + Math.floor(roundedMinutes / 60));
        clickedTime.setMinutes(roundedMinutes % 60);
        clickedTime.setSeconds(0);
        clickedTime.setMilliseconds(0);

        setSelectionMenu({
            x: e.clientX,
            y: e.clientY,
            time: clickedTime,
            professional
        });
    };

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        setIsLoadingData(true);
        try {
            const payload = {
                client_id: Number(app.client?.id),
                service_id: Number(app.service.id),
                professional_id: String(app.professional.id),
                date: new Date(app.start).toISOString(),
                status: app.status || 'agendado',
                value: Number(app.service.price),
                duration: String(app.service.duration),
                notes: app.notas || '',
                origin: 'agenda'
            };
            
            let res;
            if (app.id && appointments.some(a => a.id === app.id)) res = await supabase.from('appointments').update(payload).eq('id', app.id);
            else res = await supabase.from('appointments').insert([payload]);

            if (res.error) throw res.error;
            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null); fetchAppointments();
        } catch (e: any) { 
            setToast({ message: `Erro ao salvar.`, type: 'error' }); 
        } finally { setIsLoadingData(false); }
    };

    const handleUpdateStatus = async (id: number, newStatus: AppointmentStatus) => {
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        if (!error) fetchAppointments();
        setActiveAppointmentDetail(null);
    };

    return (
        <div className="flex h-full bg-white relative flex-col font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Agenda {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}</h2>
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all active:scale-95">Novo Agendamento</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">HOJE</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={20} /></button>
                        <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-bold text-lg capitalize tracking-tight">{format(currentDate, "EEE, dd 'de' MMMM", { locale: pt })}</span>
                </div>
            </header>

            <div ref={gridScrollRef} className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
                <div className="min-w-fit">
                    <div className="grid sticky top-0 z-[50] border-b border-slate-200 bg-white shadow-sm" style={{ gridTemplateColumns: `60px repeat(${resources.length}, minmax(${colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-[60] bg-white border-r border-slate-200 h-24 min-w-[60px] flex items-center justify-center"><Maximize2 size={16} className="text-slate-300" /></div>
                        {resources.map((res) => (
                            <div key={res.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24 bg-white relative group">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-[200px] overflow-hidden">
                                    <img src={res.avatarUrl} alt={res.name} className="w-8 h-8 rounded-full object-cover border border-orange-100" />
                                    <span className="text-[11px] font-black text-slate-800 leading-tight truncate">{res.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${resources.length}, minmax(${colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-[50] bg-white border-r border-slate-200 min-w-[60px]">
                            {Array.from({ length: (END_HOUR - START_HOUR) * 60 / timeSlot }).map((_, i) => {
                                const time = `${String(START_HOUR + Math.floor((i * timeSlot) / 60)).padStart(2, '0')}:${String((i * timeSlot) % 60).padStart(2, '0')}`;
                                return (
                                    <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                        <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {resources.map((res) => (
                            <div 
                                key={res.id} 
                                className="relative border-r border-slate-200 cursor-crosshair min-h-[960px]"
                                onClick={(e) => handleGridClick(e, res)}
                            >
                                {appointments.filter(app => String(app.professional.id) === String(res.id)).map(app => (
                                    <div key={app.id} ref={(el) => { if (el && app.type === 'appointment') appointmentRefs.current.set(app.id, el); }} onClick={(e) => { e.stopPropagation(); if (app.type === 'appointment') setActiveAppointmentDetail(app); }} className={getCardStyle(app)} style={{ ...getAppointmentPosition(app.start, app.end, timeSlot), borderLeftColor: app.service.color || '#3b82f6', backgroundColor: `${app.service.color || '#3b82f6'}15` }}>
                                        <div className="absolute top-1 right-1 flex gap-0.5">
                                            {app.status === 'concluido' && <DollarSign size={10} className="text-emerald-600" strokeWidth={3} />}
                                            {['confirmado', 'confirmado_whatsapp'].includes(app.status) && <CheckCircle size={10} className="text-blue-600" strokeWidth={3} />}
                                        </div>
                                        <div className="flex flex-col h-full justify-between relative z-0 pointer-events-none">
                                            <div>
                                                <p className="text-[10px] font-medium text-slate-500 leading-none mb-0.5">{format(app.start, 'HH:mm')}</p>
                                                <p className="text-xs font-bold text-slate-800 truncate leading-tight">{app.client?.nome || 'Bloqueado'}</p>
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

            {selectionMenu && (
                <ContextMenu 
                    x={selectionMenu.x} 
                    y={selectionMenu.y} 
                    onClose={() => setSelectionMenu(null)}
                    options={[
                        { 
                            label: 'Novo Agendamento', 
                            icon: <Plus size={16} className="text-orange-500" />,
                            onClick: () => setModalState({ 
                                type: 'appointment', 
                                data: { start: selectionMenu.time, professional: selectionMenu.professional } 
                            })
                        },
                        { 
                            label: 'Bloquear Horário', 
                            icon: <Ban size={16} className="text-rose-500" />,
                            onClick: () => setModalState({ 
                                type: 'block', 
                                data: { start: selectionMenu.time, professional: selectionMenu.professional } 
                            })
                        }
                    ]}
                />
            )}

            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={() => {}} 
                    onUpdateStatus={handleUpdateStatus}
                />
            )}
            
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
            {modalState?.type === 'block' && (
                <BlockTimeModal 
                    professional={modalState.data.professional} 
                    startTime={modalState.data.start} 
                    onClose={() => setModalState(null)} 
                    onSave={(block) => {
                        // Lógica de salvamento de bloqueio no banco aqui
                        setToast({ message: "Horário bloqueado!", type: 'info' });
                        setModalState(null);
                        fetchAppointments();
                    }}
                />
            )}
        </div>
    );
};

export default AtendimentosView;
