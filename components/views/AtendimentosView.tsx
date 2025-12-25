import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, Lock, MessageSquare, 
    Share2, Bell, RotateCcw, ChevronDown, List, Clock, 
    CheckCircle, DollarSign, FileText, Calendar as CalendarIcon, RefreshCw, User as UserIcon,
    ShoppingBag, Ban
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, setHours, setMinutes, differenceInMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, FinancialTransaction, LegacyProfessional, LegacyService } from '../../types';
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
    data?: any; 
}

const getAppointmentStyle = (start: Date, end: Date) => {
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const top = (startMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE;
    const height = (endMinutes - startMinutes) * PIXELS_PER_MINUTE;
    return { top: `${top}px`, height: `${height - 2}px` };
};

const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
        case 'concluido': return 'bg-green-50 border-green-200 text-green-900';
        case 'bloqueado': return 'bg-slate-100 border-slate-300 text-slate-500 pattern-diagonal-lines-sm pattern-slate-200 pattern-bg-slate-100 opacity-80';
        case 'confirmado': return 'bg-cyan-50 border-cyan-200 text-cyan-900';
        case 'confirmado_whatsapp': return 'bg-teal-50 border-teal-200 text-teal-900';
        case 'chegou': return 'bg-purple-50 border-purple-200 text-purple-900';
        case 'em_atendimento': return 'bg-indigo-50 border-indigo-200 text-indigo-900 animate-pulse';
        case 'faltou': return 'bg-orange-50 border-orange-200 text-orange-900';
        case 'cancelado': return 'bg-rose-50 border-rose-200 text-rose-800 opacity-60';
        case 'em_espera': return 'bg-stone-50 border-stone-200 text-stone-900';
        case 'agendado':
        default: return 'bg-blue-50 border-blue-200 text-blue-900';
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

type ViewType = 'Profissional' | 'Andamento' | 'Pagamento';
type PeriodType = 'Dia' | 'Semana' | 'Mês' | 'Lista';

const AtendimentosView: React.FC<AtendimentosViewProps> = ({ onAddTransaction }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [viewType] = useState<ViewType>('Profissional');
    const [periodType, setPeriodType] = useState<PeriodType>('Dia');
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block' | 'sale'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [isJaciBotOpen, setIsJaciBotOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const [selectionMenu, setSelectionMenu] = useState<{ 
        x: number, 
        y: number, 
        time: Date, 
        professional: LegacyProfessional 
    } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const periodDropdownRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        fetchResources();
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchResources = async () => {
        try {
            const { data, error } = await supabase
                .from('professionals')
                .select('id, name, photo_url, role')
                .order('name');
            
            if (error) throw error;
            if (data && isMounted.current) {
                const mapped = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                    role: p.role
                }));
                setResources(mapped);
            }
        } catch (e) {
            console.error("Error fetching professionals:", e);
        }
    };

    const fetchAppointments = async () => {
        if (!isMounted.current) return;
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase.from('appointments').select('*');
            if (error) throw error;
            if (data && isMounted.current) {
                const mappedAppointments: LegacyAppointment[] = data.map(row => {
                    const startTime = new Date(row.date); 
                    const duration = row.duration || row.duration_min || 30;
                    const endTime = new Date(startTime.getTime() + duration * 60000);
                    let matchedProf = resources.find(p => p.id === Number(row.resource_id)) 
                                    || resources.find(p => p.name === row.professional_name)
                                    || { id: row.resource_id || 0, name: row.professional_name || 'Profissional', avatarUrl: '' };
                    return {
                        id: row.id,
                        start: startTime,
                        end: endTime,
                        status: (row.status as AppointmentStatus) || 'agendado',
                        notas: row.notes || '',
                        client: { id: 0, nome: row.client_name || 'Cliente', consent: true },
                        professional: matchedProf as LegacyProfessional,
                        service: { 
                            id: 0, 
                            name: row.service_name || 'Serviço', 
                            price: parseFloat(row.value || 0), 
                            duration: duration, 
                            color: row.status === 'bloqueado' ? '#64748b' : '#3b82f6' 
                        }
                    };
                });
                setAppointments(mappedAppointments);
            }
        } catch (e) {
            console.error("Error fetching appointments:", e);
        } finally {
            if (isMounted.current) setIsLoadingData(false);
        }
    };

    useEffect(() => {
        if (resources.length > 0) fetchAppointments();
    }, [resources, currentDate]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) setIsPeriodDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDateChange = (direction: number) => {
        if (periodType === 'Dia' || periodType === 'Lista') setCurrentDate(prev => addDays(prev, direction));
        else if (periodType === 'Semana') setCurrentDate(prev => addWeeks(prev, direction));
        else if (periodType === 'Mês') setCurrentDate(prev => addMonths(prev, direction));
    };

    const columns = useMemo<DynamicColumn[]>(() => {
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start, end });
            return days.map(day => ({ id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), subtitle: format(day, 'dd/MM'), type: 'date', data: day }));
        }
        if (viewType === 'Profissional') {
            return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional', data: p }));
        }
        return [];
    }, [viewType, periodType, currentDate, resources]);

    const gridStyle = useMemo(() => {
        const colsCount = columns.length || 1;
        return { gridTemplateColumns: `60px repeat(${colsCount}, minmax(220px, 1fr))` };
    }, [columns.length]);

    const filteredAppointments = useMemo(() => {
        if (periodType === 'Dia' || periodType === 'Lista') return appointments.filter(a => isSameDay(a.start, currentDate));
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return appointments.filter(a => isWithinInterval(a.start, { start, end }));
        }
        if (periodType === 'Mês') {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);
            return appointments.filter(a => isWithinInterval(a.start, { start, end }));
        }
        return appointments;
    }, [appointments, periodType, currentDate]);

    const getColumnForAppointment = (app: LegacyAppointment, cols: DynamicColumn[]) => {
        if (periodType === 'Semana') return cols.find(c => isSameDay(app.start, c.data));
        if (viewType === 'Profissional') return cols.find(c => c.id === app.professional.id || c.title === app.professional.name);
        return null;
    };

    const timeSlots = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => { 
        const hour = START_HOUR + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        const tempId = app.id && app.id < 1000000000000 ? app.id : Date.now();
        const optimisticItem = { ...app, id: tempId };

        setAppointments(prev => {
            const index = prev.findIndex(p => p.id === tempId);
            if (index >= 0) {
                const newApps = [...prev];
                newApps[index] = optimisticItem;
                return newApps;
            }
            return [...prev, optimisticItem];
        });
        
        setModalState(null); 
        
        try {
            const payload = {
                client_name: app.client?.nome || 'Cliente',
                service_name: app.service.name,
                professional_name: app.professional.name, 
                resource_id: Number(app.professional.id),            
                date: app.start.toISOString(),
                value: typeof app.service.price === 'number' ? app.service.price : parseFloat(app.service.price || '0'),
                status: app.status || 'agendado',
                notes: app.notas || '',
                duration: app.service.duration || 30 
            };

            if (app.id && app.id < 1000000000000) {
                const { error } = await supabase.from('appointments').update(payload).eq('id', app.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('appointments').insert([payload]).select();
                if (error) throw error;
                if (data && data[0] && isMounted.current) {
                    setAppointments(prev => prev.map(p => p.id === tempId ? { ...optimisticItem, id: data[0].id } : p));
                }
            }
            
            if (isMounted.current) setToast({ message: 'Agendamento salvo com sucesso!', type: 'success' });
            setTimeout(() => {
                if (isMounted.current) fetchAppointments();
            }, 1000); 

        } catch (error: any) {
            console.error("Erro ao salvar agendamento:", error);
            if (isMounted.current) {
                setToast({ message: `Erro ao salvar no banco: ${error.message}`, type: 'error' });
                fetchAppointments(); 
            }
        }
    };

    const handleGridClick = (e: React.MouseEvent, professional: LegacyProfessional, colDate?: Date) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const minutes = (offsetY / PIXELS_PER_MINUTE);
        const totalMinutesFromDayStart = (START_HOUR * 60) + minutes;
        const roundedMinutes = Math.round(totalMinutesFromDayStart / 15) * 15;
        
        const targetDate = new Date(colDate || currentDate);
        targetDate.setHours(Math.floor(roundedMinutes / 60));
        targetDate.setMinutes(roundedMinutes % 60);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);

        setSelectionMenu({
            x: e.clientX,
            y: e.clientY,
            time: targetDate,
            professional
        });
    };

    return (
        <div className="flex h-full bg-white relative flex-col overflow-visible font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-6 z-10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Atendimentos {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}</h2>
                    <div className="flex items-center gap-2">
                        <div className="relative z-20" ref={periodDropdownRef}>
                            <button onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">{periodType} <ChevronDown size={16} /></button>
                            {isPeriodDropdownOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-[30] py-2 overflow-hidden">
                                    {['Dia', 'Semana', 'Mês', 'Lista'].map((item) => (
                                        <button key={item} onClick={() => { setPeriodType(item as PeriodType); setIsPeriodDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 ${periodType === item ? 'text-orange-600 font-bold bg-orange-50/50' : 'text-slate-700'}`}>{item}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all active:scale-95">Agendar</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">HOJE</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-bold text-lg capitalize">{format(currentDate, "EEE, dd 'de' MMMM", { locale: pt }).replace('.', '')}</span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                <div className="flex-1 overflow-auto bg-slate-50 md:bg-white relative">
                    {(periodType === 'Dia' || periodType === 'Semana') && (
                        <div className="relative min-h-full min-w-full">
                            <div className="grid sticky top-0 z-0 shadow-sm border-b border-slate-200 bg-white" style={gridStyle}>
                                <div className="border-r border-slate-200 h-24 bg-white sticky left-0 z-[5]"></div>
                                {columns.map(col => (
                                    <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-200 h-24 bg-slate-50/30">
                                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-slate-200 shadow-sm min-w-[140px]">
                                            {col.photo && <img src={col.photo} alt={col.title} className="w-10 h-10 rounded-full object-cover border-2 border-orange-100" />}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-xs font-bold text-slate-800 leading-tight break-words">{col.title}</span>
                                                {col.subtitle && <span className="text-[10px] text-slate-400 font-semibold">{col.subtitle}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="grid relative" style={gridStyle}>
                                <div className="border-r border-slate-200 bg-white sticky left-0 z-[5]">
                                    {timeSlots.map(time => <div key={time} className="h-20 text-right pr-3 text-[11px] text-slate-400 font-bold pt-2 border-b border-slate-50/50 border-dashed"><span>{time}</span></div>)}
                                </div>
                                {columns.map((col, idx) => (
                                    <div 
                                        key={col.id} 
                                        className={`relative border-r border-slate-200 min-h-[1000px] cursor-crosshair ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/10'}`}
                                        onClick={(e) => {
                                            if (e.target === e.currentTarget) {
                                                const prof = col.type === 'professional' ? col.data : resources[0];
                                                const date = col.type === 'date' ? col.data : currentDate;
                                                handleGridClick(e, prof, date);
                                            }
                                        }}
                                    >
                                        {timeSlots.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed pointer-events-none"></div>)}
                                        {filteredAppointments.filter(app => getColumnForAppointment(app, columns)?.id === col.id).map(app => {
                                            const duration = differenceInMinutes(app.end, app.start);
                                            const isShort = duration <= 30;
                                            
                                            return (
                                                <div
                                                    key={app.id}
                                                    ref={(el) => { appointmentRefs.current.set(app.id, el); }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveAppointmentDetail(app);
                                                    }}
                                                    className={`absolute left-0 right-0 mx-1 rounded-md shadow-sm border border-l-4 p-1.5 cursor-pointer flex flex-col hover:shadow-md hover:brightness-95 transition-all z-10 overflow-hidden ${getStatusColor(app.status)}`}
                                                    style={{ 
                                                        ...getAppointmentStyle(app.start, app.end),
                                                        borderLeftColor: app.service.color 
                                                    }}
                                                >
                                                    <span className="text-[10px] font-bold opacity-70 leading-none mb-0.5">
                                                        {format(app.start, 'HH:mm')}
                                                    </span>
                                                    <p className="font-bold text-slate-900 text-xs truncate leading-tight">
                                                        {app.client?.nome || (app.status === 'bloqueado' ? 'Bloqueado' : 'Cliente')}
                                                    </p>
                                                    {!isShort && (
                                                        <p className="text-[10px] font-medium text-slate-600 truncate leading-tight mt-0.5">
                                                            {app.service.name}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                                <TimelineIndicator />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectionMenu && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setSelectionMenu(null)} />
                    <div 
                        className="fixed z-[101] bg-white rounded-2xl shadow-2xl border border-slate-100 w-64 py-2 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
                        style={{ 
                            top: Math.min(selectionMenu.y, window.innerHeight - 200), 
                            left: Math.min(selectionMenu.x, window.innerWidth - 260) 
                        }}
                    >
                        <div className="px-4 py-2 border-b border-slate-50 mb-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Opções para as {format(selectionMenu.time, 'HH:mm')}</p>
                        </div>
                        <button 
                            onClick={() => {
                                setModalState({ type: 'appointment', data: { start: selectionMenu.time, professional: selectionMenu.professional } });
                                setSelectionMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                        >
                            <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600"><CalendarIcon size={16} /></div>
                            Novo Agendamento
                        </button>
                        <button 
                            onClick={() => {
                                setModalState({ type: 'sale', data: { professionalId: selectionMenu.professional.id } });
                                setSelectionMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                        >
                            <div className="p-1.5 bg-green-100 rounded-lg text-green-600"><ShoppingBag size={16} /></div>
                            Nova Venda
                        </button>
                        <button 
                            onClick={() => {
                                setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } });
                                setSelectionMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        >
                            <div className="p-1.5 bg-rose-100 rounded-lg text-orange-600"><Ban size={16} /></div>
                            Bloqueio de Horário
                        </button>
                    </div>
                </>
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
                    onSave={handleSaveAppointment} 
                />
            )}
            {modalState?.type === 'sale' && (
                <NewTransactionModal 
                    type="receita"
                    onClose={() => setModalState(null)}
                    onSave={(t) => {
                        onAddTransaction(t);
                        setModalState(null);
                        if (isMounted.current) setToast({ message: 'Venda registrada com sucesso!', type: 'success' });
                    }}
                />
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
                        if (isMounted.current) {
                            setActiveAppointmentDetail(null); 
                            setToast({ message: 'Agendamento removido.', type: 'info' });
                        }
                    }} 
                    onUpdateStatus={async (id, status) => { 
                        setAppointments(prev => prev.map(p => p.id === id ? { ...p, status } : p));
                        await supabase.from('appointments').update({ status }).eq('id', id); 
                        if (isMounted.current) setActiveAppointmentDetail(null); 
                    }} 
                />
            )}
            
            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
            <div className="fixed bottom-8 right-8 z-10"><button onClick={() => setIsJaciBotOpen(true)} className="w-16 h-16 bg-orange-500 rounded-3xl shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all"><MessageSquare className="w-8 h-8" /></button></div>
        </div>
    );
};

export default AtendimentosView;