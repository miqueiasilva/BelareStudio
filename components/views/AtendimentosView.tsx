
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, MessageSquare, 
    ChevronDown, RefreshCw, User as UserIcon, Calendar as CalendarIcon,
    AlertCircle, WifiOff
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, FinancialTransaction, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
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
    const height = Math.max(40, (endMinutes - startMinutes) * PIXELS_PER_MINUTE);
    return { top: `${top}px`, height: `${height - 4}px` };
};

const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
        case 'concluido': return 'bg-green-100 border-green-300 text-green-800 hover:ring-green-400 shadow-sm';
        case 'bloqueado': return 'bg-slate-200 border-slate-300 text-slate-700 pattern-diagonal-lines-sm pattern-slate-400 pattern-bg-slate-200';
        case 'confirmado': return 'bg-cyan-100 border-cyan-300 text-cyan-800 hover:ring-cyan-400 shadow-sm';
        case 'confirmado_whatsapp': return 'bg-teal-100 border-teal-300 text-teal-800 hover:ring-teal-400 shadow-sm';
        case 'chegou': return 'bg-purple-100 border-purple-300 text-purple-800 hover:ring-purple-400 shadow-sm';
        case 'em_atendimento': return 'bg-indigo-100 border-indigo-300 text-indigo-800 hover:ring-indigo-400 animate-pulse shadow-md';
        case 'faltou': return 'bg-orange-100 border-orange-300 text-orange-800 hover:ring-orange-400';
        case 'cancelado': return 'bg-rose-100 border-rose-300 text-rose-800 hover:ring-rose-400 line-through opacity-70';
        case 'em_espera': return 'bg-stone-100 border-stone-300 text-stone-700 hover:ring-stone-400 shadow-sm';
        case 'agendado':
        default: return 'bg-blue-100 border-blue-300 text-blue-800 hover:ring-blue-400 shadow-sm';
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

type PeriodType = 'Dia' | 'Semana' | 'Mês' | 'Lista';

const AtendimentosView: React.FC<AtendimentosViewProps> = ({ onAddTransaction }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [hasError, setHasError] = useState<string | null>(null);
    const [periodType, setPeriodType] = useState<PeriodType>('Dia');
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [isJaciBotOpen, setIsJaciBotOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());

    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const fetchResources = async () => {
        try {
            const { data, error } = await supabase
                .from('professionals')
                .select('id, name, photo_url, role')
                .eq('active', true)
                .order('name');
            
            if (error) throw error;
            if (data) {
                const mapped = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                    role: p.role
                }));
                setResources(mapped);
            }
        } catch (e: any) {
            console.error("Error fetching professionals:", e);
            if (e.message === 'Failed to fetch') {
                setHasError("Erro de conexão com o banco de dados. Verifique sua internet ou as chaves do Supabase.");
            }
        }
    };

    const fetchAppointments = async () => {
        setIsLoadingData(true);
        setHasError(null);
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('*');
            
            if (error) {
                if (error.code === '42P01') throw new Error("Tabela 'appointments' não encontrada no banco. Por favor, execute o script SQL de configuração.");
                throw error;
            }

            if (data) {
                const mappedAppointments: LegacyAppointment[] = data.map(row => {
                    const startTime = new Date(row.date); 
                    const endTime = row.end_date ? new Date(row.end_date) : new Date(startTime.getTime() + 30 * 60000);
                    
                    let matchedProf = resources.find(p => p.id === Number(row.resource_id)) 
                                    || { id: 0, name: row.professional_name || 'Equipe', avatarUrl: '' };

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
                            duration: 30, 
                            color: row.color || '#3b82f6' 
                        }
                    };
                });
                setAppointments(mappedAppointments);
            }
        } catch (e: any) {
            console.error("Error fetching appointments:", e);
            setHasError(e.message === 'Failed to fetch' ? "Falha na rede ao carregar agenda." : e.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleRefresh = async () => {
        await fetchResources();
        await fetchAppointments();
    };

    useEffect(() => {
        handleRefresh();
    }, [currentDate]);

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
        
        if (resources.length === 0) {
             return [{ id: 1, title: 'Equipe', type: 'professional' }];
        }

        return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional', data: p }));
    }, [periodType, currentDate, resources]);

    const gridStyle = useMemo(() => {
        const colsCount = columns.length || 1;
        return { gridTemplateColumns: `60px repeat(${colsCount}, minmax(180px, 1fr))` };
    }, [columns.length]);

    const filteredAppointments = useMemo(() => {
        if (periodType === 'Dia' || periodType === 'Lista') return appointments.filter(a => isSameDay(a.start, currentDate));
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return appointments.filter(a => isWithinInterval(a.start, { start, end }));
        }
        return appointments;
    }, [appointments, periodType, currentDate]);

    const getColumnForAppointment = (app: LegacyAppointment, cols: DynamicColumn[]) => {
        if (periodType === 'Semana') return cols.find(c => isSameDay(app.start, c.data));
        // Se profissional ID não existe nas colunas (ex: carregou mas não bate), coloca na primeira coluna
        const found = cols.find(c => c.id === app.professional.id);
        return found || cols[0];
    };

    const timeSlots = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => { 
        const hour = START_HOUR + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });

    // --- CRUD Handlers ---

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        setModalState(null); 
        try {
            const payload = {
                client_name: app.client?.nome || 'Cliente',
                service_name: app.service.name,
                professional_name: app.professional.name, 
                resource_id: Number(app.professional.id) || 1,            
                date: app.start.toISOString(),
                end_date: app.end.toISOString(),
                value: Number(app.service.price),
                status: app.status || 'agendado',
                notes: app.notas || '',
                color: app.service.color || '#3b82f6'
            };

            let res;
            if (app.id && app.id < 1000000000000) { 
                res = await supabase.from('appointments').update(payload).eq('id', app.id);
            } else {
                res = await supabase.from('appointments').insert([payload]);
            }

            if (res.error) throw res.error;
            
            await fetchAppointments(); 
            showToast('Agendamento salvo com sucesso!');
        } catch (error: any) {
            showToast(`Erro ao salvar: ${error.message}`, 'error');
        }
    };

    const handleDeleteAppointment = async (id: number) => {
        if (!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
        try {
            const { error } = await supabase.from('appointments').delete().eq('id', id);
            if (error) throw error;
            await fetchAppointments();
            setActiveAppointmentDetail(null);
            showToast('Agendamento removido.', 'info');
        } catch (error: any) {
            showToast(`Erro ao excluir: ${error.message}`, 'error');
        }
    };

    const handleUpdateStatus = async (id: number, status: AppointmentStatus) => {
        try {
            const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
            if (error) throw error;
            await fetchAppointments();
            setActiveAppointmentDetail(null);
            showToast(`Status atualizado para ${status}.`);
        } catch (error: any) {
            showToast(`Erro ao atualizar status.`, 'error');
        }
    };

    return (
        <div className="flex h-full bg-white relative flex-col overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-6 z-[60]">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Atendimentos {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />}
                    </h2>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleRefresh}
                            className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"
                            title="Recarregar Agenda"
                        >
                            <RefreshCw size={20} className={isLoadingData ? 'animate-spin' : ''} />
                        </button>
                        <div className="relative">
                            <button onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all">
                                <CalendarIcon size={16} className="text-slate-400" />
                                {periodType} 
                                <ChevronDown size={16} />
                            </button>
                            {isPeriodDropdownOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden animate-in fade-in zoom-in-95">
                                    {['Dia', 'Semana', 'Mês', 'Lista'].map((item) => (
                                        <button key={item} onClick={() => { setPeriodType(item as PeriodType); setIsPeriodDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 ${periodType === item ? 'text-orange-600 font-bold bg-orange-50' : 'text-slate-700'}`}>{item}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2">
                            <Plus size={20} />
                            Agendar
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs font-black bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">HOJE</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors"><ChevronLeft size={24} /></button>
                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors"><ChevronRight size={24} /></button>
                    </div>
                    <span className="text-orange-500 font-black text-xl capitalize drop-shadow-sm">
                        {format(currentDate, "EEEE, dd 'de' MMMM", { locale: pt }).replace('.', '')}
                    </span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                <div className="flex-1 overflow-auto bg-slate-50 relative">
                    {hasError ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <WifiOff size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Ops! Algo deu errado</h3>
                            <p className="text-slate-500 max-w-sm mt-2 mb-6">{hasError}</p>
                            <button 
                                onClick={handleRefresh}
                                className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center gap-2"
                            >
                                <RefreshCw size={18} />
                                Tentar Novamente
                            </button>
                        </div>
                    ) : (periodType === 'Dia' || periodType === 'Semana') && (
                        <div className="relative min-h-full min-w-full">
                            <div className="grid sticky top-0 z-40 shadow-sm border-b border-slate-200 bg-white" style={gridStyle}>
                                <div className="border-r border-slate-100 h-24 bg-white sticky left-0 z-50"></div>
                                {columns.map(col => (
                                    <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24 bg-slate-50/20">
                                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-slate-200 shadow-sm min-w-[150px] max-w-[200px]">
                                            {col.photo ? (
                                                <img src={col.photo} alt={col.title} className="w-10 h-10 rounded-full object-cover border-2 border-orange-100" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <UserIcon size={20} />
                                                </div>
                                            )}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-xs font-black text-slate-800 truncate">{col.title}</span>
                                                {col.subtitle && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{col.subtitle}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="grid relative" style={gridStyle}>
                                <div className="border-r border-slate-100 bg-white sticky left-0 z-30">
                                    {timeSlots.map(time => <div key={time} className="h-20 text-right pr-3 text-[11px] text-slate-400 font-black pt-2 border-b border-slate-100/30 border-dashed"><span>{time}</span></div>)}
                                </div>
                                {columns.map((col, idx) => (
                                    <div key={col.id} className={`relative border-r border-slate-100 min-h-[1000px] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                        {timeSlots.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed"></div>)}
                                        {filteredAppointments.filter(app => getColumnForAppointment(app, columns)?.id === col.id).map(app => (
                                            <div
                                                key={app.id}
                                                ref={(el) => { appointmentRefs.current.set(app.id, el); }}
                                                onClick={() => setActiveAppointmentDetail(app)}
                                                className={`absolute w-[94%] left-1/2 -translate-x-1/2 rounded-2xl shadow-md border p-2.5 cursor-pointer hover:scale-[1.02] transition-all z-10 ${getStatusColor(app.status)}`}
                                                style={getAppointmentStyle(app.start, app.end)}
                                            >
                                                <div style={{ backgroundColor: app.service.color }} className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl shadow-inner"></div>
                                                <div className="pl-2 overflow-hidden">
                                                    <p className="font-black text-slate-900 truncate text-xs">{app.client?.nome}</p>
                                                    <p className="text-[10px] font-bold text-slate-600 truncate mt-0.5">{app.service.name}</p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-[9px] font-black opacity-40 uppercase">{format(app.start, 'HH:mm')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <TimelineIndicator />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Popovers */}
            {modalState?.type === 'appointment' && (
                <AppointmentModal 
                    appointment={modalState.data} 
                    onClose={() => setModalState(null)} 
                    onSave={handleSaveAppointment} 
                />
            )}
            
            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={handleDeleteAppointment} 
                    onUpdateStatus={handleUpdateStatus} 
                />
            )}

            <JaciBotPanel isOpen={isJaciBotOpen} onClose={() => setIsJaciBotOpen(false)} />
            <div className="fixed bottom-8 right-8 z-[70]">
                <button onClick={() => setIsJaciBotOpen(true)} className="w-16 h-16 bg-orange-500 rounded-3xl shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all border-4 border-white active:scale-95">
                    <MessageSquare className="w-8 h-8" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                </button>
            </div>
        </div>
    );
};

export default AtendimentosView;
