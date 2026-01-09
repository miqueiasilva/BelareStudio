
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    ShoppingBag, Ban, Settings as SettingsIcon, Maximize2, 
    LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, Clock,
    AlertTriangle, ArrowRight, CalendarDays, Globe, User, ThumbsUp, MapPin, 
    CheckCircle2, Scissors, ShieldAlert, Trash2, DollarSign, CheckCircle
} from 'lucide-react';
import { 
    format, addDays, addWeeks, addMonths, eachDayOfInterval, 
    isSameDay, isWithinInterval, endOfWeek, isSameMonth, 
    addMinutes, endOfDay, endOfMonth 
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

const ConflictAlertModal = ({ newApp, conflictApp, onConfirm, onCancel }: any) => {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-orange-100">
                <div className="bg-orange-50 p-8 text-center border-b border-orange-100">
                    <div className="w-20 h-20 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200 animate-bounce">
                        <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 leading-tight">Conflito de Horário!</h2>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-4 text-center">
                        <p className="text-slate-600 text-sm font-medium">
                            O horário das <b className="text-slate-800">{format(newApp.start, 'HH:mm')}</b> choca com o atendimento de <b className="text-slate-800">{conflictApp.client_name}</b>.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={onConfirm} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95">Salvar Mesmo Assim</button>
                        <button onClick={onCancel} className="w-full py-4 text-slate-400 font-bold text-sm">Voltar</button>
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
    const [pendingConflict, setPendingConflict] = useState<{ newApp: LegacyAppointment, conflictWith: any } | null>(null);
    const [viewMode, setViewMode] = useState<'profissional' | 'andamento' | 'pagamento'>('profissional');
    const [colWidth, setColWidth] = useState(220);
    const [timeSlot, setTimeSlot] = useState(30);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const gridScrollRef = useRef<HTMLDivElement>(null); 

    const fetchAppointments = useCallback(async () => {
        if (authLoading || !user || !activeStudioId) return;
        setIsLoadingData(true);
        try {
            let rangeStart: Date, rangeEnd: Date;
            if (periodType === 'Semana') {
                const d = new Date(currentDate);
                const day = d.getDay();
                const diff = (day < 1 ? 7 : 0) + day - 1; 
                d.setDate(d.getDate() - diff);
                d.setHours(0, 0, 0, 0);
                rangeStart = d;
                rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else if (periodType === 'Mês') {
                rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                rangeEnd = endOfMonth(currentDate);
            } else {
                rangeStart = new Date(new Date(currentDate).setHours(0, 0, 0, 0));
                rangeEnd = endOfDay(currentDate);
            }

            const { data: apptRes, error: apptError } = await supabase
                .from('appointments')
                .select('*')
                .eq('studio_id', activeStudioId)
                .gte('date', rangeStart.toISOString())
                .lte('date', rangeEnd.toISOString())
                .neq('status', 'cancelado');

            if (apptError) throw apptError;

            const mapped = (apptRes || []).map(row => ({
                ...mapRowToAppointment(row, resources),
                type: 'appointment'
            }));

            setAppointments(mapped);
        } catch (e) {
            console.error("Fetch Agenda Error:", e);
        } finally {
            setIsLoadingData(false);
        }
    }, [currentDate, periodType, resources, user, authLoading, activeStudioId]);

    const fetchResources = useCallback(async () => {
        if (authLoading || !user || !activeStudioId) return;
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select('*')
                .eq('active', true)
                .eq('studio_id', activeStudioId)
                .order('order_index');
            if (error) throw error;
            if (data) {
                const mapped = data.map((p: any) => ({
                    id: p.id, name: p.name, avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                    role: p.role, order_index: p.order_index || 0, services_enabled: p.services_enabled || [] 
                }));
                setResources(mapped);
            }
        } catch (e) { console.error(e); }
    }, [authLoading, user, activeStudioId]);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    useEffect(() => {
        if (resources.length > 0) {
            fetchAppointments();
        }
    }, [fetchAppointments, resources.length]);

    const mapRowToAppointment = (row: any, professionalsList: LegacyProfessional[]): LegacyAppointment => {
        const start = new Date(row.date);
        const dur = row.duration || 30;
        let prof = professionalsList.find(p => String(p.id) === String(row.professional_id));
        return {
            id: row.id, start, end: new Date(start.getTime() + dur * 60000), status: row.status as AppointmentStatus,
            notas: row.notes || '', origem: row.origem || 'interno',
            client: { id: row.client_id, nome: row.client_name || 'Cliente', consent: true },
            professional: prof || professionalsList[0],
            service: { id: 0, name: row.service_name, price: Number(row.value), duration: dur, color: row.service_color || '#3b82f6' }
        } as LegacyAppointment;
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
                notes: app.notas 
            };
            
            if (app.id && app.id > 1000000) { // New temp ID check
                await supabase.from('appointments').insert([payload]);
            } else {
                await supabase.from('appointments').update(payload).eq('id', app.id);
            }

            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null);
            fetchAppointments();
        } catch (e) { 
            setToast({ message: 'Erro ao salvar.', type: 'error' }); 
        } finally { setIsLoadingData(false); }
    };

    const handleUpdateStatus = async (id: number, newStatus: AppointmentStatus) => {
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        if (!error) {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
        }
        setActiveAppointmentDetail(null);
    };

    const handleConvertToCommand = async (appointment: LegacyAppointment) => {
        if (!activeStudioId) return;
        setIsLoadingData(true);
        try {
            const { data: command, error: cmdError } = await supabase
                .from('commands')
                .insert([{
                    studio_id: activeStudioId,
                    client_id: appointment.client?.id,
                    status: 'open',
                    total_amount: appointment.service.price
                }])
                .select().single();

            if (cmdError) throw cmdError;

            await supabase.from('command_items').insert([{
                command_id: command.id,
                appointment_id: appointment.id,
                title: appointment.service.name,
                price: appointment.service.price,
                quantity: 1
            }]);

            await supabase.from('appointments').update({ status: 'concluido' }).eq('id', appointment.id);

            setToast({ message: `Comanda aberta!`, type: 'success' });
            if (onNavigateToCommand) onNavigateToCommand(command.id);
        } catch (e) {
            setToast({ message: "Erro ao gerar comanda.", type: 'error' });
        } finally {
            setIsLoadingData(false);
        }
    };

    const columns = useMemo(() => {
        if (periodType === 'Semana') {
            const d = new Date(currentDate);
            const day = d.getDay();
            const diff = (day < 1 ? 7 : 0) + day - 1;
            d.setDate(d.getDate() - diff);
            d.setHours(0, 0, 0, 0);
            return eachDayOfInterval({ start: d, end: endOfWeek(currentDate, { weekStartsOn: 1 }) }).map(day => ({ 
                id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), subtitle: format(day, 'dd/MM'), type: 'date' as const, data: day 
            }));
        }
        return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional' as const, data: p }));
    }, [periodType, currentDate, resources]);

    const timeSlotsLabels = useMemo(() => {
        const labels = [];
        for (let i = 0; i < (END_HOUR - START_HOUR) * 60 / timeSlot; i++) {
            const minutes = i * timeSlot;
            labels.push(`${String(START_HOUR + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
        }
        return labels;
    }, [timeSlot]);

    return (
        <div className="flex h-full bg-white relative flex-col font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
                <div className="flex justify-between items-center gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Agenda {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 text-white font-bold py-2 px-6 rounded-xl shadow-lg">Agendar</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                        <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-bold text-lg capitalize">{format(currentDate, "EEE, dd 'de' MMMM", { locale: pt })}</span>
                </div>
            </header>

            <div ref={gridScrollRef} className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
                <div className="min-w-fit">
                    <div className="grid sticky top-0 z-[50] border-b border-slate-200 bg-white shadow-sm" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(180px, 1fr))` }}>
                        <div className="sticky left-0 z-[60] bg-white border-r border-slate-200 h-24 min-w-[60px] flex items-center justify-center"><Maximize2 size={16} className="text-slate-300" /></div>
                        {columns.map(col => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24">
                                <span className="text-xs font-black text-slate-800 leading-tight truncate">{col.title}</span>
                                {col.subtitle && <span className="text-[10px] text-slate-400">{col.subtitle}</span>}
                            </div>
                        ))}
                    </div>

                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(180px, 1fr))` }}>
                        <div className="sticky left-0 z-[50] bg-white border-r border-slate-200 min-w-[60px]">
                            {timeSlotsLabels.map(time => (
                                <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                    <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                </div>
                            ))}
                        </div>

                        {columns.map((col, idx) => (
                            <div key={col.id} className={`relative border-r border-slate-200 min-h-[1000px] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                                {timeSlotsLabels.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed"></div>)}
                                {appointments.filter(app => String(app.professional?.id) === String(col.id)).map(app => (
                                    <div 
                                        key={app.id} 
                                        ref={(el) => appointmentRefs.current.set(app.id, el)}
                                        onClick={() => setActiveAppointmentDetail(app)}
                                        className="rounded shadow-sm border-l-4 p-1.5 cursor-pointer hover:brightness-95 overflow-hidden flex flex-col"
                                        style={{ 
                                            ...getAppointmentPosition(app.start, app.end, timeSlot),
                                            borderLeftColor: app.service?.color || '#3b82f6',
                                            backgroundColor: `${app.service?.color || '#3b82f6'}15`
                                        }}
                                    >
                                        <p className="text-[10px] font-black text-slate-500 leading-none">{format(app.start, 'HH:mm')}</p>
                                        <p className="text-xs font-bold text-slate-800 truncate">{app.client?.nome}</p>
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
                    onDelete={async (id) => { if(window.confirm("Excluir?")) await supabase.from('appointments').delete().eq('id', id); fetchAppointments(); setActiveAppointmentDetail(null); }} 
                    onUpdateStatus={handleUpdateStatus}
                    onConvertToCommand={handleConvertToCommand}
                />
            )}
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
        </div>
    );
};

export default AtendimentosView;
