
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, RefreshCw, 
    User as UserIcon, Settings, Bell, 
    X, Lock, Clock, PanelLeftClose, PanelLeftOpen, Maximize2,
    Palette, AlertTriangle, Loader2, Globe, MessageSquare
} from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, LegacyProfessional } from '../../types';
import NewAppointmentModal from '../modals/NewAppointmentModal';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import ToggleSwitch from '../shared/ToggleSwitch';

const START_HOUR = 8;
const END_HOUR = 21; 
const ROW_HEIGHT = 50; // Pixels por cada 30 minutos

// --- Estilos de Status (Estilo Salão 99) ---
const statusClasses: { [key in AppointmentStatus]: string } = {
    confirmado: 'bg-cyan-500 border-cyan-600 text-white',
    confirmado_whatsapp: 'bg-teal-500 border-teal-600 text-white',
    agendado: 'bg-orange-400 border-orange-500 text-white',
    chegou: 'bg-purple-500 border-purple-600 text-white',
    concluido: 'bg-emerald-500 border-emerald-600 text-white',
    cancelado: 'bg-slate-300 border-slate-400 text-slate-500 line-through opacity-60',
    bloqueado: 'bg-slate-200 border-slate-300 text-slate-600 pattern-diagonal-lines-sm opacity-50',
    faltou: 'bg-rose-500 border-rose-600 text-white',
    em_atendimento: 'bg-indigo-500 border-indigo-600 text-white ring-2 ring-white animate-pulse',
    em_espera: 'bg-amber-400 border-amber-500 text-white',
};

// --- Linha do Tempo em Tempo Real ---
const TimelineIndicator = () => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const startMins = START_HOUR * 60;
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    if (currentMins < startMins || currentMins > END_HOUR * 60) return null;

    const top = ((currentMins - startMins) / 30) * ROW_HEIGHT;

    return (
        <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
            <div className="border-t-2 border-red-500 w-full relative">
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-sm ring-2 ring-white"></div>
            </div>
        </div>
    );
};

const AtendimentosView: React.FC = () => {
    // --- Estados ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [visibleProfIds, setVisibleProfIds] = useState<number[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalInitialData, setModalInitialData] = useState<any>(null);
    const [activeDetail, setActiveDetail] = useState<LegacyAppointment | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Busca de Dados ---
    const fetchData = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            // 1. Profissionais
            const { data: profs } = await supabase.from('professionals').select('*').eq('active', true).order('display_order');
            const mappedProfs: LegacyProfessional[] = (profs || []).map(p => ({
                id: p.id, name: p.name, avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`, color: p.color || '#F97316'
            } as any));
            setProfessionals(mappedProfs);
            if (visibleProfIds.length === 0) setVisibleProfIds(mappedProfs.map(p => p.id));

            // 2. Agendamentos
            const tStart = startOfDay(currentDate).toISOString();
            const tEnd = endOfDay(currentDate).toISOString();

            const { data: apps, error } = await supabase.from('appointments').select('*').gte('date', tStart).lte('date', tEnd).abortSignal(controller.signal);
            if (error) throw error;

            const mappedApps: LegacyAppointment[] = (apps || []).map(row => ({
                id: row.id,
                start: new Date(row.date),
                end: row.end_date ? new Date(row.end_date) : new Date(new Date(row.date).getTime() + 30 * 60000),
                status: row.status as AppointmentStatus,
                client: { id: 0, nome: row.client_name, consent: true },
                professional: mappedProfs.find(p => p.id === Number(row.resource_id)) || { id: Number(row.resource_id), name: row.professional_name },
                service: { name: row.service_name, price: parseFloat(row.value), duration: 30, color: row.color },
                origem: row.origem
            } as any));

            setAppointments(mappedApps);
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Erro na agenda:", e.message);
        } finally {
            if (!controller.signal.aborted) setIsLoading(false);
        }
    }, [currentDate, visibleProfIds.length]);

    useEffect(() => {
        fetchData();
        return () => abortControllerRef.current?.abort();
    }, [fetchData]);

    const timeSlots = useMemo(() => {
        const slots = [];
        for (let h = START_HOUR; h < END_HOUR; h++) {
            slots.push(`${String(h).padStart(2, '0')}:00`);
            slots.push(`${String(h).padStart(2, '0')}:30`);
        }
        return slots;
    }, []);

    const handleOpenModal = (prof?: LegacyProfessional, time?: string) => {
        let start = new Date(currentDate);
        if (time) {
            const [h, m] = time.split(':').map(Number);
            start.setHours(h, m, 0, 0);
        } else {
            start.setHours(9, 0, 0, 0);
        }
        setModalInitialData({ professional: prof || professionals[0], start });
        setIsModalOpen(true);
    };

    const filteredProfs = professionals.filter(p => visibleProfIds.includes(p.id));

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans select-none relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* SIDEBAR DE FILTROS */}
            <aside className={`bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-40 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
                <div className="p-6 space-y-8">
                    <div className="flex items-center justify-between">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissionais</h3>
                         <button onClick={() => setIsSidebarCollapsed(true)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><PanelLeftClose size={18}/></button>
                    </div>
                    
                    <div className="space-y-2">
                        {professionals.map(p => (
                            <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all border ${visibleProfIds.includes(p.id) ? 'bg-orange-50 border-orange-100' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={visibleProfIds.includes(p.id)} 
                                    onChange={() => setVisibleProfIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} 
                                    className="w-5 h-5 rounded-lg text-orange-500 border-slate-300 focus:ring-orange-500" 
                                />
                                <div className="flex items-center gap-2">
                                    <img src={p.avatarUrl} className="w-8 h-8 rounded-full border border-white shadow-sm" alt="" />
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{p.name}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </aside>

            {/* CONTEÚDO PRINCIPAL (AGENDA) */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {isSidebarCollapsed && (
                    <button onClick={() => setIsSidebarCollapsed(false)} className="absolute top-6 left-6 p-3 bg-white shadow-xl rounded-2xl text-orange-600 z-50 hover:scale-110 transition-transform">
                        <PanelLeftOpen size={24} />
                    </button>
                )}

                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-30 shadow-sm">
                    <div className="flex items-center bg-slate-50 p-1.5 rounded-[22px] border border-slate-100">
                        <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all"><ChevronLeft size={20} /></button>
                        <div className="flex flex-col items-center min-w-[160px]">
                            <span className="text-[11px] font-black text-slate-800 capitalize leading-none">{format(currentDate, "EEEE", { locale: pt })}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{format(currentDate, "dd 'de' MMMM", { locale: pt })}</span>
                        </div>
                        <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all"><ChevronRight size={20} /></button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={fetchData} className="p-3 text-slate-400 hover:text-orange-600 transition-all"><RefreshCw size={22} className={isLoading ? 'animate-spin' : ''} /></button>
                        <button onClick={() => handleOpenModal()} className="bg-slate-900 hover:bg-black text-white font-black text-xs px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 transition-all active:scale-95">
                            <Plus size={22} /> <span className="uppercase tracking-widest">Agendar</span>
                        </button>
                    </div>
                </header>

                {/* GRADE DA AGENDA */}
                <div className="flex-1 overflow-auto bg-slate-50 relative scrollbar-hide">
                    {isLoading && <div className="sticky top-0 left-0 w-full h-1 bg-orange-500 animate-pulse z-50"></div>}
                    
                    <div className="inline-grid min-w-full" style={{ gridTemplateColumns: `70px repeat(${filteredProfs.length}, minmax(200px, 1fr))` }}>
                        {/* Header de Profissionais */}
                        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md h-24 border-b border-slate-200"></div>
                        {filteredProfs.map(prof => (
                            <div key={prof.id} className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-r border-slate-200 h-24 flex flex-col items-center justify-center p-2">
                                <img src={prof.avatarUrl} className="w-12 h-12 rounded-full border-2 border-orange-100 shadow-sm mb-1" alt="" />
                                <span className="text-[10px] font-black text-slate-800 uppercase truncate w-full text-center tracking-tighter">{prof.name.split(' ')[0]}</span>
                            </div>
                        ))}

                        {/* Coluna de Horários */}
                        <div className="border-r border-slate-200 bg-white/50 relative">
                            {timeSlots.map(time => (
                                <div key={time} className="text-right pr-4 text-[10px] font-black text-slate-400 border-b border-slate-100/50" style={{ height: `${ROW_HEIGHT}px`, lineHeight: `${ROW_HEIGHT}px` }}>
                                    {time.endsWith(':00') ? time : ''}
                                </div>
                            ))}
                        </div>

                        {/* Colunas de Atendimento */}
                        {filteredProfs.map(prof => (
                            <div key={prof.id} className="relative border-r border-slate-100 bg-white/30">
                                <TimelineIndicator />
                                
                                {timeSlots.map(time => (
                                    <div 
                                        key={time} 
                                        onClick={() => handleOpenModal(prof, time)} 
                                        className="border-b border-slate-100/30 cursor-cell hover:bg-orange-50/50 transition-colors" 
                                        style={{ height: `${ROW_HEIGHT}px` }}
                                    ></div>
                                ))}

                                {appointments.filter(app => Number(app.professional.id) === prof.id).map(app => {
                                    const startMins = app.start.getHours() * 60 + app.start.getMinutes();
                                    const endMins = app.end.getHours() * 60 + app.end.getMinutes();
                                    const top = ((startMins - START_HOUR * 60) / 30) * ROW_HEIGHT;
                                    const height = ((endMins - startMins) / 30) * ROW_HEIGHT;

                                    return (
                                        <div
                                            key={app.id}
                                            ref={(el) => appointmentRefs.current.set(app.id, el)}
                                            onClick={(e) => { e.stopPropagation(); setActiveDetail(app); }}
                                            className={`absolute left-1/2 -translate-x-1/2 w-[94%] rounded-xl shadow-lg p-2 cursor-pointer z-10 font-bold border-l-4 transition-all hover:scale-[1.02] hover:z-20 ${statusClasses[app.status]}`}
                                            style={{ top: `${top + 2}px`, height: `${height - 4}px` }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="text-[10px] uppercase truncate leading-tight flex-1">{app.client?.nome}</p>
                                                {app.origem === 'link' && <Globe size={10} className="opacity-60 shrink-0" />}
                                            </div>
                                            <p className="text-[9px] opacity-90 truncate mt-0.5 font-medium">{app.service.name}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* BOTÃO FLUTUANTE JACIBOT */}
            <div className="absolute bottom-8 right-8 z-50">
                <button className="w-16 h-16 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-black hover:-translate-y-1 transition-all active:scale-95 group">
                    <MessageSquare size={28} className="group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white text-[10px] font-black flex items-center justify-center">2</span>
                </button>
            </div>

            {/* MODAIS E POPOVERS */}
            <NewAppointmentModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={fetchData} 
                initialData={modalInitialData}
            />

            {activeDetail && (
                <AppointmentDetailPopover 
                    appointment={activeDetail} 
                    targetElement={appointmentRefs.current.get(activeDetail.id) || null} 
                    onClose={() => setActiveDetail(null)} 
                    onEdit={() => {}} 
                    onDelete={async (id) => { 
                        if(confirm("Deseja cancelar este agendamento?")){
                            await supabase.from('appointments').delete().eq('id', id); 
                            fetchData(); 
                            setActiveDetail(null); 
                        }
                    }} 
                    onUpdateStatus={async (id, status) => { 
                        await supabase.from('appointments').update({ status }).eq('id', id); 
                        fetchData(); 
                        setActiveDetail(null); 
                    }} 
                />
            )}
        </div>
    );
};

export default AtendimentosView;
