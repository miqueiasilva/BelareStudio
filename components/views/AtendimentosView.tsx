import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    ShoppingBag, Ban, Settings as SettingsIcon, Maximize2, 
    LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, Clock,
    AlertTriangle, ArrowRight, CalendarDays, Globe, User, ThumbsUp, MapPin, 
    CheckCircle2, Scissors, ShieldAlert, Trash2, DollarSign, CheckCircle,
    Share2, Bell
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
import { supabase, supabaseUrl, supabaseAnonKey } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useStudio } from '../../contexts/StudioContext';
import { useConfirm } from '../../utils/useConfirm';
import toast from 'react-hot-toast';

// FIX: Manual replacement for startOfDay as it's missing from date-fns
const getStartOfDay = (d: Date) => {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd;
};

const isUUID = (str: any): boolean => {
    if (!str) return false;
    if (typeof str === 'number') return true; // Aceita IDs numéricos para compatibilidade
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));
};

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
    const { confirm, ConfirmDialogComponent } = useConfirm();
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
    const [notificationCount, setNotificationCount] = useState(0);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    const handleMarkAsRead = async (notificationId: string | number) => {
        if (!user || !activeStudioId) return;
        const key = String(notificationId);
        
        console.log('🔕 Marcando notificação como lida:', key);
        
        try {
            const { error } = await supabase
                .from('notification_reads')
                .insert([{
                    user_id: user.id,
                    notification_key: key,
                    studio_id: activeStudioId
                }]);

            if (error && error.code !== '23505') {
                console.error('❌ Erro ao marcar como lida:', error);
                return;
            }

            setNotifications(prev => prev.filter(n => String(n.id) !== key));
            setNotificationCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('💥 Erro ao processar leitura:', err);
        }
    };

    const fetchNotifications = useCallback(async () => {
        if (!activeStudioId || authLoading || !user) return;
        console.log('🔔 Buscando notificações recentes para o estúdio:', activeStudioId);
        
        const since = new Date();
        since.setDate(since.getDate() - 7);
        
        try {
            const { data: readData, error: readError } = await supabase
                .from('notification_reads')
                .select('notification_key')
                .eq('user_id', user.id)
                .eq('studio_id', activeStudioId);

            if (readError) {
                console.error('❌ Erro ao buscar leituras de notificações:', readError);
            }

            const readKeys = new Set(readData?.map(r => r.notification_key) || []);

            const { data, error } = await supabase
                .from('appointments')
                .select('id, date, status, client_name, service_name, professional_name, origin, created_at')
                .eq('studio_id', activeStudioId)
                .gte('created_at', since.toISOString())
                .order('created_at', { ascending: false })
                .limit(40);

            if (error) {
                console.error('❌ Erro ao buscar notificações:', error);
                return;
            }

            if (data) {
                const unreadNotifications = data.filter(n => !readKeys.has(String(n.id)));
                console.log(`✅ ${unreadNotifications.length} notificações não lidas encontradas.`);
                
                setNotifications(unreadNotifications);
                setNotificationCount(unreadNotifications.filter(n => 
                    n.status !== 'concluido' && 
                    n.status !== 'cancelado'
                ).length);
            }
        } catch (err) {
            console.error('💥 Erro catastrófico nas notificações:', err);
        }
    }, [activeStudioId, user, authLoading]);

    const handleCopyBookingLink = () => {
        const link = `${window.location.origin}/booking/${activeStudioId}`;
        navigator.clipboard.writeText(link).then(() => {
            setToast({ message: '🔗 Link da agenda copiado!', type: 'success' });
        });
    };

    const isMounted = useRef(true);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const gridScrollRef = useRef<HTMLDivElement>(null); 
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastRequestId = useRef(0);

    const fetchAppointments = async () => {
        if (!isMounted.current || authLoading || !user || !activeStudioId) {
            return;
        }
        
        const requestId = ++lastRequestId.current;
        setIsLoadingData(true);

        try {
            let rangeStart: Date, rangeEnd: Date;
            
            if (periodType === 'Dia') {
                // FIX: Used getStartOfDay helper
                rangeStart = getStartOfDay(currentDate);
                rangeEnd = endOfDay(currentDate);
            } else if (periodType === 'Semana') {
                const day = currentDate.getDay();
                const diff = (day < 1 ? -6 : 1) - day;
                // FIX: Used getStartOfDay helper
                rangeStart = getStartOfDay(addDays(currentDate, diff));
                rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else {
                rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
                rangeEnd = endOfMonth(currentDate);
            }

            const startStr = format(rangeStart, "yyyy-MM-dd'T'HH:mm:ssXXX");
            const endStr = format(rangeEnd, "yyyy-MM-dd'T'HH:mm:ssXXX");

            const [apptRes, blocksRes] = await Promise.all([
                supabase
                    .from('appointments')
                    .select('id, date, duration, status, notes, client_id, client_name, professional_id, professional_name, service_name, value, service_color, resource_id, origin')
                    .eq('studio_id', activeStudioId)
                    .gte('date', startStr)
                    .lte('date', endStr)
                    .neq('status', 'cancelado'),
                supabase
                    .from('schedule_blocks')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .gte('start_time', startStr)
                    .lte('start_time', endStr)
            ]);

            if (apptRes.error) throw apptRes.error;
            if (blocksRes.error) throw blocksRes.error;

            if (isMounted.current && requestId === lastRequestId.current) {
                const mappedAppts = (apptRes.data || []).map(row => ({
                    ...mapRowToAppointment(row, resources),
                    type: row.type || 'appointment'
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
                console.error("💥 Fetch Agenda Error:", e);
                if (e.message) console.error("Error Message:", e.message);
                if (e.details) console.error("Error Details:", e.details);
                if (e.hint) console.error("Error Hint:", e.hint);
            }
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
    }, [currentDate, periodType, resources, user, authLoading, activeStudioId]);

    useEffect(() => {
        isMounted.current = true;
        fetchResources();
        fetchNotifications();
        
        const channel = supabase.channel('agenda-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { if (isMounted.current) fetchAppointments(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => { if (isMounted.current) fetchResources(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_blocks' }, () => { if (isMounted.current) fetchAppointments(); })
            .subscribe();

        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
            supabase.removeChannel(channel).catch(console.error);
        };
    }, [activeStudioId]);

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

    const mapRowToAppointment = (row: any, teamMembersList: LegacyProfessional[]): LegacyAppointment => {
        const start = new Date(row.date);
        const dur = row.duration || 30;
        
        let prof = teamMembersList.find(p => String(p.id) === String(row.professional_id));
        if (!prof && row.professional_name) {
            prof = teamMembersList.find(p => p.name.toLowerCase() === row.professional_name.toLowerCase());
        }

        const notes = row.notes || '';
        const servicesMatch = notes.match(/---SERVICES_JSON---\n([\s\S]*?)\n---END_SERVICES_JSON---/);
        let services = [];
        if (servicesMatch) {
            try {
                services = JSON.parse(servicesMatch[1]);
            } catch (e) {
                console.error("Error parsing services JSON:", e);
            }
        }

        return {
            id: row.id, start, end: new Date(start.getTime() + dur * 60000), status: row.status as AppointmentStatus,
            notas: row.notes || '', origin: row.origin || 'interno',
            type: row.type || 'appointment',
            services: services.length > 0 ? services : undefined,
            client: { id: row.client_id, nome: row.client_name || 'Cliente', consent: true },
            professional: prof || teamMembersList[0] || { id: 0, name: row.professional_name, avatarUrl: '' },
            service: { id: 0, name: row.service_name, price: Number(row.value), duration: dur, color: row.status === 'bloqueado' ? '#64748b' : (row.service_color || '#3b82f6') }
        } as LegacyAppointment;
    };

    const handleSaveAppointment = async (app: LegacyAppointment, force: boolean = false) => {
        console.log('📝 Iniciando handleSaveAppointment...', { 
            id: app.id, 
            studioId: activeStudioId,
            userRole: user?.papel,
            isForce: force
        });

        if (!activeStudioId) {
            console.error('❌ ERRO: activeStudioId não definido ao tentar salvar agendamento.');
            setToast({ message: '❌ Erro: Estúdio não selecionado. Por favor, recarregue a página.', type: 'error' });
            return;
        }
        setIsLoadingData(true);
        console.log('📝 Iniciando salvamento de agendamento...', { 
            id: app.id, 
            studioId: activeStudioId,
            client: app.client?.nome,
            professional: app.professional?.name,
            service: app.service?.name
        });
        
        try {
            const duration = Number(app.service.duration) || 30;
            const start = new Date(app.start);
            const end = addMinutes(start, duration);

            // 1. Conflict Detection
            if (!force && app.status !== 'cancelado') {
                const conflict = appointments.find(existing => {
                    // Skip self if editing
                    if (existing.id === app.id) return false;
                    
                    // Same professional
                    const existingProfId = existing.professional?.id;
                    const newProfId = app.professional?.id;
                    if (String(existingProfId) !== String(newProfId)) return false;

                    // Overlap check
                    const exStart = existing.start;
                    const exEnd = existing.end;

                    // Check for overlap: (StartA < EndB) and (EndA > StartB)
                    return (start < exEnd && end > exStart);
                });

                if (conflict) {
                    setPendingConflict({ 
                        newApp: { ...app, end }, 
                        conflictWith: {
                            client_name: conflict.client?.nome || 'Bloqueio',
                            service_name: conflict.service?.name || 'Indisponível'
                        }
                    });
                    setIsLoadingData(false);
                    return;
                }
            }

            const startStr = format(app.start, "yyyy-MM-dd'T'HH:mm:ssXXX");
            const endStr = format(end, "yyyy-MM-dd'T'HH:mm:ssXXX");

            const servicesMetadata = app.services && app.services.length > 0 
                ? `\n---SERVICES_JSON---\n${JSON.stringify(app.services)}\n---END_SERVICES_JSON---` 
                : '';

            const payload = { 
                studio_id: activeStudioId,
                professional_id: app.professional.id ? String(app.professional.id) : null, 
                client_id: app.client?.id ? app.client.id : null,
                client_name: app.client?.nome || 'Cliente', 
                professional_name: app.professional.name, 
                service_name: app.service.name, 
                value: Number(app.service.price) || 0, 
                duration: duration, 
                date: startStr, 
                start_at: startStr,
                end_at: endStr,
                status: app.status || 'agendado', 
                notes: (app.notas || '') + servicesMetadata, 
                service_color: app.service.color || '#3b82f6',
                origin: 'interno'
            };
            
            let newAppointment = null;
            try {
                if (app.id && typeof app.id === 'number' && app.id > 1000000000) { 
                    const { data, error } = await supabase.from('appointments').insert([payload]).select('*').single();
                    if (error) throw error;
                    newAppointment = data;
                } else if (app.id) {
                    const { error } = await supabase.from('appointments').update(payload).eq('id', app.id);
                    if (error) throw error;
                    const { data: updatedData } = await supabase.from('appointments').select('*').eq('id', app.id).single();
                    newAppointment = updatedData;
                } else {
                    const { data, error } = await supabase.from('appointments').insert([payload]).select('*').single();
                    if (error) throw error;
                    newAppointment = data;
                }
                console.log('✅ Agendamento salvo com sucesso no banco de dados:', newAppointment?.id);
                
                // Exibe sucesso do agendamento IMEDIATAMENTE após salvar no banco
                setToast({ message: '✅ Agendamento salvo com sucesso!', type: 'success' });
                setModalState(null); 
                setPendingConflict(null);
                await fetchAppointments();

            } catch (dbError: any) {
                console.error('❌ ERRO AO SALVAR NO BANCO DE DADOS:', dbError);
                const errorMessage = dbError.message || dbError.details || JSON.stringify(dbError);
                setToast({ 
                    message: `❌ Erro ao salvar: ${errorMessage}`, 
                    type: 'error' 
                });
                setIsLoadingData(false);
                throw dbError; 
            }

            // 2. Notificação (Etapa Separada e Não Bloqueante)
            if (newAppointment) {
                // Dispara a notificação sem dar await no fluxo principal se quisermos que seja ultra-rápido,
                // mas aqui vamos manter o await dentro de um try/catch isolado para poder mostrar o toast de aviso se falhar.
                (async () => {
                    console.log('📧 Iniciando tentativa de notificação por e-mail...');
                    
                    const notificationPayload = {
                        appointment_id: newAppointment.id,
                        studio_id: newAppointment.studio_id || activeStudioId,
                        client_name: newAppointment.client_name || app.client?.nome,
                        client_email: newAppointment.client_email || app.client?.email,
                        client_phone: newAppointment.client_whatsapp || app.client?.telefone || app.client?.whatsapp,
                        client_whatsapp: newAppointment.client_whatsapp || app.client?.whatsapp || app.client?.telefone,
                        professional_id: newAppointment.professional_id || app.professional?.id,
                        professional_name: newAppointment.professional_name || app.professional?.name,
                        service_name: newAppointment.service_name || app.service?.name,
                        start_at: newAppointment.start_at || app.start,
                        duration: newAppointment.duration || app.service?.duration,
                        total_amount: newAppointment.value || app.service?.price,
                        notes: newAppointment.notes || app.notas,
                        // Campos legados para compatibilidade
                        date: newAppointment.date,
                        start_time: newAppointment.start_time || format(new Date(newAppointment.start_at || app.start), 'HH:mm'),
                        value: newAppointment.value || app.service?.price
                    };

                    console.log('📦 Payload enviado para Edge Function:', notificationPayload);

                    try {
                        // Função auxiliar para chamada robusta com logs de debug
                        const invokeFunction = async () => {
                            try {
                                console.log('📡 [DEBUG] Chamando Edge Function via SDK (send-appointment-notification)...');
                                const { data, error: funcError } = await supabase.functions.invoke('send-appointment-notification', {
                                    body: notificationPayload
                                });
                                if (funcError) {
                                    console.error('❌ [DEBUG] Erro retornado pelo SDK:', funcError);
                                    return { error: funcError };
                                }
                                return { data };
                            } catch (err: any) {
                                console.warn('⚠️ [DEBUG] Exceção capturada no SDK:', err.message);
                                
                                // Fallback para fetch direto se o SDK falhar na rede ou por configuração
                                try {
                                    let directUrl = '';
                                    if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
                                        directUrl = `${supabaseUrl}/functions/v1/send-appointment-notification`;
                                    } else {
                                        // Converte https://project.supabase.co para https://project.functions.supabase.co
                                        directUrl = `${supabaseUrl.replace('.supabase.co', '.functions.supabase.co')}/send-appointment-notification`;
                                    }
                                    
                                    console.log(`🔗 [DEBUG] Tentando fetch direto como fallback: ${directUrl}`);
                                    
                                    const response = await fetch(directUrl, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${supabaseAnonKey}`,
                                            'apikey': supabaseAnonKey
                                        },
                                        mode: 'cors',
                                        body: JSON.stringify(notificationPayload)
                                    });
                                    
                                    if (!response.ok) {
                                        const errorText = await response.text();
                                        console.error(`❌ [DEBUG] Fetch direto falhou (Status: ${response.status}):`, errorText);
                                        return { error: new Error(response.status === 404 ? 'Edge Function não encontrada (404). Verifique se foi implantada.' : `Erro HTTP ${response.status}: ${errorText}`) };
                                    }
                                    const data = await response.json();
                                    return { data };
                                } catch (fetchErr: any) {
                                    console.error('❌ [DEBUG] Exceção no fetch direto:', fetchErr.message);
                                    return { error: fetchErr };
                                }
                            }
                        };

                        const result = await invokeFunction();
                        if (result.error) throw result.error;
                        const data = result.data;

                        if (data?.warning && !data?.notification_sent) {
                            console.warn('⚠️ [PARTIAL_SUCCESS] Agendamento salvo, mas notificação falhou:', data.warning);
                            setToast({ 
                                message: data.warning, 
                                type: 'warning' 
                            });
                        } else {
                            console.log('✅ [DEBUG] Notificação processada com sucesso!', data);
                        }
                    } catch (emailError: any) {
                        console.error('❌ [DEBUG] ERRO FINAL NA NOTIFICAÇÃO:', emailError);
                        
                        let errorMessage = 'Agendamento salvo, mas a notificação não pôde ser enviada.';
                        if (emailError.message) {
                            if (emailError.message.includes('Failed to send a request') || emailError.message.includes('404')) {
                                errorMessage = 'Agendamento salvo. Notificação pendente (Edge Function inacessível ou não implantada).';
                            } else {
                                errorMessage += ` (${emailError.message})`;
                            }
                        }

                        setToast({ 
                            message: errorMessage, 
                            type: 'warning' 
                        });
                    }
                })();
            }
            
        } catch (e: any) { 
            console.error('ERRO AO SALVAR AGENDAMENTO:', e);
            setToast({ 
                message: `❌ Erro: ${e.message || e.hint || 'Falha na comunicação com o banco'}`, 
                type: 'error' 
            }); 
            await fetchAppointments();
            throw e; // Re-throw para o modal saber que falhou
        } finally { 
            setIsLoadingData(false); 
        }
    };

    const handleDeleteBlock = async (e: React.MouseEvent, blockId: string | number) => {
        e.stopPropagation();
        
        const isConfirmed = await confirm({
            title: 'Remover Bloqueio',
            message: 'Deseja realmente remover este bloqueio de horário?',
            confirmText: 'Remover',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (!isConfirmed) return;

        try {
            const { error } = await supabase.from('schedule_blocks').delete().eq('id', blockId);
            if (error) throw error;
            setAppointments(prev => prev.filter(a => a.id !== blockId));
            toast.success('Horário liberado!');
        } catch (e: any) {
            toast.error('Erro ao remover bloqueio.');
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: AppointmentStatus) => {
        const appointment = appointments.find(a => a.id === id);
        if (!appointment) return;
        
        const isAdmin = user?.papel === 'admin' || user?.papel === 'gestor';
        if (!isAdmin && appointment.status === 'concluido') {
            setToast({ message: "Permissão Negada: Apenas o Gestor pode alterar registros concluídos.", type: 'error' });
            return;
        }

        if (appointment.status === 'concluido' && newStatus !== 'concluido') {
            const isConfirmed = await confirm({
                title: 'Estornar Lançamento',
                message: 'Atenção: O lançamento financeiro será ESTORNADO do caixa. Continuar?',
                confirmText: 'Sim, Estornar',
                cancelText: 'Cancelar',
                type: 'danger'
            });
            if (!isConfirmed) return;
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

    const handleConvertToCommand = async (appointment: LegacyAppointment) => {
        if (!activeStudioId) return;
        setIsLoadingData(true);
        try {
            // 1. Criar a comanda
            const { data: command, error: cmdError } = await supabase
                .from('commands')
                .insert([{
                    studio_id: activeStudioId,
                    client_id: appointment.client?.id || null,
                    client_name: appointment.client?.nome || 'Cliente',
                    professional_id: appointment.professional?.id || null,
                    status: 'open',
                    total_amount: appointment.service?.price || 0
                }])
                .select()
                .single();

            if (cmdError || !command) throw cmdError || new Error("Falha ao criar comanda");

            // 2. Criar o item da comanda
            const { error: itemError } = await supabase
                .from('command_items')
                .insert([{
                    command_id: command.id,
                    appointment_id: appointment.id,
                    service_id: appointment.service?.id || null,
                    studio_id: activeStudioId, 
                    title: appointment.service?.name || 'Serviço',
                    price: appointment.service?.price || 0,
                    quantity: 1,
                    professional_id: appointment.professional?.id || null
                }]);

            if (itemError) throw itemError;

            // 3. Atualizar status do agendamento
            const { error: apptUpdateError } = await supabase
                .from('appointments')
                .update({ status: 'concluido' })
                .eq('id', appointment.id);

            if (apptUpdateError) throw apptUpdateError;

            setToast({ message: `Comanda gerada com sucesso! Redirecionando... 💳`, type: 'success' });
            setActiveAppointmentDetail(null);
            
            if (onNavigateToCommand) {
                onNavigateToCommand(command.id);
            }
        } catch (e: any) {
            console.error("Falha ao gerar comanda:", e);
            setToast({ message: `Erro ao converter: ${e.message || 'Erro desconhecido'}`, type: 'error' });
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleDeleteAppointmentFull = async (id: number) => {
        console.log("🚀 INICIANDO FLUXO DE EXCLUSÃO COMPLETA");
        console.log("ID do Agendamento:", id);
        
        const appointment = appointments.find(a => a.id === id);
        if (!appointment) {
            console.error("❌ Agendamento não encontrado no estado local.");
            setToast({ message: "Erro: Agendamento não encontrado.", type: 'error' });
            return;
        }

        const isAdmin = user?.papel === 'admin' || user?.papel === 'gestor';
        const isFinished = appointment.status === 'concluido';

        if (!isAdmin && isFinished) {
            setToast({ 
                message: "Permissão Negada: Apenas o Gestor pode excluir registros concluídos.", 
                type: 'error' 
            });
            return;
        }

        const isConfirmed = await confirm({
            title: 'Excluir Agendamento',
            message: isFinished 
                ? "⚠️ ATENÇÃO: Este agendamento está CONCLUÍDO. A exclusão removerá permanentemente o registro, a comanda vinculada e as transações financeiras. Deseja continuar?"
                : "Deseja realmente apagar este agendamento?",
            confirmText: 'Sim, Excluir Tudo',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (!isConfirmed) return;
        
        setIsLoadingData(true);
        try {
            // 1. Buscar comandas vinculadas via itens
            console.log("🔍 Passo 1: Buscando comandas vinculadas...");
            const { data: items, error: fetchItemsError } = await supabase
                .from('command_items')
                .select('command_id')
                .eq('appointment_id', id);
            
            if (fetchItemsError) console.warn("Aviso ao buscar itens de comanda:", fetchItemsError);
            const commandIds = Array.from(new Set(items?.map(i => i.command_id).filter(Boolean) || []));
            console.log("Comandas encontradas:", commandIds);

            // 2. Deletar Transações Financeiras (Cascade Step 1)
            console.log("🗑️ Passo 2: Removendo transações financeiras...");
            // Deletamos por appointment_id E por command_id para garantir limpeza total
            const { error: finError } = await supabase
                .from('financial_transactions')
                .delete()
                .or(`appointment_id.eq.${id}${commandIds.length > 0 ? `,command_id.in.(${commandIds.join(',')})` : ''}`);
            
            if (finError) {
                console.error("Erro ao deletar transações:", finError);
                // Não paramos aqui, tentamos continuar
            }

            // 3. Deletar Itens de Comanda (Cascade Step 2)
            console.log("🗑️ Passo 3: Removendo itens de comanda...");
            const { error: itemError } = await supabase
                .from('command_items')
                .delete()
                .eq('appointment_id', id);
            
            if (itemError) console.error("Erro ao deletar itens:", itemError);

            // 4. Deletar Comandas (Cascade Step 3)
            if (commandIds.length > 0) {
                console.log("🗑️ Passo 4: Removendo comandas vazias...");
                const { error: cmdError } = await supabase
                    .from('commands')
                    .delete()
                    .in('id', commandIds);
                if (cmdError) console.error("Erro ao deletar comandas:", cmdError);
            }

            // 5. Deletar Agendamento (Final Step)
            console.log(`🗑️ Passo 5: Removendo agendamento principal (ID: ${id})...`);
            const { error: apptError } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);

            if (apptError) {
                console.error("❌ ERRO NO SUPABASE AO DELETAR AGENDAMENTO:", apptError);
                
                if (apptError.code === '42501') {
                    console.warn("⚠️ Política RLS detectada: Exclusão física não permitida para este usuário.");
                }

                // TENTATIVA DE SOFT DELETE SE O DELETE FÍSICO FALHAR (RLS ou FK)
                console.log("🔄 Iniciando Fallback (Soft Delete)...");
                const { error: softError } = await supabase
                    .from('appointments')
                    .update({ 
                        status: 'cancelado',
                        notes: (appointment.notas || '') + `\n[SISTEMA: Tentativa de exclusão física falhou em ${new Date().toLocaleString()}. Motivo: ${apptError.message}]`
                    })
                    .eq('id', id);

                if (softError) {
                    throw new Error(`Erro Supabase: ${apptError.message}. Fallback também falhou: ${softError.message}`);
                } else {
                    setToast({ message: 'Registro cancelado (exclusão física não permitida).', type: 'warning' });
                }
            } else {
                // Log de Auditoria apenas se a exclusão física funcionou
                if (isFinished) {
                    await supabase.from('audit_logs').insert([{
                        actor_id: user?.id,
                        actor_name: user?.nome,
                        action_type: 'DELETE_FULL',
                        entity: 'appointments',
                        entity_id: String(id),
                        old_value: { client: appointment.client?.nome, service: appointment.service.name }
                    }]);
                }
                setToast({ message: 'Registro e vínculos removidos com sucesso.', type: 'info' });
            }

            // Atualizar UI
            setAppointments(prev => prev.filter(p => p.id !== id));
            setActiveAppointmentDetail(null);
            
        } catch (e: any) {
            console.error("💥 FALHA CATASTRÓFICA:", e);
            setToast({ 
                message: `Erro: ${e.message || 'Falha na comunicação com o banco'}`, 
                type: 'error' 
            });
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
            const start = currentDate;
            const day = start.getDay();
            const diff = (day < 1 ? -6 : 1) - day;
            // FIX: Used getStartOfDay helper
            const weekStart = getStartOfDay(addDays(start, diff));

            return eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 1 }) }).map(day => ({ id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), subtitle: format(day, 'dd/MM'), type: 'date' as const, data: day }));
        }
        return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional' as const, data: p }));
    }, [periodType, currentDate, resources]);

    const filteredAppointments = useMemo(() => {
        const baseList = appointments.filter(a => {
            // 1. Filtro de Período (Data)
            let inPeriod;
            if (periodType === 'Dia' || periodType === 'Lista') inPeriod = isSameDay(a.start, currentDate);
            else if (periodType === 'Semana') {
                const day = currentDate.getDay();
                const diff = (day < 1 ? -6 : 1) - day;
                const weekStart = getStartOfDay(addDays(currentDate, diff));
                const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
                inPeriod = isWithinInterval(a.start, { start: weekStart, end: weekEnd });
            } else {
                inPeriod = isSameMonth(a.start, currentDate);
            }

            if (!inPeriod) return false;

            // 2. Filtro de Modo de Visualização (Status)
            if (viewMode === 'andamento') {
                // "Andamento" inclui tudo que não está finalizado, cancelado ou bloqueado
                const activeStatuses: AppointmentStatus[] = [
                    'agendado', 'confirmado', 'confirmado_whatsapp', 
                    'chegou', 'em_atendimento', 'em_espera'
                ];
                return activeStatuses.includes(a.status);
            }

            if (viewMode === 'pagamento') {
                // "Pagamento" foca nos concluídos que precisam de acerto (ou apenas concluídos para conferência)
                return a.status === 'concluido';
            }

            // Modo 'profissional' (Equipe) mostra tudo
            return true;
        });

        return [...baseList].sort((a, b) => (STATUS_PRIORITY[a.status] || 99) - (STATUS_PRIORITY[b.status] || 99) || a.start.getTime() - b.start.getTime());
    }, [appointments, periodType, currentDate, viewMode]);

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
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                Atendimentos {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
                            </h2>
                            <button onClick={handleCopyBookingLink} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Compartilhar">
                                <Share2 size={18} />
                            </button>
                            <button onClick={() => { console.log('🔔 Abrindo painel de notificações...'); setIsNotifOpen(true); }} className="relative p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Notificações">
                                <Bell size={18} />
                                {notificationCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                        {notificationCount}
                                    </span>
                                )}
                            </button>
                            <button onClick={fetchAppointments} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Atualizar">
                                <RefreshCw size={18} className={isLoadingData ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button onClick={() => setViewMode('profissional')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'profissional' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:bg-slate-200'}`}><LayoutGrid size={14} /> Equipe</button>
                            <button onClick={() => setViewMode('andamento')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'andamento' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:bg-slate-200'}`}><PlayCircle size={14} /> Andamento</button>
                            <button onClick={() => setViewMode('pagamento')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'pagamento' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:bg-slate-200'}`}><CreditCard size={14} /> Pagamento</button>
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

                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isAutoWidth ? '180px' : colWidth + 'px'}, 1fr))` }}>
                        
                        <div className="sticky left-0 z-[50] bg-white border-r border-slate-200 min-w-[60px] shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
                            {timeSlotsLabels.map(time => (
                                <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                    <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                </div>
                            ))}
                        </div>

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
                                {timeSlotsLabels.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed pointer-events-none"></div>)}
                                
                                {filteredAppointments
                                    .filter(app => {
                                        if (periodType === 'Semana') return isSameDay(app.start, col.data as Date);
                                        if (app.type === 'block' && (app.professional.id === null || String(app.professional.id) === 'null')) {
                                            return true;
                                        }
                                        return String(app.professional.id) === String(col.id); 
                                    })
                                    .map(app => {
                                        const durationMinutes = (app.end.getTime() - app.start.getTime()) / 60000;
                                        const isShort = durationMinutes <= 25;
                                        const cardColor = app.type === 'block' ? '#f87171' : (app.service.color || '#3b82f6');
                                        
                                        return (
                                            <div 
                                                key={app.id} 
                                                ref={(el) => { if (el && app.type === 'appointment') appointmentRefs.current.set(app.id, el); }} 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (app.type === 'appointment') {
                                                        setActiveAppointmentDetail(app); 
                                                    } else if (app.type === 'block') {
                                                        setModalState({ type: 'block', data: app });
                                                    }
                                                }} 
                                                className="rounded-none shadow-sm border-l-4 p-1.5 cursor-pointer hover:brightness-95 transition-all overflow-hidden flex flex-col group/card !m-0 border-r border-b border-slate-200/50"
                                                style={{ 
                                                    ...getAppointmentPosition(app.start, app.end, timeSlot),
                                                    borderLeftColor: cardColor,
                                                    backgroundColor: `${cardColor}15`
                                                }}
                                            >
                                                <div className="absolute top-1 right-1 flex gap-0.5 z-10">
                                                    {(app.origin === 'online' || app.origin === 'link') && (
                                                        <Globe size={10} className="text-orange-500 animate-pulse" strokeWidth={3} title="Agendamento Online" />
                                                    )}
                                                    {app.status === 'concluido' && <DollarSign size={10} className="text-emerald-600 font-bold" strokeWidth={3} />}
                                                    {['confirmado', 'confirmado_whatsapp'].includes(app.status) && <CheckCircle size={10} className="text-blue-600" strokeWidth={3} />}
                                                    {app.type === 'block' && <ShieldAlert size={10} className="text-rose-400" />}
                                                </div>

                                                <div className="flex flex-col h-full justify-between relative z-0 pointer-events-none">
                                                    <div>
                                                        <p className="text-[10px] font-medium text-slate-500 leading-none mb-0.5">
                                                            {format(app.start, 'HH:mm')} - {format(app.end, 'HH:mm')}
                                                        </p>
                                                        <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                                                            {app.type === 'block' ? 'INDISPONÍVEL' : (app.client?.nome || 'Bloqueado')}
                                                        </p>
                                                    </div>
                                                    {!isShort && (
                                                        <p className="text-[10px] text-slate-500 truncate leading-none mt-auto opacity-80">
                                                            {app.service.name}
                                                        </p>
                                                    )}
                                                </div>

                                                {app.type === 'block' && (
                                                    <button 
                                                        onClick={(e) => handleDeleteBlock(e, app.id)}
                                                        className="absolute bottom-1 right-1 p-1 bg-rose-500 text-white rounded opacity-0 group-hover/card:opacity-100 transition-all shadow-md z-30 pointer-events-auto"
                                                        title="Remover Bloqueio"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
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
                            <div className="p-1.5 bg-green-100 rounded-lg text-green-600"><ShoppingBag size={16} /></div> Novo Venda
                        </button>
                        <button onClick={() => { setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors"><div className="p-1.5 bg-rose-100 rounded-lg text-orange-600"><Ban size={16} /></div> Bloqueio</button>
                    </div>
                </>
            )}

            {isConfigModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsConfigModalOpen(false)}></div>
                    <div className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
                        <header className="flex justify-between items-center mb-8"><h3 className="font-extrabold text-slate-800">Configuração de Grade</h3><button onClick={() => setIsConfigModalOpen(false)}><X size={20} /></button></header>
                        <div className="space-y-4">
                            <label className="text-sm font-black text-slate-700 uppercase">Largura das Colunas: {colWidth}px</label>
                            <input type="range" min="150" max="450" step="10" value={colWidth} onChange={e => setColWidth(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500" />
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
                                <button key={item} onClick={() => { setPeriodType(item as any); setIsPeriodModalOpen(false); }} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all ${periodType === item ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'}`}>{item}{periodType === item && <Check size={18} />}</button>
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
                    onEdit={(app) => setModalState({ type: app.type === 'block' ? 'block' : 'appointment', data: app })} 
                    onDelete={handleDeleteAppointmentFull} 
                    onUpdateStatus={handleUpdateStatus}
                    onConvertToCommand={handleConvertToCommand}
                />
            )}
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
            {modalState?.type === 'block' && (
                <BlockTimeModal 
                    appointment={modalState.data.id ? modalState.data : undefined}
                    professional={modalState.data.professional} 
                    startTime={modalState.data.start} 
                    onClose={() => setModalState(null)} 
                    onSave={async () => {
                        await fetchAppointments();
                        setModalState(null);
                    }} 
                />
            )}
            {modalState?.type === 'sale' && <NewTransactionModal type="receita" onClose={() => setModalState(null)} onSave={(t) => { onAddTransaction(t); setModalState(null); setToast({ message: 'Venda registrada!', type: 'success' }); }} />}
            {pendingConflict && <ConflictAlertModal newApp={pendingConflict.newApp} conflictApp={pendingConflict.conflictWith} onConfirm={() => handleSaveAppointment(pendingConflict.newApp, true)} onCancel={() => setPendingConflict(null)} />}
            
            {isNotifOpen && (
                <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setIsNotifOpen(false)} />
                    <div className="fixed top-20 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[100] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">Notificações</h3>
                                <p className="text-xs text-slate-400 font-medium">Atividade Recente</p>
                            </div>
                            <button onClick={() => setIsNotifOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[70vh]">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                                    <Bell size={40} className="mb-3" />
                                    <p className="font-bold text-sm">Nenhuma notificação</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => handleMarkAsRead(n.id)}
                                        className="flex gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group/notif"
                                    >
                                        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center group-hover/notif:bg-orange-100 transition-colors">
                                            <CalendarDays size={18} className="text-orange-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs font-black text-slate-800">
                                                    {format(new Date(n.date), "dd/MMM/yy", { locale: pt })}
                                                    <span className="ml-2 text-slate-400 font-bold">
                                                        {format(new Date(n.date), "HH:mm")}
                                                    </span>
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                        n.status === 'cancelado' 
                                                            ? 'bg-red-50 text-red-500' 
                                                            : 'bg-green-50 text-green-600'
                                                    }`}>
                                                        {n.status === 'cancelado' ? 'Cancelamento' : 'Agendamento'}
                                                    </span>
                                                    <div className="w-2 h-2 bg-orange-400 rounded-full opacity-0 group-hover/notif:opacity-100 transition-opacity" title="Marcar como lida"></div>
                                                </div>
                                            </div>
                                            <p className="text-sm font-black text-slate-800 truncate">{n.service_name}</p>
                                            <p className="text-xs text-slate-500 truncate">Cliente: {n.client_name}</p>
                                            <p className="text-xs text-slate-400 truncate">Profissional: {n.professional_name}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-[10px] text-slate-300">
                                                    Agendado em {format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                                                </p>
                                                <span className="text-[9px] font-bold text-orange-400 opacity-0 group-hover/notif:opacity-100 transition-opacity">Limpar</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
            
            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
            <div className="fixed bottom-8 right-8 z-10"><button onClick={() => setIsJaciBotOpen(true)} className="w-16 h-16 bg-orange-500 rounded-3xl shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all"><MessageSquare className="w-8 h-8" /></button></div>
            <ConfirmDialogComponent />
        </div>
    );
};

export default AtendimentosView;