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

const weekdaysNames = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado'
];

const getProfessionalColor = (profId: any, resourcesList: LegacyProfessional[]): string => {
    const defaultColors = [
        '#f97316', // Orange
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#14b8a6', // Teal
        '#f43f5e', // Rose
        '#a855f7', // Violet
    ];
    const index = resourcesList.findIndex(r => String(r.id) === String(profId));
    if (index === -1) return '#64748b'; // Slate fallback
    return defaultColors[index % defaultColors.length];
};

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'agendado': return '#f97316'; // Orange / Amber
        case 'confirmado': case 'confirmado_whatsapp': return '#3b82f6'; // Blue
        case 'chegou': return '#a855f7'; // Purple
        case 'em_atendimento': return '#10b981'; // Emerald
        case 'concluido': return '#10b981'; // Green
        case 'cancelado': return '#ef4444'; // Red
        case 'bloqueado': return '#64748b'; // Slate
        default: return '#3b82f6';
    }
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

const computeOverlappingLayouts = (appsInCol: LegacyAppointment[]) => {
    // Sort by start time, then by duration/end time
    const sorted = [...appsInCol].sort((a, b) => {
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) return startDiff;
        return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime()); // longer duration first
    });

    interface LayoutGroup {
        maxEnd: number;
        apps: LegacyAppointment[];
    }

    const groups: LayoutGroup[] = [];

    // Group into overlapping clusters
    for (const app of sorted) {
        let placed = false;
        // Check if this app overlaps with any existing group
        for (const g of groups) {
            // If the start time of the app is before the maximum end time of the group, it overlaps
            if (app.start.getTime() < g.maxEnd) {
                g.apps.push(app);
                if (app.end.getTime() > g.maxEnd) {
                    g.maxEnd = app.end.getTime();
                }
                placed = true;
                break;
            }
        }
        if (!placed) {
            groups.push({
                maxEnd: app.end.getTime(),
                apps: [app]
            });
        }
    }

    const layoutMap = new Map<number | string, { width: string; left: string; zIndex: number; isOverlapping: boolean }>();

    for (const g of groups) {
        const columns: LegacyAppointment[][] = [];
        
        for (const app of g.apps) {
            let colIndex = 0;
            while (true) {
                if (!columns[colIndex]) {
                    columns[colIndex] = [];
                }
                
                // Check if app overlaps with any app already in this column
                const hasOverlap = columns[colIndex].some(other => {
                    return app.start.getTime() < other.end.getTime() && other.start.getTime() < app.end.getTime();
                });
                
                if (!hasOverlap) {
                    columns[colIndex].push(app);
                    break;
                }
                colIndex++;
            }
        }

        const maxCols = columns.length;
        for (let c = 0; c < maxCols; c++) {
            for (const app of columns[c]) {
                const widthVal = 100 / maxCols;
                const leftVal = c * widthVal;
                const isOverlapping = maxCols > 1;
                // Add minor padding to overlapping cards to allow click/view with flawless styling
                const widthStr = isOverlapping ? `calc(${widthVal}% - 2px)` : '100%';
                const leftStr = isOverlapping ? `calc(${leftVal}% + 1px)` : '0px';

                layoutMap.set(app.id, {
                    width: widthStr,
                    left: leftStr,
                    zIndex: 20 + c,
                    isOverlapping
                });
            }
        }
    }

    return layoutMap;
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

    // Sidebar states for filters and layout customization
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [maxDisplayCount, setMaxDisplayCount] = useState(8);
    const [colorModeState, setColorModeState] = useState<'service' | 'professional' | 'status' | 'payment'>('service');
    const [enabledDays, setEnabledDays] = useState<boolean[]>([true, true, true, true, true, true, true]);
    const [selectedProfessional, setSelectedProfessional] = useState<number | 'all'>('all');
    const [isProfessionalDropdownOpen, setIsProfessionalDropdownOpen] = useState(false);
    const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
    const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);

    const getAppointmentColor = (app: any) => {
        if (app.type === 'block') return '#94a3b8'; // gray
        
        switch (colorModeState) {
            case 'professional':
                return getProfessionalColor(app.professional?.id, resources);
            case 'status':
                return getStatusColor(app.status);
            case 'payment':
                if (app.status === 'concluido') return '#10b981'; // Green
                if (app.status === 'cancelado' || app.status === 'faltou') return '#ef4444'; // Red
                return '#f59e0b'; // Amber
            case 'service':
            default:
                return app.service?.color || '#3b82f6';
        }
    };

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
        const link = `${window.location.origin}/#/public-preview?sid=${activeStudioId}`;
        navigator.clipboard.writeText(link).then(() => {
            setToast({ message: '🔗 Link da agenda copiado!', type: 'success' });
        });
    };

    const isMounted = useRef(true);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const gridScrollRef = useRef<HTMLDivElement>(null); 
    const dateInputRef = useRef<HTMLInputElement>(null);
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
            } else if (periodType === 'Mês') {
                const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
                const firstDayIdx = firstDay.getDay(); // 0 is Sunday
                const gridStart = addDays(firstDay, -firstDayIdx);
                rangeStart = getStartOfDay(gridStart);
                rangeEnd = endOfDay(addDays(gridStart, 41));
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

            const rawAppts = apptRes.data || [];
            const mappedBlocks = (blocksRes.data || []).map(row => ({
                id: row.id,
                start: new Date(row.start_time),
                end: new Date(row.end_time),
                professional: { id: row.professional_id },
                service: { name: row.reason, color: '#fca5a5' },
                status: 'bloqueado',
                type: 'block'
            }));

            // Exibe os agendamentos imediatamente para NUNCA ficar em branco
            if (isMounted.current && requestId === lastRequestId.current) {
                const initialMappedAppts = rawAppts.map(row => ({
                    ...mapRowToAppointment(row, resources),
                    type: row.type || 'appointment'
                }));
                setAppointments([...initialMappedAppts, ...mappedBlocks]);
            }

            // Enriquecimento assíncrono e isolado com os dados dos clientes (apelido, etc)
            if (rawAppts.length > 0) {
                const clientIds = Array.from(new Set(rawAppts.map(r => r.client_id).filter(Boolean)));
                if (clientIds.length > 0) {
                    try {
                        const { data: cData, error: cError } = await supabase
                            .from('clients')
                            .select('id, nome, apelido, whatsapp, email')
                            .in('id', clientIds);
                        
                        if (!cError && cData && cData.length > 0) {
                            const clientsMap = new Map(cData.map(c => [c.id, c]));
                            if (isMounted.current && requestId === lastRequestId.current) {
                                const enrichedAppts = rawAppts.map(row => {
                                    const enrichedRow = {
                                        ...row,
                                        clients: row.client_id ? clientsMap.get(row.client_id) : undefined
                                    };
                                    return {
                                        ...mapRowToAppointment(enrichedRow, resources),
                                        type: row.type || 'appointment'
                                    };
                                });
                                setAppointments([...enrichedAppts, ...mappedBlocks]);
                            }
                        }
                    } catch (enrichError) {
                        console.warn("Falha silenciosa ao enriquecer clientes do calendário:", enrichError);
                    }
                }
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
                .select('id, name, photo_url, role, active, show_in_calendar, order_index, services_enabled, work_schedule, email') 
                .eq('active', true)
                .eq('studio_id', activeStudioId)
                .order('order_index', { ascending: true }) 
                .order('name', { ascending: true });
            if (error) throw error;
            if (data && isMounted.current) {
                const mapped = data.filter((m: any) => m.show_in_calendar !== false).map((p: any) => ({
                    id: p.id, name: p.name, avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                    role: p.role, order_index: p.order_index || 0, services_enabled: p.services_enabled || [],
                    work_schedule: p.work_schedule || {},
                    email: p.email
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
        const servicesMatch = notes.match(/---SERVICES_JSON---[\r\n\s]*([\s\S]*?)[\r\n\s]*---END_SERVICES_JSON---/);
        let services = [];
        if (servicesMatch) {
            try {
                services = JSON.parse(servicesMatch[1]);
            } catch (e) {
                console.error("Error parsing services JSON:", e);
            }
        }

        let cleanNotes = notes;
        const jsonIndex = cleanNotes.indexOf('---SERVICES_JSON---');
        if (jsonIndex !== -1) {
            const endIndex = cleanNotes.indexOf('---END_SERVICES_JSON---');
            if (endIndex !== -1) {
                cleanNotes = (cleanNotes.substring(0, jsonIndex) + cleanNotes.substring(endIndex + '---END_SERVICES_JSON---'.length)).trim();
            } else {
                cleanNotes = cleanNotes.substring(0, jsonIndex).trim();
            }
        }
        cleanNotes = cleanNotes.replace(/\[Serviços:.*?\]/g, '').trim();

        return {
            id: row.id, start, end: new Date(start.getTime() + dur * 60000), status: row.status as AppointmentStatus,
            notas: cleanNotes, origin: row.origin || 'interno',
            type: row.type || 'appointment',
            services: services.length > 0 ? services : undefined,
            client: { 
                id: row.client_id, 
                nome: row.client_name || 'Cliente', 
                apelido: (Array.isArray(row.clients) ? row.clients[0]?.apelido : row.clients?.apelido) || undefined,
                consent: true 
            },
            professional: prof || teamMembersList[0] || { id: 0, name: row.professional_name, avatarUrl: '' },
            service: { id: 0, name: row.service_name, price: Number(row.value), duration: dur, color: row.status === 'bloqueado' ? '#64748b' : (row.service_color || '#3b82f6') }
        } as LegacyAppointment;
    };

    const handleSaveAppointment = async (app: LegacyAppointment, force: boolean = false) => {
        const isForce = force || (app as any).bypassScheduleCheck || (app as any).isForce;
        console.log('📝 Iniciando handleSaveAppointment...', { 
            id: app.id, 
            studioId: activeStudioId,
            userRole: user?.papel,
            isForce: isForce
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
            service: app.service?.name,
            isForce: isForce
        });
        
        try {
            const duration = Number(app.service.duration) || 30;
            const start = new Date(app.start);
            const end = addMinutes(start, duration);

            // 1. Conflict Detection
            if (!isForce && app.status !== 'cancelado') {
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

                // 1.1 Availability Detection
                const prof = resources.find(r => String(r.id) === String(app.professional?.id));
                if (prof?.work_schedule) {
                    const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][start.getDay()];
                    const config = prof.work_schedule[dayKey];
                    if (!config || !config.active) {
                        setToast({ message: `⚠️ O profissional não atende neste dia.`, type: 'warning' });
                        setIsLoadingData(false);
                        return;
                    }
                }

            // 1.2 Break Detection
                if (prof?.work_schedule) {
                    const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][start.getDay()];
                    const config = prof.work_schedule[dayKey];
                    if (config?.active && config.break_active) {
                        const bS = config.break_start || '12:00';
                        const bE = config.break_end || '13:00';
                        const [bSH, bSM] = bS.split(':').map(Number);
                        const [bEH, bEM] = bE.split(':').map(Number);
                        
                        const bStart = new Date(start);
                        bStart.setHours(bSH, bSM, 0, 0);
                        const bEnd = new Date(start);
                        bEnd.setHours(bEH, bEM, 0, 0);

                        if (start < bEnd && end > bStart) {
                             const isConfirmed = await confirm({
                                title: 'Conflito de Intervalo',
                                message: `O agendamento choca com o intervalo do profissional (${bS} - ${bE}). Deseja salvar como excessão (encaixe)?`,
                                confirmText: 'Salvar Encaixe',
                                cancelText: 'Voltar',
                                type: 'warning'
                            });
                            if (!isConfirmed) {
                                setIsLoadingData(false);
                                return;
                            }
                        }
                    }
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
                    
                    const profId = newAppointment.professional_id || app.professional?.id;
                    const professional = resources.find(r => String(r.id) === String(profId));
                    
                    const notificationPayload = {
                        appointment_id: newAppointment.id,
                        studio_id: newAppointment.studio_id || activeStudioId,
                        client_name: newAppointment.client_name || app.client?.nome,
                        client_email: newAppointment.client_email || app.client?.email,
                        client_phone: newAppointment.client_whatsapp || app.client?.telefone || app.client?.whatsapp,
                        client_whatsapp: newAppointment.client_whatsapp || app.client?.whatsapp || app.client?.telefone,
                        professional_id: profId,
                        professional_name: newAppointment.professional_name || app.professional?.name || professional?.name,
                        professional_email: professional?.email,
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

    const handleConvertToCommand = async (appointment: LegacyAppointment, sameDayApptIds?: number[]) => {
        if (!activeStudioId) return;
        setIsLoadingData(true);
        try {
            let apptsToConsolidate = [appointment];
            let totalAmount = appointment.service?.price || appointment.value || 0;

            if (sameDayApptIds && sameDayApptIds.length > 1) {
                const { data: fetchedAppts, error: fetchErr } = await supabase
                    .from('appointments')
                    .select('id, client_name, service_name, value, professional_id, professional_name, service_id')
                    .in('id', sameDayApptIds);

                if (!fetchErr && fetchedAppts && fetchedAppts.length > 0) {
                    apptsToConsolidate = fetchedAppts.map(appt => ({
                        id: appt.id,
                        client: { id: appointment.client?.id, nome: appointment.client?.nome || appt.client_name },
                        professional: { id: appt.professional_id, name: appt.professional_name },
                        service: { id: appt.service_id, name: appt.service_name, price: Number(appt.value || 0) },
                        service_name: appt.service_name,
                        value: Number(appt.value || 0),
                        professional_id: appt.professional_id
                    } as any));
                    totalAmount = apptsToConsolidate.reduce((acc, appt) => acc + Number(appt.value || 0), 0);
                }
            }

            // 1. Criar a comanda
            const firstAppt = apptsToConsolidate[0];
            const { data: command, error: cmdError } = await supabase
                .from('commands')
                .insert([{
                    studio_id: activeStudioId,
                    client_id: appointment.client?.id || null,
                    client_name: appointment.client?.nome || 'Cliente',
                    professional_id: appointment.professional?.id || null,
                    status: 'open',
                    total_amount: totalAmount
                }])
                .select()
                .single();

            if (cmdError || !command) throw cmdError || new Error("Falha ao criar comanda");

            // 2. Criar os itens da comanda
            const payloadItems = apptsToConsolidate.map(appt => ({
                command_id: command.id,
                appointment_id: appt.id,
                service_id: appt.service?.id || null,
                studio_id: activeStudioId, 
                title: appt.service_name || appt.service?.name || 'Serviço',
                price: Number(appt.value || appt.service?.price || 0),
                quantity: 1,
                professional_id: appt.professional?.id || appt.professional_id || null
            }));

            const { error: itemsError } = await supabase
                .from('command_items')
                .insert(payloadItems);

            if (itemsError) throw itemsError;

            // 3. Atualizar status de todos os agendamentos consolidados para 'concluido'
            const idsList = apptsToConsolidate.map(appt => appt.id);
            const { error: apptUpdateError } = await supabase
                .from('appointments')
                .update({ status: 'concluido' })
                .in('id', idsList);

            if (apptUpdateError) throw apptUpdateError;

            // 4. Atualizar o estado local dos agendamentos
            setAppointments(prev => prev.map(a => idsList.includes(a.id) ? { ...a, status: 'concluido' } : a));

            setToast({ message: `Comanda consolidada com sucesso! Redirecionando... 💳`, type: 'success' });
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

            return eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 1 }) })
                .filter(day => enabledDays[day.getDay()])
                .map(day => ({ id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), subtitle: format(day, 'dd/MM'), type: 'date' as const, data: day }));
        }
        return resources
            .filter(p => selectedProfessional === 'all' || String(p.id) === String(selectedProfessional))
            .map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional' as const, data: p }));
    }, [periodType, currentDate, resources, enabledDays, selectedProfessional]);

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

            // 2. Filtro de Profissional selecionado
            if (selectedProfessional !== 'all') {
                if (a.professional?.id && String(a.professional.id) !== String(selectedProfessional)) {
                    return false;
                }
            }

            // 3. Filtro de Dias da Semana (Exclui agendamentos em dias desabilitados)
            const dayOfWeek = a.start.getDay();
            if (!enabledDays[dayOfWeek]) {
                return false;
            }

            // 4. Filtro de Modo de Visualização (Status)
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
    }, [appointments, periodType, currentDate, viewMode, selectedProfessional, enabledDays]);

    const timeSlotsLabels = useMemo(() => {
        const labels = [];
        for (let i = 0; i < (END_HOUR - START_HOUR) * 60 / timeSlot; i++) {
            const minutes = i * timeSlot;
            labels.push(`${String(START_HOUR + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
        }
        return labels;
    }, [timeSlot]);

    const handleGridClick = async (e: React.MouseEvent | { currentTarget: HTMLElement; clientY: number; clientX: number }, professional: LegacyProfessional, colDate?: Date, bypassScheduleCheck = false) => {
        const currentTarget = e.currentTarget;
        const clientY = e.clientY;
        const clientX = e.clientX;
        
        if (!currentTarget) return;
        
        const rect = currentTarget.getBoundingClientRect();
        const minutes = ((clientY - rect.top) / (SLOT_PX_HEIGHT / timeSlot));
        const targetDate = new Date(colDate || currentDate);
        targetDate.setHours(Math.floor((START_HOUR * 60 + minutes) / 60), Math.round((START_HOUR * 60 + minutes) % 60 / 15) * 15, 0, 0);
        
        // Verificar se o profissional atende neste dia
        if (professional?.work_schedule && !bypassScheduleCheck) {
            const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][targetDate.getDay()];
            const config = professional.work_schedule[dayKey];
            if (!config || !config.active) {
                const isConfirmed = await confirm({
                    title: 'Abrir Exceção de Agenda',
                    message: `${professional.name} não atende aos ${['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'][targetDate.getDay()]}. Deseja abrir uma exceção e realizar o agendamento mesmo assim?`,
                    confirmText: 'Sim, Agendar',
                    cancelText: 'Voltar',
                    type: 'warning'
                });
                if (!isConfirmed) return;
            }
        }

        // Verificar se está no intervalo do profissional
        if (professional?.work_schedule) {
            const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][targetDate.getDay()];
            const config = professional.work_schedule[dayKey];
            if (config?.active && config.break_active) {
                const bS = config.break_start || '12:00';
                const bE = config.break_end || '13:00';
                
                const [startH, startM] = bS.split(':').map(Number);
                const [endH, endM] = bE.split(':').map(Number);
                
                const clickTime = targetDate.getHours() * 60 + targetDate.getMinutes();
                const bStart = startH * 60 + startM;
                const bEnd = endH * 60 + endM;
                
                if (clickTime >= bStart && clickTime < bEnd) {
                    const isConfirmed = await confirm({
                        title: 'Horário de Intervalo',
                        message: `Este horário coincide com o intervalo do profissional (${bS} - ${bE}). Deseja realizar um agendamento de encaixe?`,
                        confirmText: 'Sim, Encaixar',
                        cancelText: 'Voltar',
                        type: 'warning'
                    });
                    if (!isConfirmed) return;
                }
            }
        }

        setSelectionMenu({ x: clientX, y: clientY, time: targetDate, professional });
    };

    return (
        <div className="flex flex-row h-full w-full bg-white relative font-sans text-left overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* CONFIGURATIONS SIDEBAR */}
            {isSidebarOpen ? (
                <aside className="w-64 border-r border-slate-200 bg-white p-6 flex flex-col justify-start select-none h-full overflow-y-auto shrink-0 z-20 animate-in slide-in-from-left duration-200">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-extrabold text-slate-850 text-[11px] tracking-widest uppercase">
                            Filtros e Configurações
                        </h3>
                        <button 
                            onClick={() => setIsSidebarOpen(false)} 
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                    </div>

                    <div className="mb-6 relative">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                            Limite de Exibição
                        </label>
                        
                        <button 
                            onClick={() => { setIsLimitDropdownOpen(prev => !prev); setIsColorDropdownOpen(false); }} 
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left text-xs font-bold text-slate-700 transition-all select-none"
                        >
                            <span>
                                {maxDisplayCount === 100 
                                    ? 'Todos' 
                                    : maxDisplayCount === 1 
                                        ? 'Até 1 Atendimento' 
                                        : `Até ${maxDisplayCount} Atendimentos`
                                }
                            </span>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>

                        {isLimitDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsLimitDropdownOpen(false)}></div>
                                <div className="absolute left-0 mt-1.5 w-full bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-100 max-h-64 overflow-y-auto custom-scrollbar">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 100].map(val => (
                                        <button 
                                            key={val}
                                            onClick={() => { setMaxDisplayCount(val); setIsLimitDropdownOpen(false); }} 
                                            className={`w-full text-left px-4.5 py-2 text-xs font-bold transition-colors ${
                                                maxDisplayCount === val 
                                                    ? 'bg-orange-50 text-orange-600' 
                                                    : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {val === 100 
                                                ? 'Todos' 
                                                : val === 1 
                                                    ? 'Até 1 Atendimento' 
                                                    : `Até ${val} Atendimentos`
                                            }
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mb-6 relative">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                            Cores dos agendamentos
                        </label>
                        
                        <button 
                            onClick={() => { setIsColorDropdownOpen(prev => !prev); setIsLimitDropdownOpen(false); }} 
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left text-xs font-bold text-slate-700 transition-all select-none"
                        >
                            <span className="capitalize">
                                {colorModeState === 'service' && 'Por Serviço'}
                                {colorModeState === 'professional' && 'Por Profissional'}
                                {colorModeState === 'status' && 'Por Andamento'}
                                {colorModeState === 'payment' && 'Por Pagamento'}
                            </span>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>

                        {isColorDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsColorDropdownOpen(false)}></div>
                                <div className="absolute left-0 mt-1.5 w-full bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-100">
                                    {[
                                        { key: 'service', label: 'Por Serviço' },
                                        { key: 'professional', label: 'Por Profissional' },
                                        { key: 'status', label: 'Por Andamento' },
                                        { key: 'payment', label: 'Por Pagamento' }
                                    ].map(item => (
                                        <button 
                                            key={item.key}
                                            onClick={() => { setColorModeState(item.key as any); setIsColorDropdownOpen(false); }} 
                                            className={`w-full text-left px-4.5 py-2 text-xs font-bold transition-colors ${
                                                colorModeState === item.key 
                                                    ? 'bg-orange-50 text-orange-600' 
                                                    : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3">
                            Dias da Semana
                        </label>
                        
                        <div className="space-y-1">
                            {weekdaysNames.map((name, index) => (
                                <button
                                    key={name}
                                    onClick={() => {
                                        const updated = [...enabledDays];
                                        updated[index] = !updated[index];
                                        if (updated.some(Boolean)) {
                                            setEnabledDays(updated);
                                        }
                                    }}
                                    className="flex items-center gap-3 w-full py-1.5 hover:bg-slate-50 rounded-lg px-2 transition-colors text-left"
                                >
                                    <div className={`w-4.5 h-4.5 flex items-center justify-center rounded border transition-all ${
                                        enabledDays[index] 
                                            ? 'bg-slate-800 border-slate-800 text-white shadow-sm' 
                                            : 'border-slate-300 bg-white'
                                    }`}>
                                        {enabledDays[index] && <Check size={11} strokeWidth={4} />}
                                    </div>
                                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide capitalize">
                                        {name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            ) : (
                <button 
                    onClick={() => setIsSidebarOpen(true)} 
                    className="fixed bottom-6 left-6 p-3 bg-white hover:bg-slate-50 border border-slate-200 shadow-xl rounded-full text-slate-600 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 z-[999]"
                    title="Abrir Filtros"
                >
                    <SlidersHorizontal size={20} className="text-orange-500" />
                    <span className="text-xs font-bold pr-1 text-slate-700">Configurações</span>
                </button>
            )}

            <div className="flex-1 flex flex-col h-full overflow-hidden">
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
                        <button onClick={() => setIsSidebarOpen(prev => !prev)} className="p-2 rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 transition-all" title="Alternar Painel de Filtros"><SlidersHorizontal size={20} /></button>
                        <button onClick={() => setIsPeriodModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">{periodType} <ChevronDown size={16} /></button>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all active:scale-95">Agendar</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setCurrentDate(new Date())} 
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                        title="Ir para Hoje"
                    >
                        <CalendarIcon size={22} className="text-slate-600" />
                    </button>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl p-1 shadow-sm">
                        <button onClick={() => handleDateChange(-1)} className="p-1.5 hover:bg-white active:scale-95 transition-all rounded-xl text-slate-600"><ChevronLeft size={18} /></button>
                        <button onClick={() => handleDateChange(1)} className="p-1.5 hover:bg-white active:scale-95 transition-all rounded-xl text-slate-600"><ChevronRight size={18} /></button>
                    </div>
                    <div className="relative">
                        <button 
                            onClick={() => dateInputRef.current?.showPicker()} 
                            className="text-slate-750 hover:text-slate-900 font-extrabold text-base capitalize tracking-tight flex items-center gap-1.5 hover:bg-slate-50 px-3 py-1.5 rounded-2xl transition-all active:scale-95 cursor-pointer select-none"
                            title="Escolher outra data"
                        >
                            <span>
                                {['Mês', 'Lista'].includes(periodType) 
                                    ? format(currentDate, "MMMM 'de' yyyy", { locale: pt }) 
                                    : format(currentDate, "EEE, dd 'de' MMMM", { locale: pt })}
                            </span>
                        </button>
                        <input
                            type="date"
                            ref={dateInputRef}
                            className="absolute opacity-0 pointer-events-none w-0 h-0"
                            value={format(currentDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                if (e.target.value) {
                                    const [year, month, day] = e.target.value.split('-').map(Number);
                                    setCurrentDate(new Date(year, month - 1, day));
                                }
                            }}
                        />
                    </div>

                    {/* Professional selector dropdown exactly matching screenshot */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsProfessionalDropdownOpen(prev => !prev)} 
                            className="text-slate-800 hover:text-orange-600 font-bold text-base tracking-tight flex items-center gap-1 py-1.5 px-3 hover:bg-slate-50 rounded-2xl cursor-pointer select-none transition-colors"
                        >
                            <span>
                                {selectedProfessional === 'all' 
                                    ? 'Todos os Profissionais' 
                                    : (resources.find(r => String(r.id) === String(selectedProfessional))?.name || 'Profissional')
                                }
                            </span>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>
                        
                        {isProfessionalDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsProfessionalDropdownOpen(false)}></div>
                                <div className="absolute left-0 mt-2 w-64 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden py-3 z-50 animate-in fade-in slide-in-from-top-3 duration-150">
                                    <div className="px-5 py-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-50 mb-1">
                                        Visualização da agenda
                                    </div>
                                    
                                    <button 
                                        onClick={() => { setSelectedProfessional('all'); setIsProfessionalDropdownOpen(false); }} 
                                        className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-orange-50/50 hover:text-orange-600 transition-colors text-left"
                                    >
                                        <span>Todos os Profissionais</span>
                                        {selectedProfessional === 'all' && <Check size={16} className="text-orange-600" strokeWidth={3} />}
                                    </button>
                                    
                                    {resources.map(p => (
                                        <button 
                                            key={p.id}
                                            onClick={() => { setSelectedProfessional(p.id); setIsProfessionalDropdownOpen(false); }} 
                                            className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-orange-50/50 hover:text-orange-600 transition-colors text-left"
                                        >
                                            <span className="truncate">{p.name}</span>
                                            {String(selectedProfessional) === String(p.id) && <Check size={16} className="text-orange-600" strokeWidth={3} />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div 
                ref={gridScrollRef}
                className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar"
            >
                {(periodType === 'Dia' || periodType === 'Semana') ? (
                    <div className="min-w-fit animate-in fade-in duration-200">
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
                                    
                                    {(() => {
                                        const prof = col.type === 'professional' ? (col.data as LegacyProfessional) : null;
                                        const colDate = col.type === 'date' ? (col.data as Date) : currentDate;
                                        if (!prof || !prof.work_schedule) return null;

                                        const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][colDate.getDay()];
                                        const config = prof.work_schedule[dayKey];
                                        
                                        // Bloqueio de dia desativado
                                        if (!config || !config.active) {
                                            return (
                                                <div 
                                                    key="closed-overlay"
                                                    className="absolute inset-0 z-10 bg-slate-100/40 hover:bg-slate-100/20 flex flex-col items-center justify-center cursor-pointer transition-all group/closed !m-0"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const currentTarget = e.currentTarget;
                                                        const clientY = e.clientY;
                                                        const clientX = e.clientX;
                                                        const isConfirmed = await confirm({
                                                            title: 'Abrir Exceção de Agenda',
                                                            message: `${prof.name} não atende aos ${['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'][colDate.getDay()]}. Deseja abrir uma exceção e realizar um agendamento nesta data?`,
                                                            confirmText: 'Sim, Agendar',
                                                            cancelText: 'Voltar',
                                                            type: 'warning'
                                                        });
                                                        if (isConfirmed) {
                                                            handleGridClick({ currentTarget, clientY, clientX } as any, prof, colDate, true);
                                                        }
                                                    }}
                                                >
                                                    <div className="bg-white/95 px-4 py-2.5 rounded-2xl shadow-md border border-slate-200/80 flex flex-col items-center gap-1 group-hover/closed:scale-105 group-hover/closed:border-orange-200 transition-all">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Não Atende</span>
                                                        <span className="text-[8px] font-black text-orange-500 uppercase tracking-tighter leading-none mt-0.5">Abrir Exceção</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        
                                        if (config && config.active && config.break_active) {
                                            const bS = config.break_start || '12:00';
                                            const bE = config.break_end || '13:00';
                                            
                                            const [startH, startM] = bS.split(':').map(Number);
                                            const [endH, endM] = bE.split(':').map(Number);
                                            
                                            const startMinutes = (startH * 60 + startM) - (START_HOUR * 60);
                                            const endMinutes = (endH * 60 + endM) - (START_HOUR * 60);
                                            const duration = endMinutes - startMinutes;
                                            
                                            if (duration > 0) {
                                                const pixelsPerMinute = SLOT_PX_HEIGHT / timeSlot;
                                                const top = startMinutes * pixelsPerMinute;
                                                const height = duration * pixelsPerMinute;
                                                
                                                return (
                                                    <div 
                                                        key="break-overlay"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setToast({ message: '⚠️ Este horário é o intervalo do profissional.', type: 'warning' });
                                                        }}
                                                        className="absolute w-full left-0 z-[5] bg-slate-200/30 border-y border-slate-300/20 flex flex-col items-center justify-center cursor-not-allowed overflow-hidden shadow-inner"
                                                        style={{ 
                                                            top: `${top}px`, 
                                                            height: `${height}px`,
                                                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(203, 213, 225, 0.05) 10px, rgba(203, 213, 225, 0.05) 20px)'
                                                        }}
                                                    >
                                                        <div className="flex flex-col items-center opacity-60 pointer-events-none">
                                                            <Clock size={14} className="text-slate-400 mb-0.5" />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Intervalo</span>
                                                            <span className="text-[9px] font-bold text-slate-300">{config.break_start} - {config.break_end}</span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        }
                                        return null;
                                    })()}

                                    {(() => {
                                        const colApps = filteredAppointments.filter(app => {
                                            if (periodType === 'Semana') return isSameDay(app.start, col.data as Date);
                                            if (app.type === 'block' && (app.professional.id === null || String(app.professional.id) === 'null')) {
                                                return true;
                                            }
                                            return String(app.professional.id) === String(col.id); 
                                        });

                                        const layoutMap = computeOverlappingLayouts(colApps);

                                        return colApps.map(app => {
                                            const durationMinutes = (app.end.getTime() - app.start.getTime()) / 60000;
                                            const isShort = durationMinutes <= 25;
                                            const cardColor = getAppointmentColor(app);
                                            const layout = layoutMap.get(app.id) || { width: '100%', left: '0px', zIndex: 20, isOverlapping: false };
                                            
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
                                                    className={`rounded-none shadow-sm border-l-4 p-1.5 cursor-pointer hover:brightness-95 hover:shadow-md transition-all overflow-hidden flex flex-col group/card !m-0 border-r border-b border-slate-200/50 ${
                                                        layout.isOverlapping ? 'hover:scale-[1.01] hover:z-50' : ''
                                                    }`}
                                                    style={{ 
                                                        ...getAppointmentPosition(app.start, app.end, timeSlot),
                                                        width: layout.width,
                                                        left: layout.left,
                                                        zIndex: layout.zIndex,
                                                        borderLeftColor: cardColor,
                                                        backgroundColor: `${cardColor}15`
                                                    }}
                                                >
                                                    <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10">
                                                        {layout.isOverlapping && !isShort && (
                                                            <span className="bg-orange-100 text-[8px] font-black text-orange-600 px-1 py-0.5 rounded border border-orange-200 mr-1 scale-90 uppercase tracking-widest leading-none">
                                                                Encaixe
                                                            </span>
                                                        )}
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
                                                                {app.type === 'block' ? 'INDISPONÍVEL' : (app.client?.apelido || app.client?.nome || 'Bloqueado')}
                                                            </p>
                                                        </div>
                                                        {!isShort && (
                                                            <div className="mt-auto opacity-90 leading-none">
                                                                {app.services && app.services.length > 1 ? (
                                                                    <div className="flex flex-col gap-0.5 mt-1">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="inline-block px-1 py-0.5 bg-orange-100 text-[8px] font-extrabold text-orange-600 rounded border border-orange-200 uppercase tracking-widest leading-none">
                                                                                {app.services.length} Procedimentos
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[9px] font-bold text-slate-600 truncate leading-none mt-0.5" title={app.services.map(s => s.name).join(' + ')}>
                                                                            {app.services.map(s => s.name).join(' + ')}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-[10px] text-slate-500 truncate leading-none opacity-80">
                                                                        {app.service.name}
                                                                    </p>
                                                                )}
                                                            </div>
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
                                                         });
                                    })()}
                                </div>
                            ))}
                            <TimelineIndicator timeSlot={timeSlot} />
                        </div>
                    </div>
                ) : periodType === 'Mês' ? (
                    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-4 sm:p-6">
                            {/* Titulo do Mês/Ano */}
                            <div className="text-center font-black text-xl text-slate-800 mb-6 flex flex-col items-center justify-center">
                                <span className="capitalize tracking-tight text-slate-900 text-lg sm:text-xl">
                                    {format(currentDate, "MMMM'/'yyyy", { locale: pt })}
                                </span>
                            </div>

                            {/* Dias da semana */}
                            <div 
                                className="grid gap-1 sm:gap-2 text-center border-b border-slate-100 pb-3 mb-3"
                                style={{ gridTemplateColumns: `repeat(${enabledDays.filter(Boolean).length}, minmax(0, 1fr))` }}
                            >
                                {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
                                    .filter((_, idx) => enabledDays[idx])
                                    .map(day => (
                                        <span key={day} className="text-[11px] font-extrabold text-slate-500 lowercase tracking-wide">
                                            {day}
                                        </span>
                                    ))
                                }
                            </div>

                            {/* Grade de dias do mês */}
                             <div 
                                className="grid gap-2 sm:gap-2.5"
                                style={{ gridTemplateColumns: `repeat(${enabledDays.filter(Boolean).length}, minmax(0, 1fr))` }}
                            >
                                {(() => {
                                    const year = currentDate.getFullYear();
                                    const month = currentDate.getMonth();

                                    const firstDay = new Date(year, month, 1);
                                    const lastDay = new Date(year, month + 1, 0);

                                    const calendarStart = getStartOfDay(addDays(firstDay, -firstDay.getDay()));
                                    const calendarEnd = addDays(lastDay, 6 - lastDay.getDay());

                                    const allPossibleDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                                    
                                    const cells = allPossibleDays
                                        .filter(day => enabledDays[day.getDay()])
                                        .map(day => ({
                                            dayNum: day.getDate(),
                                            dateObj: day,
                                            isCurrentMonth: day.getMonth() === month
                                        }));

                                    const dummySkip = true;
                                    if (!dummySkip) {
                                    const firstDayIdx = firstDay.getDay(); 
                                    const totalDays = new Date(year, month + 1, 0).getDate();
                                    
                                    const cells = [];

                                    // Dias do mês anterior
                                    const prevMonthEnd = new Date(year, month, 0).getDate();
                                    for (let i = firstDayIdx - 1; i >= 0; i--) {
                                        const dayNum = prevMonthEnd - i;
                                        const dateObj = new Date(year, month - 1, dayNum);
                                        cells.push({ dayNum, dateObj, isCurrentMonth: false });
                                    }

                                    // Dias do mês atual
                                    for (let i = 1; i <= totalDays; i++) {
                                        const dateObj = new Date(year, month, i);
                                        cells.push({ dayNum: i, dateObj, isCurrentMonth: true });
                                    }

}

                                    return cells.map((cell, idx) => {
                                        const isToday = isSameDay(cell.dateObj, new Date());
                                        const isSelected = isSameDay(cell.dateObj, currentDate);
                                        
                                        // Busca agendamentos deste dia específico
                                        const dayAppts = filteredAppointments.filter(a => isSameDay(a.start, cell.dateObj));
                                        
                                        // Ordena por horário de início
                                        const sortedAppts = [...dayAppts].sort((a, b) => a.start.getTime() - b.start.getTime());

                                        const LIMIT_COUNT = maxDisplayCount;
                                        const hasMore = sortedAppts.length > LIMIT_COUNT;
                                        const itemsToRender = hasMore ? sortedAppts.slice(0, LIMIT_COUNT - 1) : sortedAppts;

                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    setCurrentDate(cell.dateObj);
                                                    setPeriodType('Dia');
                                                }}
                                                className={`min-h-[175px] sm:min-h-[230px] bg-white border rounded-2xl p-2 flex flex-col justify-start hover:ring-2 hover:ring-orange-100 hover:border-orange-300 relative group/cell cursor-pointer transition-all duration-200 ${
                                                    cell.isCurrentMonth 
                                                        ? 'border-slate-200 text-slate-805' 
                                                        : 'border-slate-100 text-slate-350 bg-slate-50/[0.22]'
                                                } ${
                                                    isSelected && cell.isCurrentMonth
                                                        ? 'ring-2 ring-orange-400 border-orange-400 bg-orange-50/[0.01]'
                                                        : ''
                                                }`}
                                            >
                                                {/* Cabeçalho do dia */}
                                                <div className="flex justify-center items-center py-1 bg-transparent w-full pointer-events-none mb-2">
                                                    <span className={`text-[11px] sm:text-xs font-black tracking-tight flex items-center justify-center ${
                                                        isToday 
                                                            ? 'w-6 h-6 bg-orange-500 text-white rounded-full font-bold shadow-sm shadow-orange-100 text-xs' 
                                                            : cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                                                    }`}>
                                                        {format(cell.dateObj, 'dd')}
                                                    </span>
                                                </div>

                                                {/* Lista vertical de agendamentos */}
                                                <div className="space-y-1 w-full flex-grow flex flex-col justify-start overflow-hidden">
                                                    {itemsToRender.map((app, index) => {
                                                        const cardColor = getAppointmentColor(app);
                                                        const itemStyle = app.type === 'block'
                                                            ? { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#1e293b' }
                                                            : { backgroundColor: `${cardColor}20`, borderColor: `${cardColor}40`, color: '#0f172a' };

                                                        return (
                                                            <div 
                                                                key={app.id || index}
                                                                ref={(el) => { if (el && app.type === 'appointment') appointmentRefs.current.set(app.id, el); }} 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    if (app.type === 'appointment') {
                                                                        setActiveAppointmentDetail(app); 
                                                                    } else if (app.type === 'block') {
                                                                        setModalState({ type: 'block', data: app });
                                                                    }
                                                                }} 
                                                                className="text-[9.5px] sm:text-[10px] md:text-[10.5px] font-bold px-1.5 py-1 rounded-lg border truncate cursor-pointer hover:brightness-95 active:scale-95 transition-all flex items-center gap-1 select-none w-full"
                                                                style={itemStyle}
                                                                title={app.type === 'block' ? 'Bloqueio' : (app.client?.apelido || app.client?.nome || 'Cliente')}
                                                            >
                                                                <span className="font-extrabold opacity-80 shrink-0 select-none">
                                                                    {format(app.start, 'HH:mm')}
                                                                </span>
                                                                <span className="truncate select-none">
                                                                    {app.type === 'block' 
                                                                        ? (app.notes || 'Bloqueio') 
                                                                        : `${app.client?.apelido || app.client?.nome || 'Cliente'}${app.service?.name ? `, ${app.service.name}` : ''}`
                                                                    }
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                    
                                                    {hasMore && (
                                                        <div className="flex items-center justify-center py-0.5 text-slate-400 font-extrabold text-[12px] leading-none select-none">
                                                            •••
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
                        <div className="flex flex-col gap-4">
                            {(() => {
                                const monthAppts = appointments.filter(a => isSameMonth(a.start, currentDate));
                                
                                if (monthAppts.length === 0) {
                                    return (
                                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center">
                                                <CalendarDays size={28} />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="font-extrabold text-slate-800 text-sm uppercase">Nenhum atendimento este mês</h4>
                                                <p className="text-xs text-slate-400 font-bold">Use as setas no topo para navegar ou criar novos agendamentos.</p>
                                            </div>
                                        </div>
                                    );
                                }

                                const groups: Record<string, typeof appointments> = {};
                                monthAppts.forEach(app => {
                                    const key = format(app.start, 'yyyy-MM-dd');
                                    if (!groups[key]) groups[key] = [];
                                    groups[key].push(app);
                                });

                                const sortedDays = Object.keys(groups).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

                                return sortedDays.map(dayKey => {
                                    const dayDate = new Date(dayKey + 'T12:00:00');
                                    const dayApps = groups[dayKey].sort((a, b) => a.start.getTime() - b.start.getTime());

                                    return (
                                        <div key={dayKey} className="space-y-2 pb-2">
                                            <h4 className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 pt-2 flex items-center gap-2">
                                                <CalendarIcon size={12} className="text-orange-500" />
                                                {format(dayDate, "EEEE, dd 'de' MMMM", { locale: pt })}
                                            </h4>
                                            <div className="space-y-2">
                                                {dayApps.map(app => {
                                                    const cardColor = getAppointmentColor(app);
                                                    const isBlocked = app.type === 'block';

                                                    return (
                                                        <div 
                                                            key={app.id}
                                                            onClick={() => {
                                                                if (app.type === 'appointment') {
                                                                    setActiveAppointmentDetail(app);
                                                                } else if (app.type === 'block') {
                                                                    setModalState({ type: 'block', data: app });
                                                                }
                                                            }}
                                                            className="bg-white rounded-[24px] border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4"
                                                            style={{ borderLeftColor: cardColor }}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="flex flex-col items-center justify-center px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs font-bold text-slate-500">
                                                                    <span>{format(app.start, 'HH:mm')}</span>
                                                                    <span className="text-[9px] opacity-40 leading-none my-0.5">às</span>
                                                                    <span className="mt-0.5">{format(app.end, 'HH:mm')}</span>
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <h5 className="font-extrabold text-slate-800 text-sm truncate leading-tight">
                                                                            {isBlocked ? 'Horário Bloqueado' : (app.client?.apelido || app.client?.nome || 'Bloqueado')}
                                                                        </h5>
                                                                        {app.type === 'block' && (
                                                                            <span className="text-[8px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-lg uppercase tracking-wider">
                                                                                Bloqueio
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {!isBlocked && (
                                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                                                                            <span className="font-bold text-orange-500">{app.service_name || app.service?.name}</span>
                                                                            <span className="text-slate-350 font-normal">•</span>
                                                                            <span className="flex items-center gap-1 font-medium text-slate-400">
                                                                                <User size={10} /> {app.professional_name || app.professional?.name}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {isBlocked && (
                                                                        <p className="text-xs text-slate-400 font-bold mt-0.5">Motivo: {app.service?.name}</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between sm:justify-end gap-3.5 border-t sm:border-t-0 border-slate-50 pt-3 sm:pt-0">
                                                                {!isBlocked && (
                                                                    <span className="text-sm font-black text-slate-750 font-mono">
                                                                        R$ {Number(app.value || app.service?.price || 0).toFixed(2)}
                                                                    </span>
                                                                )}

                                                                {!isBlocked && (
                                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl leading-none font-bold ${
                                                                        app.status === 'concluido' ? 'bg-emerald-50 text-emerald-600 border border-emerald-110' :
                                                                        ['confirmado', 'confirmado_whatsapp'].includes(app.status) ? 'bg-blue-50 text-blue-600 border border-blue-110' :
                                                                        app.status === 'cancelado' ? 'bg-red-50 text-red-600 border border-red-110' :
                                                                        'bg-amber-50 text-amber-600 border border-amber-110'
                                                                    }`}>
                                                                        {app.status === 'concluido' ? 'Concluído' :
                                                                         ['confirmado', 'confirmado_whatsapp'].includes(app.status) ? 'Confirmado' :
                                                                         app.status === 'cancelado' ? 'Cancelado' :
                                                                         'Agendado'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                )}
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
            </div>
            
            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
            <div className="fixed bottom-8 right-8 z-[60]"><button onClick={() => setIsJaciBotOpen(true)} className="w-16 h-16 bg-orange-500 rounded-3xl shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all"><MessageSquare className="w-8 h-8" /></button></div>
            <ConfirmDialogComponent />
        </div>
    );
};

export default AtendimentosView;