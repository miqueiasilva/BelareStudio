
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    ShoppingBag, Ban, Settings as SettingsIcon, Maximize2, 
    LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, Clock,
    AlertTriangle, ArrowRight, CalendarDays, Globe, User, ThumbsUp, MapPin, 
    CheckCircle2, Scissors, ShieldAlert
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
const CARD_TOP_OFFSET = 0; 

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

const StatusIndicator = ({ status }: { status: AppointmentStatus }) => {
    switch (status) {
        case 'agendado': return <Clock size={12} className="text-slate-400" />;
        case 'confirmado':
        case 'confirmado_whatsapp': return <ThumbsUp size={12} className="text-blue-500" />;
        case 'chegou': return <MapPin size={12} className="text-purple-500" />;
        case 'em_atendimento': return <Scissors size={12} className="text-indigo-600" />;
        case 'concluido': return <CheckCircle2 size={12} className="text-emerald-600" />;
        case 'faltou':
        case 'cancelado': return <Ban size={12} className="text-rose-500" />;
        default: return <Clock size={12} className="text-amber-500" />; 
    }
};

const ConflictAlertModal = ({ newApp, conflictApp, onConfirm, onCancel }: any) => {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-orange-100">
                <div className="bg-orange-50 p-8 text-center border-b border-orange-100">
                    <div className="w-20 h-20 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200 animate-bounce">
                        <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 leading-tight">Conflito de Horário Detectado!</h2>
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

// --- MOTOR DE CÁLCULO DE PRECISÃO ABSOLUTA ---
const getAppointmentPosition = (start: Date, end: Date, timeSlot: number) => {
    // Pixels por minuto exatos
    const pixelsPerMinute = SLOT_PX_HEIGHT / timeSlot;

    // Minutos desde o início do dia (08:00)
    const startMinutesSinceDayStart = (start.getHours() * 60 + start.getMinutes()) - (START_HOUR * 60);

    // Duração exata em minutos
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;

    // Matemática Pura (Sem offsets mágicos)
    const top = Math.floor(startMinutesSinceDayStart * pixelsPerMinute);
    const height = Math.floor(durationMinutes * pixelsPerMinute);
    
    return { 
        position: 'absolute' as const,
        top: `${top}px`, 
        height: `${height}px`,
        width: '100%', 
        zIndex: 20,
        left: '0px'
    };
};

const getCardStyle = (app: LegacyAppointment, viewMode: 'profissional' | 'andamento' | 'pagamento') => {
    const baseClasses = "rounded-none shadow-sm border-l-[6px] p-2 cursor-pointer hover:brightness-95 transition-all overflow-hidden flex flex-col group/card !m-0";
    
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
}

const AtendimentosView: React.FC<AtendimentosViewProps> = ({ onAddTransaction }) => {
    const { user, loading: authLoading } = useAuth(); 
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
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

            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .gte('date', rangeStart.toISOString())
                .lte('date', rangeEnd.toISOString())
                .neq('status', 'cancelado') 
                .abortSignal(abortControllerRef.current.signal);

            if (error) throw error;

            if (data && isMounted.current && requestId === lastRequestId.current) {
                const mapped = data.map(row => mapRowToAppointment(row, resources));
                setAppointments(mapped);
            }
        } catch (e: any) { 
            if (e.name !== 'AbortError') console.error("Fetch Appointments Error:", e); 
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
        
        const channel = supabase.channel('agenda-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { if (isMounted.current) fetchAppointments(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => { if (isMounted.current) fetchResources(); })
            .subscribe();

        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
            supabase.removeChannel(channel).catch(console.error);
        };
    }, []);

    // --- LOGICA DE REORDENAÇÃO ---
    const handleReorderProfessional = useCallback(async (e: React.MouseEvent, currentIndex: number, direction: 'left' | 'right') => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= resources.length) return;

        const newResources = [...resources];
        const temp = newResources[currentIndex];
        newResources[currentIndex] = newResources[targetIndex];
        newResources[targetIndex] = temp;

        setResources(newResources);

        try {
            const updates = [
                { id: newResources[currentIndex].id, order_index: currentIndex },
                { id: newResources[targetIndex].id, order_index: targetIndex }
            ];

            for (const up of updates) {
                await supabase.from('team_members').update({ order_index: up.order_index }).eq('id', up.id);
            }
        } catch (e) {
            console.error("Falha ao salvar nova ordem:", e);
            fetchResources(); 
        }
    }, [resources]);

    const mapRowToAppointment = (row: any, professionalsList: LegacyProfessional[]): LegacyAppointment => {
        const start = new Date(row.date);
        const dur = row.duration || 30;
        
        let prof = professionalsList.find(p => String(p.id) === String(row.resource_id));
        if (!prof && row.professional_name) {
            prof = professionalsList.find(p => p.name.toLowerCase() === row.professional_name.toLowerCase());
        }

        return {
            id: row.id, start, end: new Date(start.getTime() + dur * 60000), status: row.status as AppointmentStatus,
            notas: row.notes || '', origem: row.origem || 'interno',
            client: { id: row.client_id, nome: row.client_name || 'Cliente', consent: true },
            professional: prof || professionalsList[0] || { id: 0, name: row.professional_name, avatarUrl: '' },
            service: { id: 0, name: row.service_name, price: Number(row.value), duration: dur, color: row.status === 'bloqueado' ? '#64748b' : '#3b82f6' }
        } as LegacyAppointment;
    };

    const handleSaveAppointment = async (app: LegacyAppointment, force: boolean = false) => {
        setIsLoadingData(true);
        try {
            if (!force) {
                const { data: existingOnDay } = await supabase.from('appointments').select('*').eq('resource_id', app.professional.id).neq('status', 'cancelado').gte('date', startOfDay(app.start).toISOString()).lte('date', endOfDay(app.start).toISOString());
                const conflict = existingOnDay?.find(row => {
                    if (app.id && row.id === app.id) return false;
                    return (app.start < addMinutes(new Date(row.date), row.duration || 30)) && (app.end > new Date(row.date));
                });
                if (conflict) { setPendingConflict({ newApp: app, conflictWith: conflict }); setIsLoadingData(false); return; }
            }
            const payload = { client_name: app.client?.nome, resource_id: app.professional.id, professional_name: app.professional.name, service_name: app.service.name, value: app.service.price, duration: app.service.duration, date: app.start.toISOString(), status: app.status, notes: app.notas, origem: app.origem || 'interno' };
            
            if (app.id && appointments.some(a => a.id === app.id)) {
                await supabase.from('appointments').update(payload).eq('id', app.id);
            } else {
                await supabase.from('appointments').insert([payload]);
            }

            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null); setPendingConflict(null);
            fetchAppointments();
        } catch (e) { 
            setToast({ message: 'Erro ao salvar.', type: 'error' }); 
            fetchAppointments(); 
        } finally { setIsLoadingData(false); }
    };

    const handleUpdateStatus = async (id: number, newStatus: AppointmentStatus) => {
        const appointment = appointments.find(a => a.id === id);
        if (!appointment) return;
        
        // RBAC: Bloqueio de mudança de status se for 'concluido' por não-admins
        const isAdmin = user?.papel === 'admin' || user?.papel === 'gestor';
        if (!isAdmin && appointment.status === 'concluido') {
            setToast({ message: "Permissão Negada: Apenas o Gestor pode alterar registros concluídos.", type: 'error' });
            return;
        }

        if (appointment.status === 'concluido' && newStatus !== 'concluido') {
            if (!window.confirm("Atenção: O lançamento financeiro será ESTORNADO do caixa. Continuar?")) return;
            await supabase.from('financial_transactions').delete().eq('appointment_id', id);
        }
        
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        if (!error) {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
        } else {
            fetchAppointments();
        }
        setActiveAppointmentDetail(null);
    };

    // --- AUDITORIA E COMPLIANCE: Exclusão com Snapshot Forense (Audit Trail) ---
    const handleDeleteAppointmentFull = async (id: number) => {
        const appointment = appointments.find(a => a.id === id);
        if (!appointment) return;

        const isAdmin = user?.papel === 'admin' || user?.papel === 'gestor';
        const isFinished = appointment.status === 'concluido';

        // REGRA 1: Bloqueio RBAC
        if (!isAdmin && isFinished) {
            setToast({ 
                message: "Permissão Negada: Apenas o Gestor pode excluir registros com financeiro lançado.", 
                type: 'error' 
            });
            return;
        }

        const confirmMsg = isFinished 
            ? "⚠️ AÇÃO AUDITADA: Este registro possui financeiro vinculado. A exclusão removerá o recebimento e gerará um Log de Segurança. Prosseguir?"
            : "Deseja realmente apagar este agendamento?";

        if (!window.confirm(confirmMsg)) return;
        
        setIsLoadingData(true);
        try {
            // PASSO 0: Snapshot para Auditoria (Old Value)
            if (isFinished) {
                await supabase.from('audit_logs').insert([{
                    actor_id: user?.id,
                    actor_name: user?.nome,
                    action_type: 'DELETE',
                    entity: 'appointments',
                    entity_id: String(id),
                    old_value: {
                        client: appointment.client?.nome,
                        service: appointment.service.name,
                        value: appointment.service.price,
                        date: appointment.start.toISOString(),
                        professional: appointment.professional.name,
                        status: appointment.status
                    }
                }]);
            }

            // PASSO A: Limpeza Profunda (Prevenção de Erro 409 Conflict)
            await supabase.from('financial_transactions').delete().eq('appointment_id', id);

            // PASSO B: Remoção do Registro Principal
            const { error: apptError } = await supabase.from('appointments').delete().eq('id', id);

            if (apptError) throw apptError;

            setAppointments(prev => prev.filter(p => p.id !== id));
            setToast({ message: 'Registro removido e ação auditada.', type: 'info' });
            setActiveAppointmentDetail(null);
        } catch (e: any) {
            console.error("Falha na exclusão atômica:", e);
            setToast({ message: "Falha técnica ao excluir registro vinculado.", type: 'error' });
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
                            <button onClick={() => setViewMode('pagamento')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'pagamento' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}><CreditCard size={14} /> Pagamento</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                        <button onClick={() => setIsConfigModalOpen(true)} className="p-2 rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 transition-all"><SlidersHorizontal size={20} /></button>
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

            <div 
                ref={gridScrollRef}
                className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar"
            >
                <div className="min-w-fit">
                    {/* CABEÇALHO PROFISSIONAIS - ALTURA FIXA h-24 (96px) */}
                    <div className="grid sticky top-0 z-[50] border-b border-slate-200 bg-white shadow-sm" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        <div className="sticky left-0 z-[60] bg-white border-r border-slate-200 h-24 min-w-[60px] flex items-center justify-center shadow-[4px_0_24px_rgba(0,0,0,0.05)]"><Maximize2 size={16} className="text-slate-300" /></div>
                        {columns.map((col, idx) => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24 bg-white relative group transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-[200px] overflow-hidden">
                                    {(col as any).photo && <img src={(col as any).photo} alt={col.title} className="w-8 h-8 rounded-full object-cover border border-orange-100 flex-shrink-0" />}
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[11px] font-black text-slate-800 leading-tight truncate">{col.title}</span>
                                        {(col as any).subtitle && <span className="text-[9px] text-slate-400 font-bold uppercase">{ (col as any).subtitle}</span>}
                                    </div>
                                </div>
                                {periodType === 'Dia' && col.type === 'professional' && (
                                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                        <button 
                                            onClick={(e) => handleReorderProfessional(e, idx, 'left')}
                                            className="p-1 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-orange-500 active:scale-95 transition-all"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleReorderProfessional(e, idx, 'right')}
                                            className="p-1 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-orange-500 active:scale-95 transition-all"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* CORPO DA GRADE */}
                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        
                        {/* COLUNA DE HORÁRIOS - PRECISÃO ZERO OFFSET */}
                        <div className="sticky left-0 z-[50] bg-white border-r border-slate-200 min-w-[60px] shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
                            {timeSlotsLabels.map(time => (
                                <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                    <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                </div>
                            ))}
                        </div>

                        {/* COLUNAS DE CONTEÚDO */}
                        {columns.map((col, idx) => (
                            <div 
                                key={col.id} 
                                className={`relative border-r border-slate-200 cursor-crosshair ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/[0.03]'}`}
                                style={{ minHeight: `${timeSlotsLabels.length * SLOT_PX_HEIGHT}px` }}
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) {
                                        const prof = col.type === 'professional' ? (col.data as LegacyProfessional) : resources[0];
                                        const date = col.type === 'date' ? (col.data as Date) : currentDate;
                                        handleGridClick(e, prof, date);
                                    }
                                }}
                            >
                                {/* Linhas de Grade de Fundo */}
                                {timeSlotsLabels.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed pointer-events-none"></div>)}
                                
                                {/* Cards de Agendamento */}
                                {filteredAppointments
                                    .filter(app => {
                                        if (periodType === 'Semana') return isSameDay(app.start, col.data as Date);
                                        return String(app.professional.id) === String(col.id); 
                                    })
                                    .map(app => (
                                        <div 
                                            key={app.id} 
                                            ref={(el) => { if (el) appointmentRefs.current.set(app.id, el); }} 
                                            onClick={(e) => { e.stopPropagation(); setActiveAppointmentDetail(app); }} 
                                            title={`${format(app.start, 'HH:mm')} - ${app.client?.nome || 'Bloqueado'} (${app.service.name})`}
                                            className={getCardStyle(app, viewMode)} 
                                            style={{ 
                                                ...getAppointmentPosition(app.start, app.end, timeSlot),
                                                borderLeftColor: app.service.color
                                            }}
                                        >
                                            <div className="absolute top-1.5 right-1.5 opacity-40 group-hover/card:opacity-100 transition-opacity">
                                                {app.origem === 'link' ? <Globe size={10} className="text-orange-500" /> : <User size={10} className="text-slate-400" />}
                                            </div>
                                            <div className="flex items-center gap-1 overflow-hidden">
                                                <span className="text-[9px] font-bold opacity-70 leading-none flex-shrink-0">{format(app.start, 'HH:mm')}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                                    <StatusIndicator status={app.status} />
                                                    <p className="font-bold text-slate-900 text-[11px] truncate leading-tight flex-1">
                                                        {app.client?.nome || 'Bloqueado'}
                                                    </p>
                                                </div>
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
                <>
                    <div className="fixed inset-0 z-50" onClick={() => setSelectionMenu(null)} />
                    <div className="fixed z-[60] bg-white rounded-2xl shadow-2xl border border-slate-100 w-64 py-2 animate-in fade-in zoom-in-95 duration-150" style={{ top: Math.min(selectionMenu.y, window.innerHeight - 200), left: Math.min(selectionMenu.x, window.innerWidth - 260) }}>
                        <button onClick={() => { setModalState({ type: 'appointment', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                            <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600"><CalendarIcon size={16} /></div> Novo Agendamento
                        </button>
                        <button onClick={() => { setModalState({ type: 'sale', data: { professionalId: selectionMenu.professional.id } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors">
                            <div className="p-1.5 bg-green-100 rounded-lg text-green-600"><ShoppingBag size={16} /></div> Nova Venda
                        </button>
                        <button onClick={() => { setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                            <div className="p-1.5 bg-rose-100 rounded-lg text-orange-600"><Ban size={16} /></div> Bloqueio
                        </button>
                    </div>
                </>
            )}

            {isConfigModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsConfigModalOpen(false)}></div>
                    <div className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
                        <header className="flex justify-between items-center mb-8"><h3 className="font-extrabold text-slate-800">Grade</h3><button onClick={() => setIsConfigModalOpen(false)}><X size={20} /></button></header>
                        <div className="space-y-4">
                            <label className="text-sm font-black text-slate-700 uppercase">Largura: {colWidth}px</label>
                            <input type="range" min="150" max="450" step="10" value={colWidth} onChange={e => setColWidth(Number(e.target.value))} className="w-full" />
                        </div>
                    </div>
                </div>
            )}

            {isPeriodModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPeriodModalOpen(false)}></div>
                    <div className="relative w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden p-4 animate-in zoom-in-95 duration-200">
                        <div className="space-y-2">
                            {['Dia', 'Semana', 'Mês', 'Lista'].map((item) => (
                                <button key={item} onClick={() => { setPeriodType(item as any); setIsPeriodModalOpen(false); }} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold ${periodType === item ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'}`}>{item}{periodType === item && <Check size={18} />}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={handleDeleteAppointmentFull} 
                    onUpdateStatus={handleUpdateStatus} 
                />
            )}
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
            {modalState?.type === 'block' && <BlockTimeModal professional={modalState.data.professional} startTime={modalState.data.start} onClose={() => setModalState(null)} onSave={handleSaveAppointment as any} />}
            {modalState?.type === 'sale' && <NewTransactionModal type="receita" onClose={() => setModalState(null)} onSave={(t) => { onAddTransaction(t); setModalState(null); setToast({ message: 'Venda registrada!', type: 'success' }); }} />}
            {pendingConflict && <ConflictAlertModal newApp={pendingConflict.newApp} conflictApp={pendingConflict.conflictWith} onConfirm={() => handleSaveAppointment(pendingConflict.newApp, true)} onCancel={() => setPendingConflict(null)} />}
            
            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
            <div className="fixed bottom-8 right-8 z-10"><button onClick={() => setIsJaciBotOpen(true)} className="w-16 h-16 bg-orange-500 rounded-3xl shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all"><MessageSquare className="w-8 h-8" /></button></div>
        </div>
    );
};

export default AtendimentosView;
