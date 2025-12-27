
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    Maximize2, LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, AlertTriangle,
    Ban, ShoppingBag, Plus, Filter, Users, User as UserIcon, ZoomIn, Clock as ClockIcon,
    ChevronFirst, ChevronLast, GripVertical, DollarSign, Share2, Bell, Copy, CheckCircle2, Link as LinkIcon
} from 'lucide-react';
import { format, addDays, addMinutes, startOfWeek, endOfWeek, parseISO, isSameDay } from 'date-fns';
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

const getAppointmentPosition = (isoDateString: string, duration: number) => {
    const timePart = isoDateString.split('T')[1] || "00:00:00";
    const [hours, minutes] = timePart.split(':').map(Number);
    const appointmentMinutes = (hours * 60) + minutes;
    const startDayMinutes = START_HOUR * 60;
    const top = Math.max(0, (appointmentMinutes - startDayMinutes) * PIXELS_PER_MINUTE);
    const height = duration * PIXELS_PER_MINUTE;
    return { top: `${top}px`, height: `${height - 2}px` };
};

const getCardStyle = (app: LegacyAppointment, viewMode: ViewMode) => {
    const baseClasses = "absolute left-0 right-0 mx-1 rounded-lg shadow-sm border-l-4 p-2 cursor-grab active:cursor-grabbing z-10 hover:shadow-md transition-all overflow-hidden flex flex-col gap-0.5 select-none";
    
    if (viewMode === 'pagamento') {
        return app.status === 'concluido' 
            ? `${baseClasses} bg-emerald-50 border-emerald-500 text-emerald-900`
            : `${baseClasses} bg-rose-50 border-rose-500 text-rose-900`;
    }

    switch (app.status) {
        case 'concluido': return `${baseClasses} bg-slate-50 border-slate-400 text-slate-500 opacity-60`;
        case 'bloqueado': return `${baseClasses} bg-slate-100 border-slate-300 text-slate-400 opacity-70 border-dashed`;
        case 'confirmado':
        case 'confirmado_whatsapp': return `${baseClasses} bg-green-50 border-green-500 text-green-900`;
        case 'em_atendimento': return `${baseClasses} bg-indigo-50 border-indigo-500 text-indigo-900 animate-pulse`;
        default: return `${baseClasses} bg-blue-50 border-blue-600 text-blue-900`; // BelaFlow Style
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

type ViewMode = 'profissional' | 'andamento' | 'pagamento';

const AtendimentosView: React.FC<{ onAddTransaction: (t: FinancialTransaction) => void }> = ({ onAddTransaction }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<(LegacyAppointment & { rawDate: string })[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [visibleProfIds, setVisibleProfIds] = useState<number[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    
    // UI States
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isAutoWidth, setIsAutoWidth] = useState(true);
    const [colWidth, setColWidth] = useState(240);
    const [timeSlot, setTimeSlot] = useState(30);
    const [viewMode, setViewMode] = useState<ViewMode>('profissional');
    const [calendarMode, setCalendarMode] = useState<'Dia' | 'Semana' | 'Mês' | 'Lista' | 'Fila de Espera'>('Dia');
    
    // Menu & Modal States
    const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
    const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    // Modals & Popovers
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block' | 'sale'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });
    
    const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, time: Date, professional: LegacyProfessional } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const viewMenuRef = useRef<HTMLDivElement>(null);
    const periodMenuRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef(true);

    const refreshCalendar = useCallback(async () => {
        if (!isMounted.current) return;
        console.log("Refresh disparado - Buscando novos dados no Supabase...");
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase.from('appointments').select('*');
            if (error) throw error;
            if (data) {
                const mapped = data.map(row => {
                    const start = parseISO(row.date);
                    const dur = row.duration || 30;
                    return {
                        id: row.id,
                        rawDate: row.date,
                        start,
                        end: new Date(start.getTime() + dur * 60000),
                        status: row.status as AppointmentStatus,
                        notas: row.notes || '',
                        client: { id: 0, nome: row.client_name || 'Bloqueado', consent: true },
                        professional: resources.find(p => p.id === Number(row.resource_id)) || { id: 0, name: row.professional_name, avatarUrl: '' },
                        service: { id: 0, name: row.service_name, price: Number(row.value), duration: dur, color: '#3b82f6' }
                    } as LegacyAppointment & { rawDate: string };
                });
                setAppointments(mapped);
                console.log("Agenda sincronizada com sucesso!");
            }
        } catch (e: any) { console.error("Erro ao sincronizar agenda:", e); } 
        finally { setIsLoadingData(false); }
    }, [resources]);

    useEffect(() => {
        const fetchResources = async () => {
            const { data } = await supabase.from('professionals').select('*').order('name');
            if (data) {
                const mapped = data.map(p => ({ id: p.id, name: p.name, avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}`, role: p.role }));
                setResources(mapped);
                setVisibleProfIds(mapped.map(m => m.id));
            }
        };
        fetchResources();

        const handleClickOutside = (event: MouseEvent) => {
            if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
                setIsViewMenuOpen(false);
            }
            if (periodMenuRef.current && !periodMenuRef.current.contains(event.target as Node)) {
                setIsPeriodMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => { if (resources.length > 0) refreshCalendar(); }, [resources, currentDate, refreshCalendar]);

    const filteredProfessionals = useMemo(() => resources.filter(p => visibleProfIds.includes(p.id)), [resources, visibleProfIds]);
    
    const timeSlotsLabels = useMemo(() => {
        const labels = [];
        const slotsCount = ((END_HOUR - START_HOUR) * 60) / timeSlot;
        for (let i = 0; i < slotsCount; i++) {
            const min = i * timeSlot;
            const h = START_HOUR + Math.floor(min / 60);
            const m = min % 60;
            labels.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
        return labels;
    }, [timeSlot]);

    // Handlers
    const handleGridAction = (e: React.MouseEvent, professional: LegacyProfessional) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const minutes = (offsetY / PIXELS_PER_MINUTE);
        const totalMinutes = (START_HOUR * 60) + minutes;
        const rounded = Math.round(totalMinutes / 15) * 15;
        const targetDate = new Date(currentDate);
        targetDate.setHours(Math.floor(rounded / 60), rounded % 60, 0, 0);
        setSelectionMenu({ x: e.clientX, y: e.clientY, time: targetDate, professional });
    };

    const handleAppointmentDrop = async (e: React.DragEvent, professional: LegacyProfessional) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('application/json');
        if (!data) return;
        const { appointmentId } = JSON.parse(data);
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const minutes = (offsetY / PIXELS_PER_MINUTE);
        const rounded = Math.round(((START_HOUR * 60) + minutes) / 15) * 15;
        const newStart = new Date(currentDate);
        newStart.setHours(Math.floor(rounded / 60), rounded % 60, 0, 0);

        try {
            await supabase.from('appointments').update({ 
                resource_id: professional.id, 
                professional_name: professional.name, 
                date: newStart.toISOString() 
            }).eq('id', appointmentId);
            showToast("Agendamento movido!");
            await refreshCalendar();
        } catch (err) { showToast("Erro ao mover", 'error'); }
    };

    const viewOptions = [
        { id: 'profissional', label: 'Por Profissional', icon: Users },
        { id: 'andamento', label: 'Por Andamento', icon: ClockIcon },
        { id: 'pagamento', label: 'Por Pagamento', icon: DollarSign }
    ];

    const periodOptions = ['Dia', 'Semana', 'Mês', 'Lista', 'Fila de Espera'];

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white p-6 gap-8 overflow-y-auto border-r border-slate-200">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ZoomIn size={14} /> Zoom da Grade
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-orange-500 uppercase">Auto</span>
                        <input type="checkbox" checked={isAutoWidth} onChange={e => setIsAutoWidth(e.target.checked)} className="w-3 h-3 rounded text-orange-500 border-slate-300 focus:ring-orange-500" />
                    </label>
                </div>
                {!isAutoWidth && (
                    <input type="range" min="150" max="450" step="10" value={colWidth} onChange={e => setColWidth(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                )}
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ClockIcon size={14} /> Intervalo
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map(val => (
                        <button key={val} onClick={() => setTimeSlot(val)} className={`py-2 rounded-xl text-xs font-black transition-all border-2 ${timeSlot === val ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>{val}m</button>
                    ))}
                </div>
            </div>

            <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14} /> Equipe</h3>
                    <button onClick={() => setVisibleProfIds(resources.map(r => r.id))} className="text-[10px] font-black text-orange-500 uppercase hover:underline">Todos</button>
                </div>
                <div className="space-y-2">
                    {resources.map(prof => (
                        <button key={prof.id} onClick={() => setVisibleProfIds(prev => prev.includes(prof.id) ? prev.filter(x => x !== prof.id) : [...prev, prof.id])} className={`w-full flex items-center gap-3 p-2 rounded-2xl transition-all border-2 ${visibleProfIds.includes(prof.id) ? 'bg-white border-orange-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-50 grayscale'}`}>
                            <img src={prof.avatarUrl} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" alt="" />
                            <div className="text-left overflow-hidden">
                                <p className="text-xs font-bold text-slate-700 truncate">{prof.name}</p>
                                <p className="text-[9px] text-slate-400 font-medium truncate uppercase">{prof.role}</p>
                            </div>
                            {visibleProfIds.includes(prof.id) && <Check size={14} className="ml-auto text-orange-500" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full bg-white font-sans text-left overflow-hidden relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Sidebar Expandable */}
            <aside className={`h-full flex-shrink-0 transition-all duration-300 relative ${isSidebarOpen ? 'w-72' : 'w-0'}`}>
                {isSidebarOpen && <SidebarContent />}
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-200 shadow-sm z-50 transition-all"
                >
                    {isSidebarOpen ? <ChevronLeft size={14}/> : <ChevronRight size={14}/>}
                </button>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header Estilo Salão99 */}
                <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-40 shadow-sm">
                    {/* Left: Navigation */}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentDate(new Date())} 
                            className="text-[10px] font-black uppercase tracking-wider px-3 py-2 text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        >
                            HOJE
                        </button>
                        
                        <div className="flex items-center gap-0.5 ml-1">
                            <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={20} /></button>
                            <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={20} /></button>
                        </div>

                        <div className="ml-2">
                            <span className="text-sm font-bold text-orange-500 capitalize">
                                {format(currentDate, "EEE, dd/MMMM/yyyy", { locale: pt })}
                            </span>
                        </div>

                        {/* Dropdown "PROFISSIONAL" */}
                        <div className="relative ml-4" ref={viewMenuRef}>
                            <button 
                                onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 rounded text-xs font-black text-slate-700 transition-all"
                            >
                                <span className="uppercase tracking-tight">{viewOptions.find(o => o.id === viewMode)?.label.split(' ')[1]}</span>
                                <ChevronDown size={14} className="text-slate-400" />
                            </button>

                            {isViewMenuOpen && (
                                <div className="absolute left-0 mt-2 w-56 bg-white rounded shadow-2xl border border-slate-100 z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase px-4 py-2 tracking-widest">Visualização da agenda</p>
                                    {viewOptions.map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setViewMode(opt.id as ViewMode); setIsViewMenuOpen(false); }}
                                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span>{opt.label}</span>
                                            </div>
                                            {viewMode === opt.id && <Check size={16} className="text-slate-800" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Tools */}
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setIsShareModalOpen(true)}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors" 
                            title="Compartilhar Link da Agenda"
                        >
                            <Share2 size={20} />
                        </button>

                        <div className="relative">
                            <button 
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative" 
                                title="Notificações"
                            >
                                <Bell size={20} />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            
                            {isNotificationsOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                        <span className="font-black text-xs uppercase text-slate-700">Notificações</span>
                                        <button onClick={() => setIsNotificationsOpen(false)} className="text-slate-400"><X size={16}/></button>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        {[1].map(n => (
                                            <div key={n} className="p-4 border-b hover:bg-slate-50 cursor-pointer transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] font-black text-blue-500 uppercase">Novo Agendamento Online</span>
                                                    <span className="text-[10px] text-slate-400">Há pouco</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-800">Maria Oliveira marcou Sobrancelha</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Ter, 27/Mai às 14:00 com Jaciene</p>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full py-3 text-xs font-black text-orange-500 hover:bg-slate-50 border-t">Ver todas as notificações</button>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={refreshCalendar} 
                            className={`p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors ${isLoadingData ? 'animate-spin text-orange-500' : ''}`}
                            title="Atualizar"
                        >
                            <RefreshCw size={20}/>
                        </button>

                        <div className="relative ml-2" ref={periodMenuRef}>
                            <button 
                                onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                            >
                                <span>{calendarMode}</span>
                                <ChevronDown size={14} className="text-slate-400" />
                            </button>

                            {isPeriodMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-2xl border border-slate-100 z-50 py-1 animate-in fade-in zoom-in-95 duration-150">
                                    {periodOptions.map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => { setCalendarMode(opt as any); setIsPeriodMenuOpen(false); }}
                                            className={`w-full flex items-center px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${calendarMode === opt ? 'bg-slate-50' : ''}`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-2 rounded shadow-sm flex items-center gap-2 transition-all active:scale-95 text-xs uppercase ml-2"
                        >
                            Agendar
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto bg-white custom-scrollbar relative">
                    <div className="min-w-fit">
                        {/* Headers */}
                        <div className="grid sticky top-0 z-40 border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `60px repeat(${filteredProfessionals.length}, ${isAutoWidth ? `minmax(200px, 1fr)` : `${colWidth}px`})` }}>
                            <div className="sticky left-0 z-50 bg-white border-r border-slate-200 h-20 min-w-[60px] flex items-center justify-center">
                                <Maximize2 size={16} className="text-slate-300" />
                            </div>
                            {filteredProfessionals.map((prof) => (
                                <div key={prof.id} className="flex items-center gap-3 px-6 py-2 border-r border-slate-100 h-20 bg-white group hover:bg-slate-50 transition-colors">
                                    <GripVertical size={14} className="text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <img src={prof.avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-orange-100 shadow-sm object-cover" />
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-black text-slate-800 leading-tight truncate">{prof.name}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{prof.role || 'Equipe'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${filteredProfessionals.length}, ${isAutoWidth ? `minmax(200px, 1fr)` : `${colWidth}px`})` }}>
                            <div className="sticky left-0 z-20 bg-white border-r border-slate-200 min-w-[60px]">
                                {timeSlotsLabels.map(time => (
                                    <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black pt-2 border-b border-slate-100/50 border-dashed bg-white">
                                        <span>{time}</span>
                                    </div>
                                ))}
                            </div>
                            
                            {filteredProfessionals.map((prof) => (
                                <div 
                                    key={prof.id} 
                                    className="relative border-r border-slate-200 min-h-[1000px] bg-white cursor-crosshair group/col"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleAppointmentDrop(e, prof)}
                                    onClick={(e) => { if (e.target === e.currentTarget) handleGridAction(e, prof); }}
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover/col:opacity-100 bg-orange-50/5 pointer-events-none transition-opacity"></div>
                                    {timeSlotsLabels.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed pointer-events-none"></div>)}
                                    
                                    {appointments.filter(app => Number(app.professional.id) === prof.id).map(app => {
                                        const pos = getAppointmentPosition(app.rawDate, app.service.duration);
                                        return (
                                            <div
                                                key={app.id}
                                                draggable
                                                onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify({ appointmentId: app.id })); }}
                                                ref={(el) => { if (el) appointmentRefs.current.set(app.id, el); }}
                                                onClick={(e) => { e.stopPropagation(); setActiveAppointmentDetail(app); }}
                                                className={getCardStyle(app, viewMode)}
                                                style={{ ...pos }}
                                            >
                                                <div className="flex flex-col h-full w-full overflow-hidden">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-black opacity-60 leading-none">{format(app.start, 'HH:mm')}</span>
                                                        {app.status === 'confirmado_whatsapp' && <MessageSquare size={10} className="text-emerald-600" />}
                                                    </div>
                                                    <span className="text-xs font-black text-slate-900 leading-tight truncate mt-0.5">{app.client?.nome || 'Bloqueado'}</span>
                                                    {app.service.duration >= 30 && (
                                                        <span className="text-[10px] text-slate-500 font-medium truncate leading-none mt-1">{app.service.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            <TimelineIndicator />
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL COMPARTILHAR AGENDAMENTO (Refatorado para estilo popup centralizado) */}
            {isShareModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative animate-in zoom-in duration-200">
                        <header className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Compartilhar agenda</h3>
                            <button 
                                onClick={() => setIsShareModalOpen(false)} 
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
                            >
                                <X size={20}/>
                            </button>
                        </header>
                        <div className="space-y-4">
                            <p className="text-gray-500 text-sm leading-relaxed">
                                Compartilhe o link da agenda do seu negócio para seus clientes marcarem horários online de qualquer lugar.
                            </p>
                            <div className="flex items-center gap-2">
                                <input 
                                    readOnly 
                                    value="https://belaflow.app/studio-jacilene-felix" 
                                    className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 select-all font-medium" 
                                />
                                <button 
                                    onClick={() => { 
                                        navigator.clipboard.writeText("https://belaflow.app/studio-jacilene-felix"); 
                                        showToast("Link copiado com sucesso!", "success"); 
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                                >
                                    <Copy size={16}/> Copiar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Menu */}
            {selectionMenu && (
                <>
                    <div className="fixed inset-0 z-50" onClick={() => setSelectionMenu(null)} />
                    <div className="fixed z-50 bg-white rounded-3xl shadow-2xl border border-slate-100 w-64 py-2 animate-in fade-in zoom-in-95 duration-150 overflow-hidden" style={{ top: Math.min(selectionMenu.y, window.innerHeight - 200), left: Math.min(selectionMenu.x, window.innerWidth - 260) }}>
                        <div className="px-4 py-2 bg-slate-50 border-b mb-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Ações para {format(selectionMenu.time, 'HH:mm')}</p></div>
                        <button onClick={() => { setModalState({ type: 'appointment', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"><div className="p-1.5 bg-orange-100 rounded-lg text-orange-600"><CalendarIcon size={16} /></div> Novo Agendamento</button>
                        <button onClick={() => { setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors"><div className="p-1.5 bg-rose-100 rounded-lg text-rose-600"><Ban size={16} /></div> Bloquear Horário</button>
                    </div>
                </>
            )}

            {/* Detail Popover */}
            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={async (id) => { 
                        await supabase.from('appointments').delete().eq('id', id); 
                        await refreshCalendar(); 
                        setActiveAppointmentDetail(null); 
                        showToast('Agendamento removido!', 'info'); 
                    }} 
                    onUpdateStatus={async (id, status) => { 
                        await supabase.from('appointments').update({ status }).eq('id', id); 
                        await refreshCalendar(); 
                        setActiveAppointmentDetail(null); 
                        showToast('Status atualizado!', 'success'); 
                    }} 
                />
            )}

            {/* Modals Core com Refresh Automático */}
            {modalState?.type === 'appointment' && (
                <AppointmentModal 
                    appointment={modalState.data} 
                    onClose={() => setModalState(null)} 
                    onSuccess={async () => {
                        await refreshCalendar();
                        showToast("Agenda atualizada com sucesso!", "success");
                    }} 
                />
            )}

            {modalState?.type === 'block' && (
                <BlockTimeModal 
                    professional={modalState.data.professional} 
                    startTime={modalState.data.start} 
                    onClose={() => setModalState(null)} 
                    onSuccess={async () => {
                        await refreshCalendar();
                        showToast("Horário bloqueado!", "info");
                    }} 
                />
            )}
        </div>
    );
};

export default AtendimentosView;
