
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, RefreshCw, 
    User as UserIcon, Settings, Bell, Filter, 
    X, SlidersHorizontal, Lock, Clock, PanelLeftClose, PanelLeftOpen,
    Globe, Info, Search, Loader2, Calendar as CalendarIcon,
    DollarSign, Ban, CheckCircle2, ChevronDown, Scissors, 
    MoreVertical, Zap
} from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, isSameDay, addMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, LegacyProfessional } from '../../types';
import NewAppointmentModal from '../modals/NewAppointmentModal';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';

const START_HOUR = 8;
const END_HOUR = 21; 
const ROW_HEIGHT = 60; // 30 minutos = 60px

const AtendimentosView: React.FC<{ onAddTransaction?: (t: any) => void }> = ({ onAddTransaction }) => {
    // --- Estados de Visualização ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [columnWidth, setColumnWidth] = useState(240);
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // --- Estados de Dados ---
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [visibleProfIds, setVisibleProfIds] = useState<number[]>([]);
    
    // --- Estados de Interação ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalInitialData, setModalInitialData] = useState<any>(null);
    const [activeDetail, setActiveDetail] = useState<LegacyAppointment | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [nowPosition, setNowPosition] = useState<number | null>(null);
    
    // Menu de Ação ao clicar em Slot Vazio
    const [slotMenu, setSlotMenu] = useState<{ x: number, y: number, date: Date, professional: any } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Busca de Dados ---
    const fetchData = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            const { data: profs, error: pErr } = await supabase
                .from('professionals')
                .select('*')
                .eq('active', true)
                .order('display_order');

            if (pErr) throw pErr;

            const mappedProfs: LegacyProfessional[] = (profs || []).map(p => ({
                id: p.id,
                name: p.name,
                avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                role: p.role,
                color: p.color || '#F97316'
            } as any));

            setProfessionals(mappedProfs);
            if (visibleProfIds.length === 0) setVisibleProfIds(mappedProfs.map(p => p.id));

            const tStart = startOfDay(currentDate).toISOString();
            const tEnd = endOfDay(currentDate).toISOString();

            const { data: apps, error: aErr } = await supabase
                .from('appointments')
                .select('*')
                .gte('date', tStart)
                .lte('date', tEnd);
            
            if (aErr) throw aErr;

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
            if (e.name !== 'AbortError') console.error("Agenda Sync Error:", e);
        } finally {
            if (abortControllerRef.current === controller) setIsLoading(false);
        }
    }, [currentDate, visibleProfIds.length]);

    useEffect(() => {
        fetchData();
        return () => abortControllerRef.current?.abort();
    }, [fetchData]);

    // --- Linha do Tempo ---
    useEffect(() => {
        const update = () => {
            const now = new Date();
            if (!isSameDay(now, currentDate)) { setNowPosition(null); return; }
            const mins = now.getHours() * 60 + now.getMinutes() - (START_HOUR * 60);
            if (mins < 0 || mins > (END_HOUR - START_HOUR) * 60) { setNowPosition(null); return; }
            setNowPosition((mins / 30) * ROW_HEIGHT);
        };
        update();
        const t = setInterval(update, 60000);
        return () => clearInterval(t);
    }, [currentDate]);

    // --- Helpers de Grid ---
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let h = START_HOUR; h < END_HOUR; h++) {
            slots.push(`${String(h).padStart(2, '0')}:00`);
            slots.push(`${String(h).padStart(2, '0')}:30`);
        }
        return slots;
    }, []);

    const handleSlotClick = (e: React.MouseEvent, prof: LegacyProfessional, time: string) => {
        const [h, m] = time.split(':').map(Number);
        const date = new Date(currentDate);
        date.setHours(h, m, 0, 0);
        setSlotMenu({ x: e.clientX, y: e.clientY, date, professional: prof });
    };

    const handleAction = (type: 'appointment' | 'sale' | 'block') => {
        if (!slotMenu) return;
        const { date, professional } = slotMenu;
        setSlotMenu(null);

        if (type === 'appointment') {
            setModalInitialData({ professional, start: date });
            setIsModalOpen(true);
        } else if (type === 'sale') {
            window.location.hash = '#/vendas';
        } else if (type === 'block') {
            setModalInitialData({ professional, start: date, status: 'bloqueado' });
            setIsModalOpen(true);
        }
    };

    const filteredProfs = professionals.filter(p => visibleProfIds.includes(p.id));

    return (
        <div className="flex h-screen bg-white overflow-hidden font-sans select-none relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* SIDEBAR DE AJUSTES */}
            <aside className={`bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-40 transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
                <div className="h-20 p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-700 uppercase tracking-tighter text-sm flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-orange-500" /> Ajustes Agenda
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                        <ChevronLeft size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-8 overflow-y-auto scrollbar-hide">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Largura Coluna</label>
                        <input type="range" min="150" max="400" value={columnWidth} onChange={e => setColumnWidth(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-800" />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissionais</h3>
                             <button onClick={() => setVisibleProfIds(professionals.map(p => p.id))} className="text-[9px] font-bold text-blue-600 hover:underline uppercase">Marcar todos</button>
                        </div>
                        <div className="space-y-1">
                            {professionals.map(p => (
                                <label key={p.id} className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all hover:bg-slate-50">
                                    <input type="checkbox" checked={visibleProfIds.includes(p.id)} onChange={() => setVisibleProfIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img src={p.avatarUrl} className="w-7 h-7 rounded-full object-cover border border-slate-100" alt="" />
                                        <span className="text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
                {!isSidebarOpen && (
                    <button onClick={() => setIsSidebarOpen(true)} className="absolute top-6 left-6 p-3 bg-white shadow-xl rounded-2xl text-slate-800 z-50 hover:scale-110 transition-transform border border-slate-200">
                        <PanelLeftOpen size={24} />
                    </button>
                )}

                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-30 shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronLeft size={20} /></button>
                            <div className="flex flex-col items-center min-w-[160px] px-2">
                                <span className="text-xs font-black text-slate-800 capitalize">{format(currentDate, "EEEE, dd/MM", { locale: pt })}</span>
                            </div>
                            <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronRight size={20} /></button>
                        </div>
                        <button onClick={() => setCurrentDate(new Date())} className="text-blue-600 text-sm font-bold hover:underline hidden sm:block">Ir para hoje</button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={fetchData} className="p-2.5 text-slate-400 hover:text-slate-800 transition-all bg-white border border-slate-200 rounded-xl"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
                        <button onClick={() => { setModalInitialData({ professional: professionals[0], start: new Date() }); setIsModalOpen(true); }} className="bg-slate-900 hover:bg-black text-white font-black text-xs py-3 px-6 rounded-2xl shadow-lg flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest">
                            <Plus size={18} /> Agendar
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto relative">
                    {isLoading && <div className="absolute top-0 left-0 w-full h-0.5 bg-orange-500 animate-pulse z-50"></div>}
                    
                    <div className="inline-grid min-w-full" style={{ gridTemplateColumns: `70px repeat(${filteredProfs.length}, ${columnWidth}px)` }}>
                        {/* Headers dos Profissionais com Avatares */}
                        <div className="sticky top-0 z-40 bg-white border-b border-r border-slate-200 h-20"></div>
                        {filteredProfs.map(prof => (
                            <div key={prof.id} className="sticky top-0 z-40 bg-white border-b border-r border-slate-200 h-20 flex items-center px-4 gap-3 shadow-sm">
                                <div className="relative">
                                    <img src={prof.avatarUrl} className="w-11 h-11 rounded-full border-2 border-slate-100 shadow-sm object-cover" alt="" />
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div className="min-w-0">
                                    <span className="text-xs font-black text-slate-800 truncate block leading-tight uppercase">{prof.name}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Ativo</span>
                                </div>
                            </div>
                        ))}

                        {/* Coluna de Horários */}
                        <div className="bg-white border-r border-slate-200 relative z-30">
                            {timeSlots.map(time => (
                                <div key={time} className="text-right pr-4 text-[10px] font-black text-slate-400 border-b border-slate-50" style={{ height: `${ROW_HEIGHT}px`, lineHeight: `${ROW_HEIGHT}px` }}>
                                    {time.endsWith(':00') ? time : ''}
                                </div>
                            ))}
                        </div>

                        {/* Colunas de Atendimento */}
                        {filteredProfs.map(prof => (
                            <div key={prof.id} className="relative border-r border-slate-100 bg-white/40">
                                {nowPosition !== null && filteredProfs[0].id === prof.id && (
                                    <div className="absolute left-0 z-30 pointer-events-none w-full" style={{ top: `${nowPosition}px`, width: `${filteredProfs.length * columnWidth}px` }}>
                                        <div className="border-t-2 border-red-500 w-full relative">
                                            <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-lg border-2 border-white"></div>
                                        </div>
                                    </div>
                                )}
                                
                                {timeSlots.map(time => (
                                    <div key={time} onClick={(e) => handleSlotClick(e, prof, time)} className="border-b border-slate-100/40 cursor-cell hover:bg-orange-50/30 transition-colors" style={{ height: `${ROW_HEIGHT}px` }}></div>
                                ))}

                                {appointments.filter(app => Number(app.professional.id) === prof.id).map(app => {
                                    const minsStart = app.start.getHours() * 60 + app.start.getMinutes() - (START_HOUR * 60);
                                    const minsEnd = app.end.getHours() * 60 + app.end.getMinutes() - (START_HOUR * 60);
                                    const top = (minsStart / 30) * ROW_HEIGHT;
                                    const height = ((minsEnd - minsStart) / 30) * ROW_HEIGHT;

                                    return (
                                        <div
                                            key={app.id}
                                            ref={el => appointmentRefs.current.set(app.id, el)}
                                            onClick={(e) => { e.stopPropagation(); setActiveDetail(app); }}
                                            className={`absolute left-1/2 -translate-x-1/2 w-[94%] rounded-xl shadow-sm p-3 cursor-pointer z-10 border-l-[6px] border-blue-500 bg-blue-50 hover:shadow-xl hover:scale-[1.01] transition-all overflow-hidden ${app.status === 'bloqueado' ? 'opacity-50 grayscale' : ''}`}
                                            style={{ top: `${top + 2}px`, height: `${height - 4}px` }}
                                        >
                                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter mb-1">
                                                {format(app.start, 'HH:mm')} - {format(app.end, 'HH:mm')}
                                            </p>
                                            <p className="text-xs font-black text-slate-800 truncate leading-tight uppercase">{app.client?.nome || 'BLOQUEIO'}</p>
                                            <p className="text-[10px] text-slate-500 truncate font-bold mt-0.5">{app.service.name}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* MENU DE AÇÃO EM SLOT VAZIO */}
            {slotMenu && (
                <div className="fixed inset-0 z-50 overflow-hidden" onClick={() => setSlotMenu(null)}>
                    <div 
                        className="absolute bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 w-56 flex flex-col gap-1 animate-in zoom-in-95 duration-200"
                        style={{ top: Math.min(slotMenu.y, window.innerHeight - 160), left: Math.min(slotMenu.x, window.innerWidth - 240) }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 border-b border-slate-50 mb-1 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(slotMenu.date, 'HH:mm')} • {slotMenu.professional.name.split(' ')[0]}</p>
                        </div>
                        <button onClick={() => handleAction('appointment')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 hover:text-blue-700 rounded-xl text-sm font-bold text-slate-600 transition-colors">
                            <CalendarIcon size={18} className="text-blue-500" /> Agendar
                        </button>
                        <button onClick={() => handleAction('sale')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl text-sm font-bold text-slate-600 transition-colors">
                            <DollarSign size={18} className="text-emerald-500" /> Nova Venda
                        </button>
                        <button onClick={() => handleAction('block')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-sm font-bold text-slate-600 transition-colors border-t border-slate-50 mt-1">
                            <Ban size={18} className="text-rose-500" /> Bloquear
                        </button>
                    </div>
                </div>
            )}

            {/* MODAIS */}
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
                    onEdit={(app) => { setActiveDetail(null); setModalInitialData({ ...app, professional: app.professional, start: app.start }); setIsModalOpen(true); }} 
                    onDelete={async (id) => { 
                        if(confirm("Confirmar cancelamento?")){
                            await supabase.from('appointments').delete().eq('id', id); fetchData(); setActiveDetail(null); 
                        }
                    }} 
                    onUpdateStatus={async (id, status) => { 
                        await supabase.from('appointments').update({ status }).eq('id', id); fetchData(); setActiveDetail(null); 
                    }} 
                />
            )}
        </div>
    );
};

export default AtendimentosView;
