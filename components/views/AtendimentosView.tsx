
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, MessageSquare, 
    ChevronDown, RefreshCw, Calendar as CalendarIcon,
    Maximize2, LayoutGrid, PlayCircle, CreditCard, Check, SlidersHorizontal, X, AlertTriangle,
    Ban, ShoppingBag, Plus, Filter, Users, User as UserIcon, ZoomIn, Clock as ClockIcon
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

const getCardStyle = (app: LegacyAppointment, viewMode: 'profissional' | 'andamento' | 'pagamento') => {
    const baseClasses = "absolute left-0 right-0 mx-1 rounded-lg shadow-sm border-l-4 p-2 cursor-grab active:cursor-grabbing z-10 hover:shadow-md transition-all overflow-hidden flex flex-col gap-0.5 select-none";
    
    // Customização BelaFlow Style
    switch (app.status) {
        case 'concluido': 
            return `${baseClasses} bg-emerald-50 border-emerald-500 text-emerald-900`;
        case 'bloqueado': 
            return `${baseClasses} bg-slate-100 border-slate-400 text-slate-500 opacity-80 opacity-70 border-dashed style-striped`;
        case 'confirmado':
        case 'confirmado_whatsapp': 
            return `${baseClasses} bg-green-50 border-green-500 text-green-900`;
        case 'chegou': 
            return `${baseClasses} bg-purple-50 border-purple-500 text-purple-900`;
        case 'em_atendimento': 
            return `${baseClasses} bg-indigo-50 border-indigo-500 text-indigo-900 animate-pulse`;
        case 'cancelado': 
            return `${baseClasses} bg-rose-50 border-rose-400 text-rose-800 opacity-60 line-through`;
        default: 
            // Agendado Padrão BelaFlow: Azul com borda Laranja
            return `${baseClasses} bg-blue-50 border-orange-500 text-blue-900`;
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

const AtendimentosView: React.FC<{ onAddTransaction: (t: FinancialTransaction) => void }> = ({ onAddTransaction }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<(LegacyAppointment & { rawDate: string })[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [visibleProfIds, setVisibleProfIds] = useState<number[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Drawer
    
    // Modals
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block' | 'sale'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, time: Date, professional: LegacyProfessional } | null>(null);

    // Configurações de Grade
    const [colWidth, setColWidth] = useState(240);
    const [timeSlot, setTimeSlot] = useState(30);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const isMounted = useRef(true);

    const refreshCalendar = useCallback(async () => {
        if (!isMounted.current) return;
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
            }
        } catch (e: any) { console.error(e); } 
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

    const handleDrop = async (e: React.DragEvent, professional: LegacyProfessional) => {
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
            await supabase.from('appointments').update({ resource_id: professional.id, professional_name: professional.name, date: newStart.toISOString() }).eq('id', appointmentId);
            setToast({ message: "Movido!", type: 'success' });
            refreshCalendar();
        } catch (err) { setToast({ message: "Erro ao mover", type: 'error' }); }
    };

    const toggleProf = (id: number) => setVisibleProfIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    // Componente Sidebar de Filtros
    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white p-6 gap-8 overflow-y-auto">
            <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ZoomIn size={14} /> Zoom da Grade
                </h3>
                <input type="range" min="150" max="450" step="10" value={colWidth} onChange={e => setColWidth(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                <div className="flex justify-between text-[10px] font-bold text-slate-400"><span>Compacto</span><span>Largo</span></div>
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
                        <button key={prof.id} onClick={() => toggleProf(prof.id)} className={`w-full flex items-center gap-3 p-2 rounded-2xl transition-all border-2 ${visibleProfIds.includes(prof.id) ? 'bg-white border-orange-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-50 grayscale'}`}>
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
        <div className="flex h-full bg-slate-50 font-sans text-left overflow-hidden relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Sidebar Desktop */}
            <aside className="hidden lg:block w-72 h-full border-r border-slate-200 flex-shrink-0 z-30">
                <SidebarContent />
            </aside>

            {/* Mobile Sheet (Drawer) */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
                    <div className="absolute left-0 top-0 bottom-0 w-4/5 max-w-sm bg-white shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between p-4 border-b">
                            <span className="font-black text-slate-800">Filtros da Agenda</span>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-2"><X size={20}/></button>
                        </div>
                        <SidebarContent />
                    </div>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 z-20 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-slate-100 rounded-xl text-slate-600 hover:bg-orange-50 hover:text-orange-500 transition-all"><Filter size={20}/></button>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                            <div className="px-4 text-center">
                                <p className="text-orange-500 font-black text-lg capitalize">{format(currentDate, "EEE, dd 'de' MMMM", { locale: pt }).replace('.', '')}</p>
                            </div>
                            <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={refreshCalendar} className={`p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-all ${isLoadingData ? 'animate-spin text-orange-500' : ''}`}><RefreshCw size={20}/></button>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-black px-6 py-2.5 rounded-xl shadow-lg shadow-orange-100 flex items-center gap-2 transition-all active:scale-95">
                            <Plus size={20} /> <span className="hidden sm:inline">Agendar</span>
                        </button>
                    </div>
                </header>

                {/* Calendar Grid Container */}
                <div className="flex-1 overflow-auto bg-slate-50 custom-scrollbar relative">
                    <div className="min-w-fit">
                        {/* Grade Header */}
                        <div className="grid sticky top-0 z-40 border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `60px repeat(${filteredProfessionals.length}, minmax(${colWidth}px, 1fr))` }}>
                            <div className="sticky left-0 z-50 bg-white border-r border-slate-200 h-20 min-w-[60px] flex items-center justify-center shadow-lg shadow-slate-200/50">
                                <Maximize2 size={16} className="text-slate-300" />
                            </div>
                            {filteredProfessionals.map((prof) => (
                                <div key={prof.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-20 bg-white group">
                                    <div className="flex items-center gap-3 px-4 py-2 rounded-2xl group-hover:bg-slate-50 transition-colors">
                                        <img src={prof.avatarUrl} alt="" className="w-9 h-9 rounded-full border-2 border-orange-100 shadow-sm object-cover" />
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-black text-slate-800 leading-tight truncate">{prof.name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{prof.role || 'Equipe'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Grid Body */}
                        <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${filteredProfessionals.length}, minmax(${colWidth}px, 1fr))` }}>
                            {/* Time Column */}
                            <div className="sticky left-0 z-20 bg-white border-r border-slate-200 min-w-[60px] shadow-lg shadow-slate-200/50">
                                {timeSlotsLabels.map(time => (
                                    <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black pt-2 border-b border-slate-100/50 border-dashed bg-white">
                                        <span>{time}</span>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Professional Columns */}
                            {filteredProfessionals.map((prof) => (
                                <div 
                                    key={prof.id} 
                                    className="relative border-r border-slate-200 min-h-[1000px] bg-white cursor-crosshair"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, prof)}
                                    onClick={(e) => { if (e.target === e.currentTarget) handleGridAction(e, prof); }}
                                >
                                    {timeSlotsLabels.map((_, i) => <div key={i} className="h-20 border-b border-slate-100/50 border-dashed pointer-events-none"></div>)}
                                    
                                    {/* Appointment Cards */}
                                    {appointments.filter(app => Number(app.professional.id) === prof.id).map(app => {
                                        const pos = getAppointmentPosition(app.rawDate, app.service.duration);
                                        return (
                                            <div
                                                key={app.id}
                                                draggable
                                                onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify({ appointmentId: app.id })); }}
                                                ref={(el) => { if (el) appointmentRefs.current.set(app.id, el); }}
                                                onClick={(e) => { e.stopPropagation(); setActiveAppointmentDetail(app); }}
                                                className={getCardStyle(app, 'profissional')}
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

            {/* Selection Context Menu */}
            {selectionMenu && (
                <>
                    <div className="fixed inset-0 z-50" onClick={() => setSelectionMenu(null)} />
                    <div className="fixed z-50 bg-white rounded-[24px] shadow-2xl border border-slate-100 w-64 py-2 animate-in fade-in zoom-in-95 duration-150 overflow-hidden" style={{ top: Math.min(selectionMenu.y, window.innerHeight - 200), left: Math.min(selectionMenu.x, window.innerWidth - 260) }}>
                        <div className="px-4 py-2 bg-slate-50 border-b mb-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Ações para {format(selectionMenu.time, 'HH:mm')}</p></div>
                        <button onClick={() => { setModalState({ type: 'appointment', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"><div className="p-1.5 bg-orange-100 rounded-lg text-orange-600"><CalendarIcon size={16} /></div> Novo Agendamento</button>
                        <button onClick={() => { setModalState({ type: 'block', data: { start: selectionMenu.time, professional: selectionMenu.professional } }); setSelectionMenu(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors"><div className="p-1.5 bg-rose-100 rounded-lg text-rose-600"><Ban size={16} /></div> Bloquear Horário</button>
                    </div>
                </>
            )}

            {/* Detalhe Popover */}
            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={async (id) => { await supabase.from('appointments').delete().eq('id', id); refreshCalendar(); setActiveAppointmentDetail(null); }} 
                    onUpdateStatus={async (id, status) => { await supabase.from('appointments').update({ status }).eq('id', id); refreshCalendar(); setActiveAppointmentDetail(null); }} 
                />
            )}

            {/* Modals Core */}
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={async (app) => {
                const payload = { client_name: app.client?.nome, resource_id: app.professional.id, professional_name: app.professional.name, service_name: app.service.name, value: app.service.price, duration: app.service.duration, date: app.start.toISOString(), status: app.status, notes: app.notas, origem: 'interno' };
                if (app.id) await supabase.from('appointments').update(payload).eq('id', app.id); else await supabase.from('appointments').insert([payload]);
                setToast({ message: "Agenda atualizada!", type: 'success' }); setModalState(null); refreshCalendar();
            }} />}

            {modalState?.type === 'block' && <BlockTimeModal professional={modalState.data.professional} startTime={modalState.data.start} onClose={() => setModalState(null)} onSave={async (block) => {
                await supabase.from('appointments').insert([{ resource_id: block.professional.id, professional_name: block.professional.name, service_name: 'Bloqueio', value: 0, duration: block.service.duration, date: block.start.toISOString(), status: 'bloqueado', notes: block.notas }]);
                setToast({ message: "Horário bloqueado!", type: 'info' }); setModalState(null); refreshCalendar();
            }} />}

            <JaciBotPanel isOpen={false} onClose={() => {}} />
        </div>
    );
};

export default AtendimentosView;
