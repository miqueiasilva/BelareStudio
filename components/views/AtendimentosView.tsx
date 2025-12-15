
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { initialAppointments, professionals as mockProfessionals } from '../../data/mockData';
import { LegacyAppointment, LegacyProfessional, AppointmentStatus, FinancialTransaction } from '../../types';
import { format, addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, endOfMonth } from 'date-fns';
import { 
    ChevronLeft, ChevronRight, Plus, Edit, Lock, Trash2, MessageSquare, 
    ShoppingCart, FileText, Calendar as CalendarIcon, Share2, Bell, 
    RotateCcw, ChevronDown, List, Clock, Filter, DollarSign, CheckCircle, Circle 
} from 'lucide-react';
import ptBR from 'date-fns/locale/pt-BR';

import AppointmentModal from '../modals/AppointmentModal';
import BlockTimeModal from '../modals/BlockTimeModal';
import ContextMenu from '../shared/ContextMenu';
import JaciBotPanel from '../JaciBotPanel';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';

const START_HOUR = 8;
const END_HOUR = 20; // Extended for visibility
const PIXELS_PER_MINUTE = 80 / 60; // 80px for every 60 minutes

// --- Interfaces for Dynamic Columns ---

interface DynamicColumn {
    id: string | number;
    title: string;
    subtitle?: string;
    avatarUrl?: string;
    type: 'professional' | 'status' | 'payment' | 'date';
    data?: any; // To hold original object (Professional, Date, etc)
}

// --- Helper Functions ---

const getAppointmentStyle = (start: Date, end: Date) => {
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const top = (startMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE;
    const height = (endMinutes - startMinutes) * PIXELS_PER_MINUTE;
    return { top: `${top}px`, height: `${height - 4}px` };
};

const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
        case 'concluido': return 'bg-green-100 border-green-300 text-green-800 hover:ring-green-400';
        case 'bloqueado': return 'bg-slate-200 border-slate-300 text-slate-700 hover:ring-slate-400 pattern-diagonal-lines-sm pattern-slate-400 pattern-bg-slate-200 pattern-size-4 pattern-opacity-100';
        case 'confirmado': return 'bg-cyan-100 border-cyan-300 text-cyan-800 hover:ring-cyan-400';
        case 'confirmado_whatsapp': return 'bg-teal-100 border-teal-300 text-teal-800 hover:ring-teal-400';
        case 'chegou': return 'bg-purple-100 border-purple-300 text-purple-800 hover:ring-purple-400';
        case 'em_atendimento': return 'bg-indigo-100 border-indigo-300 text-indigo-800 hover:ring-indigo-400 animate-pulse';
        case 'faltou': return 'bg-orange-100 border-orange-300 text-orange-800 hover:ring-orange-400';
        case 'cancelado': return 'bg-rose-100 border-rose-300 text-rose-800 hover:ring-rose-400 line-through';
        case 'em_espera': return 'bg-stone-100 border-stone-300 text-stone-700 hover:ring-stone-400';
        case 'agendado':
        default: return 'bg-blue-100 border-blue-300 text-blue-800 hover:ring-blue-400';
    }
}

const TimelineIndicator = () => {
    const [topPosition, setTopPosition] = useState(0);
    React.useEffect(() => {
        const calculatePosition = () => {
            const now = new Date();
            const startOfDayMinutes = START_HOUR * 60;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (nowMinutes < startOfDayMinutes) {
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
                <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full"></div>
            </div>
        </div>
    );
};


// --- Main View Component ---

interface AtendimentosViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

type ViewType = 'Profissional' | 'Andamento' | 'Pagamento';
type PeriodType = 'Dia' | 'Semana' | 'Mês' | 'Lista' | 'Fila de Espera';

const AtendimentosView: React.FC<AtendimentosViewProps> = ({ onAddTransaction }) => {
    // --- State Management ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>(initialAppointments);
    const [visibleProfIds, setVisibleProfIds] = useState<number[]>(mockProfessionals.map(p => p.id));
    
    // View States
    const [viewType, setViewType] = useState<ViewType>('Profissional');
    const [periodType, setPeriodType] = useState<PeriodType>('Dia');
    
    // Dropdown States
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

    // Mobile State
    const [activeMobileProfId, setActiveMobileProfId] = useState<number>(mockProfessionals[0].id);
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileProfSidebarOpen, setIsMobileProfSidebarOpen] = useState(true); // New state for sidebar

    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block'; data: any } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; options: any[] } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [isJaciBotOpen, setIsJaciBotOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const columnRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());
    
    const viewDropdownRef = useRef<HTMLDivElement>(null);
    const periodDropdownRef = useRef<HTMLDivElement>(null);

    // --- Effects ---
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        handleResize();
        window.addEventListener('resize', handleResize);
        
        const handleClickOutside = (event: MouseEvent) => {
            if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) setIsViewDropdownOpen(false);
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) setIsPeriodDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);

        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        
        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // --- Logic: Date Navigation ---
    const handleDateChange = (direction: number) => {
        if (periodType === 'Dia' || periodType === 'Lista' || periodType === 'Fila de Espera') {
            setCurrentDate(prev => addDays(prev, direction));
        } else if (periodType === 'Semana') {
            setCurrentDate(prev => addWeeks(prev, direction));
        } else if (periodType === 'Mês') {
            setCurrentDate(prev => addMonths(prev, direction));
        }
    };

    const handleResetDate = () => setCurrentDate(new Date());

    // --- Logic: Dynamic Columns Generation ---
    const columns = useMemo<DynamicColumn[]>(() => {
        if (periodType === 'Semana') {
            // In Week view, columns are always Days of the week
            const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start, end });
            return days.map(day => ({
                id: day.toISOString(),
                title: format(day, 'EEE', { locale: ptBR }),
                subtitle: format(day, 'dd/MM'),
                type: 'date',
                data: day
            }));
        }

        if (viewType === 'Profissional') {
            // On mobile, show ALL filtered professionals to allow horizontal scrolling, 
            // instead of just the 'activeMobileProfId' one.
            // The sidebar will be used to scrollTo the column.
            const profs = mockProfessionals.filter(p => visibleProfIds.includes(p.id));
            
            return profs.map(p => ({
                id: p.id,
                title: p.name,
                avatarUrl: p.avatarUrl,
                type: 'professional',
                data: p
            }));
        }

        if (viewType === 'Andamento') {
            // Kanban columns
            return [
                { id: 'agendado', title: 'Agendados', type: 'status' },
                { id: 'confirmado', title: 'Confirmados', type: 'status' }, // Includes whatsapp/manual
                { id: 'chegou', title: 'Chegou', type: 'status' },
                { id: 'em_atendimento', title: 'Em Atendimento', type: 'status' },
                { id: 'concluido', title: 'Concluídos', type: 'status' }
            ];
        }

        if (viewType === 'Pagamento') {
             return [
                { id: 'pendente', title: 'A Pagar / Aberto', type: 'payment' },
                { id: 'pago', title: 'Pagos', type: 'payment' }
            ];
        }

        return [];
    }, [viewType, periodType, currentDate, visibleProfIds]);

    // --- Logic: Filtering Appointments for the View ---
    const filteredAppointments = useMemo(() => {
        let relevantApps = appointments;

        // 1. Date Filtering
        if (periodType === 'Dia') {
            relevantApps = appointments.filter(a => isSameDay(a.start, currentDate));
        } else if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            relevantApps = appointments.filter(a => isWithinInterval(a.start, { start, end }));
        } else if (periodType === 'Mês') {
             const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1); // Start of month manual
             const end = endOfMonth(currentDate);
             relevantApps = appointments.filter(a => isWithinInterval(a.start, { start, end }));
        } else if (periodType === 'Fila de Espera') {
            relevantApps = appointments.filter(a => a.status === 'em_espera');
        }
        // 'Lista' shows current day by default or could be all future. Let's stick to Day for Lista for consistency or range.
        if (periodType === 'Lista') {
             relevantApps = appointments.filter(a => isSameDay(a.start, currentDate));
        }

        return relevantApps;
    }, [appointments, periodType, currentDate]);

    // --- Logic: Assign Appointment to Column ---
    const getColumnForAppointment = (app: LegacyAppointment, cols: DynamicColumn[]) => {
        if (periodType === 'Semana') {
            return cols.find(c => isSameDay(app.start, c.data));
        }
        
        if (viewType === 'Profissional') {
            return cols.find(c => c.id === app.professional.id);
        }

        if (viewType === 'Andamento') {
            if (app.status === 'confirmado' || app.status === 'confirmado_whatsapp') return cols.find(c => c.id === 'confirmado');
            return cols.find(c => c.id === app.status);
        }

        if (viewType === 'Pagamento') {
            // Mock logic: 'concluido' assumes paid for this demo, others pending
            const isPaid = app.status === 'concluido'; 
            return cols.find(c => c.id === (isPaid ? 'pago' : 'pendente'));
        }

        return null;
    };

    const timeSlots = useMemo(() => Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => { 
        const hour = START_HOUR + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }), []);

    // --- Handlers ---
    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const handleMobileSidebarClick = (profId: number) => {
        setActiveMobileProfId(profId);
        // Smooth scroll to the professional's column
        const el = columnRefs.current.get(profId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    };

    const handleSaveAppointment = (app: LegacyAppointment) => {
        let isNew = false;
        setAppointments(prev => {
            const existing = prev.find(a => a.id === app.id);
            if (existing) return prev.map(a => a.id === app.id ? app : a);
            isNew = true;
            return [...prev, { ...app, id: Date.now() }];
        });
        setModalState(null);
        showToast(isNew ? 'Agendamento criado com sucesso!' : 'Agendamento atualizado com sucesso!', 'success');
    };
    
    const handleDeleteAppointment = (id: number) => {
        if (window.confirm("Tem certeza que deseja excluir este agendamento?")) {
            setAppointments(prev => prev.filter(a => a.id !== id));
            setActiveAppointmentDetail(null);
            showToast('Agendamento removido.', 'info');
        }
    };
    
    const handleStatusUpdate = (appointmentId: number, newStatus: AppointmentStatus) => {
        setAppointments(prev => prev.map(app => (app.id === appointmentId ? { ...app, status: newStatus } : app)));
        showToast(`Status alterado para ${newStatus.replace('_', ' ')}`, 'success');
    };
    
    const handleEditAppointment = (app: LegacyAppointment) => setModalState({ type: 'appointment', data: app });

    const handleNewAppointment = () => {
        const prof = isMobile ? mockProfessionals.find(p => p.id === activeMobileProfId) : undefined;
        setModalState({ type: 'appointment', data: { start: currentDate, professional: prof } });
    };

    const handleContextMenu = (e: React.MouseEvent, column: DynamicColumn) => {
        if (column.type !== 'professional' && column.type !== 'date') return;
        
        e.preventDefault();
        const gridEl = e.currentTarget as HTMLElement;
        const rect = gridEl.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        const minutesFromTop = y / PIXELS_PER_MINUTE;
        const totalMinutes = minutesFromTop + START_HOUR * 60;
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;

        // Determine date based on column type
        const baseDate = column.type === 'date' ? column.data : currentDate;
        const clickedTime = new Date(baseDate);
        clickedTime.setHours(hour, minute, 0, 0);
        
        // Manual rounding to nearest 15 mins
        const m = clickedTime.getMinutes();
        const roundedM = Math.round(m / 15) * 15;
        clickedTime.setMinutes(roundedM, 0, 0);
        const roundedTime = clickedTime;

        // Determine professional based on column type
        const prof = column.type === 'professional' ? column.data : undefined;

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            options: [
                { label: 'Novo Agendamento', icon: <Plus size={16}/>, onClick: () => setModalState({ type: 'appointment', data: { professional: prof, start: roundedTime } }) },
                { label: 'Bloquear Horário', icon: <Lock size={16}/>, onClick: () => setModalState({ type: 'block', data: { professional: prof, startTime: roundedTime } }) },
            ],
        });
    };

    // --- Render Components ---

    const DateDisplay = () => {
        let text = "";
        if (periodType === 'Dia' || periodType === 'Lista' || periodType === 'Fila de Espera') {
            text = format(currentDate, "EEE, dd 'de' MMMM", { locale: ptBR });
        } else if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            text = `${format(start, "dd MMM", { locale: ptBR })} - ${format(end, "dd MMM", { locale: ptBR })}`;
        } else if (periodType === 'Mês') {
            text = format(currentDate, "MMMM yyyy", { locale: ptBR });
        }
        return <span className="text-orange-500 font-bold text-lg capitalize px-2">{text.replace('.', '')}</span>;
    }

    return (
        <div className="flex h-full bg-white relative flex-col">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER */}
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Atendimentos</h2>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex items-center gap-2 text-slate-500">
                            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Compartilhar"><Share2 size={20} /></button>
                            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors relative" title="Notificações">
                                <Bell size={20} />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                            </button>
                            <button onClick={handleResetDate} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Atualizar / Hoje"><RotateCcw size={20} /></button>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                            {/* Period Dropdown */}
                            <div className="relative" ref={periodDropdownRef}>
                                <button onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                    {periodType} <ChevronDown size={16} />
                                </button>
                                {isPeriodDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                                        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Visualização</div>
                                        {['Dia', 'Semana', 'Mês', 'Lista', 'Fila de Espera'].map((item) => (
                                            <button key={item} onClick={() => { setPeriodType(item as PeriodType); setIsPeriodDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${periodType === item ? 'text-orange-600 font-semibold bg-orange-50' : 'text-slate-700'}`}>
                                                {item === 'Dia' && <CalendarIcon size={16}/>}
                                                {item === 'Semana' && <CalendarIcon size={16} className="rotate-90"/>}
                                                {item === 'Mês' && <CalendarIcon size={16}/>}
                                                {item === 'Lista' && <List size={16}/>}
                                                {item === 'Fila de Espera' && <Clock size={16}/>}
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={handleNewAppointment} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow-sm shadow-orange-200 transition-colors">Agendar</button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                    <div className="flex items-center gap-2 w-full md:w-auto justify-between">
                         <button onClick={handleResetDate} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-2">HOJE</button>
                        <div className="flex items-center gap-1">
                             <button onClick={() => handleDateChange(-1)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={20} /></button>
                             <button onClick={() => handleDateChange(1)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={20} /></button>
                        </div>
                        <DateDisplay />
                    </div>

                    {/* View Type Dropdown (Only show for Timeline views) */}
                    {(periodType === 'Dia' || periodType === 'Semana') && (
                        <div className="relative" ref={viewDropdownRef}>
                            <button onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)} className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900 uppercase tracking-wide">
                                {viewType === 'Profissional' ? 'Por Profissional' : viewType === 'Andamento' ? 'Por Andamento' : 'Por Pagamento'} <ChevronDown size={16} />
                            </button>
                            {isViewDropdownOpen && (
                                <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-2">
                                    <div className="px-4 py-2 text-xs font-semibold text-slate-400">Agrupar por</div>
                                    {['Profissional', 'Andamento', 'Pagamento'].map((item) => (
                                        <button key={item} onClick={() => { setViewType(item as ViewType); setIsViewDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-slate-50 ${viewType === item ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                                            <span>{item}</span>
                                            {viewType === item && <div className="w-2 h-2 rounded-full bg-orange-500"></div>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Professional Sidebar (Left Tabs) - Acts as Navigation Anchor */}
                {isMobile && periodType === 'Dia' && viewType === 'Profissional' && (
                    <>
                        {/* Sidebar Panel */}
                        <div 
                            className={`flex flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300 ease-in-out z-20 ${isMobileProfSidebarOpen ? 'w-20' : 'w-0 overflow-hidden'}`}
                        >
                            <div className="flex-1 overflow-y-auto scrollbar-hide py-4 flex flex-col items-center gap-4 w-20 pb-20">
                                {mockProfessionals.map(prof => (
                                    <button 
                                        key={prof.id} 
                                        onClick={() => handleMobileSidebarClick(prof.id)} 
                                        className={`relative group transition-all p-1 rounded-full ${activeMobileProfId === prof.id ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                                        title={prof.name}
                                    >
                                        <div className={`w-12 h-12 rounded-full p-0.5 ${activeMobileProfId === prof.id ? 'bg-gradient-to-tr from-orange-400 to-red-500 shadow-md' : 'bg-transparent border border-slate-300'}`}>
                                            <img src={prof.avatarUrl} alt={prof.name} className="w-full h-full rounded-full object-cover border-2 border-white" />
                                        </div>
                                        {activeMobileProfId === prof.id && (
                                            <div className="absolute right-0 bottom-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Toggle Button */}
                        <button 
                            onClick={() => setIsMobileProfSidebarOpen(!isMobileProfSidebarOpen)}
                            className="absolute z-30 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-r-lg p-1.5 shadow-md text-slate-500 hover:text-orange-500 transition-all"
                            style={{ left: isMobileProfSidebarOpen ? '5rem' : '0' }}
                        >
                            {isMobileProfSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                        </button>
                    </>
                )}

                {/* VIEW RENDERER */}
                <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-slate-50 md:bg-white relative">
                    
                    {/* 1. TIMELINE GRID (Dia / Semana) */}
                    {(periodType === 'Dia' || periodType === 'Semana') && (
                        <div className="relative min-h-full">
                            {/* Headers */}
                            <div className="grid sticky top-0 z-40 shadow-sm border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isMobile ? '170px' : '1fr'}, 1fr))` }}>
                                <div className="border-r border-slate-200 h-16 bg-white sticky left-0 z-50"></div>
                                {columns.map((col, index) => (
                                    <div key={col.id} ref={(el) => { if(el) columnRefs.current.set(col.id, el) }} className="flex flex-col items-center justify-center p-2 border-r border-slate-200 h-16 bg-slate-50/50">
                                        {col.type === 'professional' && (
                                            <div className="flex items-center gap-2">
                                                <img src={col.avatarUrl} alt={col.title} className="w-8 h-8 rounded-full border border-slate-200" />
                                                <span className="text-sm font-bold text-slate-800 truncate max-w-[120px]">{col.title}</span>
                                            </div>
                                        )}
                                        {col.type === 'status' && (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    col.id === 'agendado' ? 'bg-blue-400' : 
                                                    col.id === 'confirmado' ? 'bg-teal-400' : 
                                                    col.id === 'em_atendimento' ? 'bg-indigo-400' : 
                                                    'bg-green-400'
                                                }`}></div>
                                                <span className="text-sm font-bold text-slate-700">{col.title}</span>
                                            </div>
                                        )}
                                        {col.type === 'payment' && (
                                            <div className="flex items-center gap-2">
                                                {col.id === 'pago' ? <CheckCircle className="w-5 h-5 text-green-500"/> : <DollarSign className="w-5 h-5 text-orange-500"/>}
                                                <span className="text-sm font-bold text-slate-700">{col.title}</span>
                                            </div>
                                        )}
                                        {col.type === 'date' && (
                                            <>
                                                <span className={`text-xs uppercase font-bold ${isSameDay(col.data, new Date()) ? 'text-orange-600' : 'text-slate-500'}`}>{col.title}</span>
                                                <span className={`text-lg font-bold ${isSameDay(col.data, new Date()) ? 'text-orange-600' : 'text-slate-800'}`}>{col.subtitle}</span>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Grid Body */}
                            <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${columns.length}, minmax(${isMobile ? '170px' : '1fr'}, 1fr))` }}>
                                {/* Time Column */}
                                <div className="border-r border-slate-200 bg-white sticky left-0 z-30">
                                    {timeSlots.map(time => (
                                        <div key={time} className="h-20 text-right pr-2 text-xs text-slate-400 font-medium relative pt-2">
                                            <span className="-translate-y-1/2 block">{time}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Dynamic Columns */}
                                {columns.map((col, index) => {
                                    // Filter apps for this column
                                    const colApps = filteredAppointments.filter(app => {
                                        const assignedCol = getColumnForAppointment(app, columns);
                                        return assignedCol?.id === col.id;
                                    });

                                    return (
                                        <div 
                                            key={col.id} 
                                            className={`relative border-r border-slate-200 bg-white min-h-[1600px] ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                            onContextMenu={(e) => handleContextMenu(e, col)}
                                            onClick={(e) => {
                                                if (isMobile) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const y = e.clientY - rect.top;
                                                    const minutesFromTop = y / PIXELS_PER_MINUTE;
                                                    const totalMinutes = minutesFromTop + START_HOUR * 60;
                                                    const hour = Math.floor(totalMinutes / 60);
                                                    const minute = totalMinutes % 60;
                                                    const baseDate = col.type === 'date' ? col.data : currentDate;
                                                    
                                                    // Manual rounding/setting
                                                    const clickedTime = new Date(baseDate);
                                                    clickedTime.setHours(hour, minute, 0, 0);
                                                    const m = clickedTime.getMinutes();
                                                    const roundedM = Math.round(m / 30) * 30;
                                                    clickedTime.setMinutes(roundedM, 0, 0);
                                                    const roundedTime = clickedTime;

                                                    const prof = col.type === 'professional' ? col.data : undefined;
                                                    setModalState({ type: 'appointment', data: { professional: prof, start: roundedTime } });
                                                }
                                            }}
                                        >
                                            {/* Grid Lines */}
                                            {timeSlots.map((_, i) => <div key={i} className="h-20 border-b border-slate-100"></div>)}

                                            {/* Appointments */}
                                            {colApps.map(app => {
                                                const duration = (app.end.getTime() - app.start.getTime()) / (1000 * 60);
                                                const isSmall = duration < 45;

                                                return (
                                                <div
                                                    key={app.id}
                                                    ref={(el) => { appointmentRefs.current.set(app.id, el); }}
                                                    onClick={(e) => { e.stopPropagation(); if (app.status !== 'bloqueado') setActiveAppointmentDetail(app); }}
                                                    className={`absolute w-[95%] left-1/2 -translate-x-1/2 rounded-lg shadow-sm border leading-tight overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:z-10 ${getStatusColor(app.status)} ${isSmall ? 'p-0.5' : 'p-1.5'}`}
                                                    style={getAppointmentStyle(app.start, app.end)}
                                                >
                                                    <div style={{ backgroundColor: app.service.color }} className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg"></div>
                                                    
                                                    <div className={`flex flex-col h-full relative z-10 pl-2 pr-1 ${isSmall ? 'justify-center' : 'pt-0.5'}`}>
                                                        {/* Header: Time & Notes */}
                                                        <div className={`flex justify-between items-start ${isSmall ? 'mb-0' : 'mb-0.5'}`}>
                                                            <span className={`font-bold bg-white/60 rounded text-slate-700 backdrop-blur-sm shadow-sm tracking-tight ${isSmall ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'}`}>
                                                                {format(app.start, 'HH:mm')}
                                                            </span>
                                                            {app.notas && !isSmall && <FileText size={10} className="text-slate-500 ml-1 mt-0.5" />}
                                                        </div>

                                                        {/* Body: Client & Service */}
                                                        <div className={`flex-1 min-h-0 flex flex-col ${isSmall ? 'justify-center' : 'justify-center'}`}>
                                                            <p className={`font-extrabold text-slate-900 truncate ${isSmall ? 'text-[10px] leading-3' : 'text-sm leading-tight mb-0.5'}`}>
                                                                {app.client ? app.client.nome : 'Bloqueio'}
                                                            </p>
                                                            <p className={`font-medium text-slate-600 truncate flex items-center gap-1 ${isSmall ? 'text-[9px] leading-3' : 'text-[11px] leading-tight'}`}>
                                                                {app.service.name}
                                                            </p>
                                                        </div>

                                                        {/* Footer: Price (if Payment view) */}
                                                        {viewType === 'Pagamento' && !isSmall && (
                                                            <div className="mt-auto pt-1 flex items-center gap-1 text-[10px] font-bold text-green-700 opacity-90 border-t border-black/5">
                                                                <span>R$ {app.service.price.toFixed(2)}</span>
                                                                {app.status === 'concluido' && <span className="bg-green-200 px-1 rounded ml-auto text-[9px]">Pago</span>}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {app.status === 'confirmado_whatsapp' && <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-500 shadow-sm ring-1 ring-white" title="Confirmado via WhatsApp"></div>}
                                                </div>
                                            )})}
                                        </div>
                                    );
                                })}
                                <TimelineIndicator />
                            </div>
                        </div>
                    )}

                    {/* 2. LIST & WAITLIST VIEW */}
                    {(periodType === 'Lista' || periodType === 'Fila de Espera') && (
                        <div className="p-6 max-w-4xl mx-auto">
                             {filteredAppointments.length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <List size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>Nenhum agendamento encontrado para este período.</p>
                                </div>
                             ) : (
                                 <div className="space-y-4">
                                    {filteredAppointments
                                        .sort((a,b) => a.start.getTime() - b.start.getTime())
                                        .map(app => (
                                        <div key={app.id} onClick={() => setActiveAppointmentDetail(app)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-orange-300 transition-all cursor-pointer flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 text-center">
                                                    <p className="text-xl font-bold text-slate-800">{format(app.start, 'HH:mm')}</p>
                                                    <p className="text-xs text-slate-500">{format(app.start, 'dd/MM')}</p>
                                                </div>
                                                <div className="w-px h-10 bg-slate-200"></div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800">{app.client?.nome || 'Bloqueio'}</h4>
                                                    <p className="text-sm text-slate-500">{app.service.name} • com {app.professional.name}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${getStatusColor(app.status)}`}>{app.status.replace('_', ' ')}</span>
                                                <div className="font-bold text-slate-700">R$ {app.service.price.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    ))}
                                 </div>
                             )}
                        </div>
                    )}

                    {/* 3. MONTH VIEW (Simplified Grid) */}
                    {periodType === 'Mês' && (
                        <div className="p-4 h-full flex flex-col">
                            <div className="grid grid-cols-7 gap-1 flex-1">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                    <div key={d} className="text-center py-2 text-sm font-bold text-slate-400 uppercase">{d}</div>
                                ))}
                                {(() => {
                                    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                                    const end = endOfMonth(currentDate);
                                    const startDay = start.getDay(); // 0-6
                                    const daysInMonth = eachDayOfInterval({ start, end });
                                    const blanks = Array.from({ length: startDay }, (_, i) => i);

                                    return [
                                        ...blanks.map(b => <div key={`blank-${b}`} className="bg-slate-50/50 rounded-lg"></div>),
                                        ...daysInMonth.map(day => {
                                            const dayApps = filteredAppointments.filter(a => isSameDay(a.start, day));
                                            const isToday = isSameDay(day, new Date());
                                            return (
                                                <div key={day.toISOString()} className={`bg-white border rounded-lg p-2 min-h-[100px] flex flex-col gap-1 transition-shadow hover:shadow-md ${isToday ? 'border-orange-300 ring-1 ring-orange-100' : 'border-slate-200'}`}>
                                                    <span className={`text-sm font-bold mb-1 ${isToday ? 'text-orange-600' : 'text-slate-700'}`}>{format(day, 'dd')}</span>
                                                    {dayApps.slice(0, 3).map(app => (
                                                        <div key={app.id} className="text-[10px] truncate px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                                            {format(app.start, 'HH:mm')} {app.client?.nome.split(' ')[0]}
                                                        </div>
                                                    ))}
                                                    {dayApps.length > 3 && (
                                                        <div className="text-[10px] text-slate-400 text-center font-medium">
                                                            +{dayApps.length - 3} mais
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ];
                                })()}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Modals and Overlays */}
            {modalState?.type === 'appointment' && (
                <AppointmentModal key={modalState.data.id || 'new'} appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />
            )}
            {modalState?.type === 'block' && (
                <BlockTimeModal professional={modalState.data.professional} startTime={modalState.data.startTime} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />
            )}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenu.options} onClose={() => setContextMenu(null)} />}
            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
            
            {activeAppointmentDetail && (
                <AppointmentDetailPopover
                    appointment={activeAppointmentDetail}
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null}
                    onClose={() => setActiveAppointmentDetail(null)}
                    onEdit={handleEditAppointment}
                    onDelete={handleDeleteAppointment}
                    onUpdateStatus={handleStatusUpdate}
                />
            )}

             {/* JaciBot Floating Action Button */}
            <div className="fixed md:absolute bottom-6 right-6 z-30">
              <button onClick={() => setIsJaciBotOpen(true)} className="w-12 h-12 md:w-14 md:h-14 bg-orange-500 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-orange-600 transition ring-2 ring-white hover:scale-110 duration-200 shadow-orange-200">
                <MessageSquare className="w-6 h-6 md:w-7 md:h-7" />
                <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[10px] md:text-xs rounded-full flex items-center justify-center border-2 border-white">3</span>
              </button>
            </div>
        </div>
    );
};

export default AtendimentosView;
