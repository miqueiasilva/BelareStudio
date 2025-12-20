
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, MessageSquare, 
    ChevronDown, RefreshCw, User as UserIcon, Calendar as CalendarIcon,
    Scissors, Lock
} from 'lucide-react';
import { format, addDays, addWeeks, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, FinancialTransaction, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
import BlockTimeModal from '../modals/BlockTimeModal';
import JaciBotPanel from '../JaciBotPanel';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import ContextMenu from '../shared/ContextMenu';
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
        case 'em_atendimento': return 'bg-indigo-100 border-indigo-300 text-indigo-800 hover:ring-indigo-400 shadow-md';
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

type PeriodType = 'Dia' | 'Semana';

const AtendimentosView: React.FC<AtendimentosViewProps> = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [periodType, setPeriodType] = useState<PeriodType>('Dia');
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block'; data: any } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [isJaciBotOpen, setIsJaciBotOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());

    const showToast = useCallback((message: any, type: ToastType = 'success') => {
        // Garantir extração robusta de mensagem para evitar [object Object]
        let finalMessage = "";
        if (typeof message === 'string') {
            finalMessage = message;
        } else if (message?.message && typeof message.message === 'string') {
            finalMessage = message.message;
        } else if (message?.error_description && typeof message.error_description === 'string') {
            finalMessage = message.error_description;
        } else {
            finalMessage = JSON.stringify(message) || "Erro inesperado";
        }
        setToast({ message: finalMessage, type });
    }, []);

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
                return mapped;
            }
        } catch (e: any) {
            console.error("Erro ao buscar profissionais:", e);
        }
        return [];
    };

    const fetchAppointments = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase.from('appointments').select('*');
            if (error) throw error;

            if (data) {
                const currentResources = await fetchResources();
                const mappedAppointments: LegacyAppointment[] = data.map(row => {
                    const startTime = new Date(row.date); 
                    const endTime = row.end_date ? new Date(row.end_date) : new Date(startTime.getTime() + 30 * 60000);
                    
                    let matchedProf = currentResources.find(p => p.id === Number(row.resource_id)) 
                                    || { id: Number(row.resource_id) || 1, name: row.professional_name || 'Equipe', avatarUrl: '' };

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
            console.error("Erro ao carregar agendamentos:", e);
            showToast("Erro ao sincronizar com o servidor.", "error");
        } finally {
            setIsLoadingData(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchResources();
        fetchAppointments();
    }, [currentDate, fetchAppointments]);

    const handleDateChange = (direction: number) => {
        if (periodType === 'Dia') setCurrentDate(prev => addDays(prev, direction));
        else if (periodType === 'Semana') setCurrentDate(prev => addWeeks(prev, direction));
    };

    const columns = useMemo<DynamicColumn[]>(() => {
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start, end });
            return days.map(day => ({ 
                id: day.toISOString(), 
                title: format(day, 'EEE', { locale: pt }), 
                subtitle: format(day, 'dd/MM'), 
                type: 'date', 
                data: day 
            }));
        }
        if (resources.length === 0) return [{ id: 1, title: 'Equipe', type: 'professional', data: { id: 1, name: 'Equipe', avatarUrl: '' } }];
        return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional', data: p }));
    }, [periodType, currentDate, resources]);

    const gridStyle = useMemo(() => ({ gridTemplateColumns: `60px repeat(${columns.length}, minmax(180px, 1fr))` }), [columns.length]);

    const filteredAppointments = useMemo(() => {
        if (periodType === 'Dia') return appointments.filter(a => isSameDay(a.start, currentDate));
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return appointments.filter(a => isWithinInterval(a.start, { start, end }));
        }
        return appointments;
    }, [appointments, periodType, currentDate]);

    const getColumnForAppointment = (app: LegacyAppointment, cols: DynamicColumn[]) => {
        if (periodType === 'Semana') return cols.find(c => isSameDay(app.start, c.data));
        return cols.find(c => Number(c.id) === Number(app.professional.id)) || cols[0];
    };

    const timeSlots = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => { 
        const hour = START_HOUR + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });

    // --- Action Handlers ---

    const handleCellClick = (time: string, col: DynamicColumn) => {
        const [hour, minute] = time.split(':').map(Number);
        let targetDate = new Date(currentDate);
        if (col.type === 'date') targetDate = new Date(col.data);
        targetDate.setHours(hour, minute, 0, 0);

        const professional = col.type === 'professional' ? col.data : (resources[0] || { id: 1, name: 'Equipe' });
        setModalState({ type: 'appointment', data: { start: targetDate, professional } });
    };

    const handleCellContextMenu = (e: React.MouseEvent, time: string, col: DynamicColumn) => {
        e.preventDefault();
        const [hour, minute] = time.split(':').map(Number);
        let targetDate = new Date(currentDate);
        if (col.type === 'date') targetDate = new Date(col.data);
        targetDate.setHours(hour, minute, 0, 0);

        const professional = col.type === 'professional' ? col.data : (resources[0] || { id: 1, name: 'Equipe' });
        setContextMenu({ x: e.clientX, y: e.clientY, data: { start: targetDate, professional } });
    };

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        setModalState(null); 
        try {
            const isBlock = app.status === 'bloqueado';
            const resourceId = Number(app.professional?.id);
            
            const payload = {
                client_name: isBlock ? 'BLOQUEIO DE AGENDA' : (app.client?.nome || 'Cliente'),
                service_name: isBlock ? 'Bloqueio' : (app.service?.name || 'Serviço'),
                professional_name: app.professional?.name || 'Profissional', 
                resource_id: isNaN(resourceId) ? 1 : resourceId,            
                date: app.start.toISOString(),
                end_date: app.end.toISOString(),
                value: isBlock ? 0 : (Number(app.service?.price) || 0),
                status: app.status || 'agendado',
                notes: app.notas || '',
                color: isBlock ? '#64748b' : (app.service?.color || '#3b82f6')
            };

            const { error } = app.id && app.id < 1000000000000 
                ? await supabase.from('appointments').update(payload).eq('id', app.id)
                : await supabase.from('appointments').insert([payload]);

            if (error) throw error;
            
            showToast('Dados salvos com sucesso!');
            await fetchAppointments(); 
        } catch (error: any) {
            console.error("Erro ao salvar:", error);
            const msg = typeof error?.message === 'string' ? error.message : "Erro inesperado ao salvar.";
            showToast(`Erro ao salvar: ${msg}`, 'error');
        }
    };

    const handleDeleteAppointment = async (id: number) => {
        if (!window.confirm("Deseja realmente remover este agendamento?")) return;
        try {
            const { error } = await supabase.from('appointments').delete().eq('id', id);
            if (error) throw error;
            showToast('Agendamento removido.');
            await fetchAppointments();
            setActiveAppointmentDetail(null);
        } catch (error: any) {
            const msg = typeof error?.message === 'string' ? error.message : "Erro ao excluir.";
            showToast(`Erro ao excluir: ${msg}`, 'error');
        }
    };

    const handleUpdateStatus = async (id: number, status: AppointmentStatus) => {
        try {
            const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
            if (error) throw error;
            showToast(`Status atualizado.`);
            await fetchAppointments();
            setActiveAppointmentDetail(null);
        } catch (error: any) {
            const msg = typeof error?.message === 'string' ? error.message : "Erro ao atualizar status.";
            showToast(`Erro ao atualizar status: ${msg}`, 'error');
        }
    };

    const contextMenuOptions = useMemo(() => [
        { 
            label: 'Novo Atendimento', 
            icon: <Scissors size={16}/>, 
            onClick: () => setModalState({ type: 'appointment', data: contextMenu?.data }) 
        },
        { 
            label: 'Bloqueio de Horário', 
            icon: <Lock size={16} className="text-rose-500"/>, 
            onClick: () => setModalState({ type: 'block', data: contextMenu?.data }), 
            className: 'text-rose-600' 
        },
    ], [contextMenu?.data]);

    return (
        <div className="flex h-full bg-white relative flex-col overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-6 z-[60]">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Atendimentos {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />}
                    </h2>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchAppointments} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"><RefreshCw size={20} className={isLoadingData ? 'animate-spin' : ''} /></button>
                        <div className="relative">
                            <button onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700">
                                <CalendarIcon size={16} className="text-slate-400" /> {periodType} <ChevronDown size={16} />
                            </button>
                            {isPeriodDropdownOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden">
                                    {['Dia', 'Semana'].map((item) => (
                                        <button key={item} onClick={() => { setPeriodType(item as PeriodType); setIsPeriodDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 ${periodType === item ? 'text-orange-600 font-bold' : ''}`}>{item}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate, professional: resources[0] } })} className="bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95">
                            <Plus size={20} /> Agendar
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs font-black bg-slate-100 px-4 py-2 rounded-lg uppercase tracking-widest">HOJE</button>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><ChevronLeft size={24} /></button>
                        <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><ChevronRight size={24} /></button>
                    </div>
                    <span className="text-orange-500 font-black text-xl capitalize">
                        {format(currentDate, "EEEE, dd 'de' MMMM", { locale: pt }).replace('.', '')}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-slate-50 relative">
                <div className="relative min-h-full min-w-full">
                    <div className="grid sticky top-0 z-40 shadow-sm border-b border-slate-200 bg-white" style={gridStyle}>
                        <div className="border-r border-slate-100 h-24 bg-white sticky left-0 z-50"></div>
                        {columns.map(col => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-24">
                                <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-slate-200 shadow-sm min-w-[150px]">
                                    {col.photo ? <img src={col.photo} className="w-10 h-10 rounded-full object-cover border-2 border-orange-100" alt="" /> : <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><UserIcon size={20} /></div>}
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-black text-slate-800 truncate">{col.title}</span>
                                        {col.subtitle && <span className="text-[9px] text-slate-400 font-bold">{col.subtitle}</span>}
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
                                {timeSlots.map((time, i) => (
                                    <div 
                                        key={i} 
                                        className="h-20 border-b border-slate-100/50 border-dashed cursor-cell"
                                        onClick={() => handleCellClick(time, col)}
                                        onContextMenu={(e) => handleCellContextMenu(e, time, col)}
                                    ></div>
                                ))}
                                {filteredAppointments.filter(app => getColumnForAppointment(app, columns)?.id === col.id).map(app => (
                                    <div
                                        key={app.id}
                                        ref={(el) => { appointmentRefs.current.set(app.id, el); }}
                                        onClick={(e) => { e.stopPropagation(); setActiveAppointmentDetail(app); }}
                                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setActiveAppointmentDetail(app); }}
                                        className={`absolute w-[94%] left-1/2 -translate-x-1/2 rounded-2xl shadow-md border p-2.5 cursor-pointer hover:scale-[1.02] transition-all z-10 ${getStatusColor(app.status)}`}
                                        style={getAppointmentStyle(app.start, app.end)}
                                    >
                                        <div style={{ backgroundColor: app.service.color || '#3b82f6' }} className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl shadow-inner"></div>
                                        <div className="pl-2 overflow-hidden">
                                            <p className="font-black text-slate-900 truncate text-xs">{app.client?.nome || 'BLOQUEIO'}</p>
                                            <p className="text-[10px] font-bold text-slate-600 truncate mt-0.5">{app.service.name}</p>
                                            <span className="text-[9px] font-black opacity-40 uppercase">{format(app.start, 'HH:mm')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        <TimelineIndicator />
                    </div>
                </div>
            </div>

            {/* Modals & Popovers */}
            {modalState?.type === 'appointment' && (
                <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />
            )}
            {modalState?.type === 'block' && (
                <BlockTimeModal 
                    professional={modalState.data.professional} 
                    startTime={modalState.data.start} 
                    onClose={() => setModalState(null)} 
                    onSave={handleSaveAppointment} 
                />
            )}
            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} 
                    y={contextMenu.y} 
                    options={contextMenuOptions} 
                    onClose={() => setContextMenu(null)} 
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
                </button>
            </div>
        </div>
    );
};

export default AtendimentosView;
