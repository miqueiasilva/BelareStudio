
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, RefreshCw, 
    User as UserIcon, Settings, Bell, Filter, 
    X, SlidersHorizontal, Lock, Clock, ArrowLeft, ArrowRight,
    Globe, Info, Search, Loader2, Calendar as CalendarIcon,
    LayoutGrid, List, CheckCircle2, ChevronDown, Scissors
} from 'lucide-react';
import { format, addDays, differenceInMinutes, startOfDay, endOfDay, isSameDay, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';

// --- Constantes de Layout ---
const START_HOUR = 8;
const END_HOUR = 21; 
const BASE_ROW_HEIGHT = 80; // Pixels por hora

interface AtendimentosViewProps {
    onAddTransaction: (t: any) => void;
}

const AtendimentosView: React.FC<AtendimentosViewProps> = () => {
    // --- Estados de Dados ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- Estados de Visualização (Salão99 Style) ---
    const [colWidth, setColWidth] = useState(240); // Zoom: 150 a 400
    const [intervalMin, setIntervalMin] = useState<15 | 30 | 60>(30);
    const [colorMode, setColorMode] = useState<'service' | 'status' | 'professional'>('professional');
    const [visibleProfIds, setVisibleProfIds] = useState<number[]>([]);
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [nowPosition, setNowPosition] = useState<number | null>(null);

    // --- Estados de UI ---
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block'; data: any } | null>(null);
    const [activeDetail, setActiveDetail] = useState<LegacyAppointment | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    }, []);

    // --- Cálculo da Linha do Tempo (Tempo Real) ---
    useEffect(() => {
        const updatePosition = () => {
            const now = new Date();
            if (!isSameDay(now, currentDate)) {
                setNowPosition(null);
                return;
            }
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const startMinutes = START_HOUR * 60;
            const endMinutes = END_HOUR * 60;

            if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
                const pixelsPerMin = BASE_ROW_HEIGHT / 60;
                setNowPosition((currentMinutes - startMinutes) * pixelsPerMin);
            } else {
                setNowPosition(null);
            }
        };

        updatePosition();
        const timer = setInterval(updatePosition, 60000); // Atualiza a cada minuto
        return () => clearInterval(timer);
    }, [currentDate]);

    // --- Fetch de Dados ---
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: profs, error: pErr } = await supabase
                .from('professionals')
                .select('*')
                .eq('active', true)
                .order('display_order', { ascending: true });
            
            if (pErr) throw pErr;
            
            const mappedProfs: LegacyProfessional[] = (profs || []).map(p => ({
                id: p.id,
                name: p.name,
                avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                role: p.role,
                color: p.color || '#F97316',
                display_order: p.display_order
            } as any));
            
            setProfessionals(mappedProfs);

            if (visibleProfIds.length === 0 && mappedProfs.length > 0) {
                setVisibleProfIds(mappedProfs.map(p => p.id));
            }

            const tStart = startOfDay(currentDate).toISOString();
            const tEnd = endOfDay(currentDate).toISOString();

            const { data: apps, error: aErr } = await supabase
                .from('appointments')
                .select('*')
                .gte('date', tStart)
                .lte('date', tEnd);
            
            if (aErr) throw aErr;

            const mappedApps: LegacyAppointment[] = (apps || []).map(row => {
                const start = new Date(row.date);
                const end = row.end_date ? new Date(row.end_date) : new Date(start.getTime() + 30 * 60000);
                const prof = mappedProfs.find(p => p.id === Number(row.resource_id)) || mappedProfs[0];

                return {
                    id: row.id,
                    start, 
                    end,
                    status: (row.status as AppointmentStatus) || 'agendado',
                    client: { id: 0, nome: row.client_name || 'Cliente', consent: true },
                    professional: prof,
                    service: { 
                        id: 0, 
                        name: row.service_name || 'Serviço', 
                        price: parseFloat(row.value) || 0, 
                        duration: 30, 
                        color: row.color || '#3b82f6' 
                    },
                    notas: row.notes,
                    origem: row.origem
                } as any;
            });

            setAppointments(mappedApps);
        } catch (e: any) {
            showToast("Erro ao sincronizar agenda", 'error');
        } finally {
            setIsLoading(false);
        }
    }, [currentDate, visibleProfIds.length, showToast]);

    useEffect(() => {
        fetchData();
    }, [currentDate, fetchData]);

    // --- Helpers de Grid ---
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let h = START_HOUR; h < END_HOUR; h++) {
            for (let m = 0; m < 60; m += intervalMin) {
                slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        }
        return slots;
    }, [intervalMin]);

    const getAppStyle = (app: LegacyAppointment) => {
        const startMinutes = app.start.getHours() * 60 + app.start.getMinutes();
        const endMinutes = app.end.getHours() * 60 + app.end.getMinutes();
        const pixelsPerMin = BASE_ROW_HEIGHT / 60;
        
        const top = (startMinutes - START_HOUR * 60) * pixelsPerMin;
        const height = Math.max(24, (endMinutes - startMinutes) * pixelsPerMin);

        let bgColor = app.professional?.color || '#3b82f6';
        if (colorMode === 'status') {
            switch(app.status) {
                case 'concluido': bgColor = '#10b981'; break; 
                case 'bloqueado': bgColor = '#64748b'; break; 
                case 'cancelado': bgColor = '#f43f5e'; break; 
                case 'agendado': bgColor = '#f59e0b'; break; 
                case 'confirmado': bgColor = '#0ea5e9'; break;
                default: bgColor = '#6366f1';
            }
        } else if (colorMode === 'service') {
            bgColor = (app.service as any).color || '#3b82f6';
        }

        return { top: `${top}px`, height: `${height - 2}px`, backgroundColor: bgColor };
    };

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        setModalState(null);
        setIsLoading(true);
        try {
            const isBlock = app.status === 'bloqueado';
            const payload = {
                client_name: isBlock ? 'BLOQUEIO' : (app.client?.nome || 'Cliente'),
                service_name: isBlock ? 'Indisponível' : (app.service?.name || 'Serviço'),
                resource_id: app.professional.id,
                professional_name: app.professional.name,
                date: app.start.toISOString(),
                end_date: app.end.toISOString(),
                value: app.service.price || 0,
                status: app.status || 'agendado',
                origem: 'interno'
            };

            const { error } = app.id && app.id < 1e12
                ? await supabase.from('appointments').update(payload).eq('id', app.id)
                : await supabase.from('appointments').insert([payload]);

            if (error) throw error;
            showToast("Agendamento salvo!");
            fetchData();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Componentes Internos ---
    const onlineAppointments = appointments.filter(a => (a as any).origem === 'link');

    const SidebarContent = () => (
        <div className="space-y-8">
            {/* Zoom */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Largura das Colunas</label>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{colWidth}px</span>
                </div>
                <input 
                    type="range" min="150" max="400" step="10"
                    value={colWidth} onChange={(e) => setColWidth(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
            </div>

            {/* Intervalo */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Divisão da Grade</label>
                <select 
                    value={intervalMin} 
                    onChange={(e) => setIntervalMin(Number(e.target.value) as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-200"
                >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={60}>60 minutos</option>
                </select>
            </div>

            {/* Cores */}
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Esquema de Cores</label>
                <div className="grid grid-cols-1 gap-2">
                    {[
                        { id: 'professional', label: 'Por Profissional', icon: UserIcon },
                        { id: 'service', label: 'Por Serviço', icon: Scissors },
                        { id: 'status', label: 'Por Status', icon: Filter }
                    ].map(mode => (
                        <button 
                            key={mode.id}
                            onClick={() => setColorMode(mode.id as any)}
                            className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${colorMode === mode.id ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm' : 'border-slate-100 text-slate-500 bg-white hover:border-slate-200'}`}
                        >
                            <span className="text-xs font-bold">{mode.label}</span>
                            <mode.icon size={14} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Filtro Equipe */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissionais</label>
                    <button onClick={() => setVisibleProfIds(professionals.map(p => p.id))} className="text-[9px] font-black text-orange-500 uppercase hover:underline">Todos</button>
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                    {professionals.map(p => (
                        <label key={p.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                            <input 
                                type="checkbox" 
                                checked={visibleProfIds.includes(p.id)} 
                                onChange={() => setVisibleProfIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                            />
                            <div className="flex items-center gap-2 min-w-0">
                                <img src={p.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
                                <span className="text-xs font-bold text-slate-700 truncate">{p.name}</span>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* SIDEBAR DESKTOP (SALÃO99 INSPIRED) */}
            <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col flex-shrink-0 z-20">
                <div className="p-6 border-b border-slate-100 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-xl text-orange-600"><SlidersHorizontal size={20} /></div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Ajustes Agenda</h2>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <SidebarContent />
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase tracking-widest">Sincronizado</span>
                    </div>
                    <button className="text-slate-400 hover:text-orange-500 transition-colors"><RefreshCw size={14} /></button>
                </div>
            </aside>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* TOPBAR */}
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-30">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setShowMobileSettings(true)} className="lg:hidden p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-orange-50 transition-all"><Settings size={20} /></button>
                        
                        {/* Seletor de Data */}
                        <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                            <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-1.5 hover:bg-white rounded-xl text-slate-400 hover:text-slate-800 transition-all shadow-none hover:shadow-sm"><ChevronLeft size={18} /></button>
                            <div className="flex flex-col items-center min-w-[140px] px-2">
                                <span className="text-xs font-black text-slate-800 capitalize">{format(currentDate, "EEEE", { locale: pt })}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{format(currentDate, "dd 'de' MMMM", { locale: pt })}</span>
                            </div>
                            <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-1.5 hover:bg-white rounded-xl text-slate-400 hover:text-slate-800 transition-all shadow-none hover:shadow-sm"><ChevronRight size={18} /></button>
                        </div>

                        {/* Menu de Visualização (Visual) */}
                        <div className="hidden xl:flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                            {['Dia', 'Semana', 'Mês'].map(v => (
                                <button key={v} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${v === 'Dia' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{v}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Central de Notificações */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`p-3 rounded-2xl transition-all relative ${onlineAppointments.length > 0 ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'}`}
                            >
                                <Bell size={20} />
                                {onlineAppointments.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg animate-bounce">
                                        {onlineAppointments.length}
                                    </span>
                                )}
                            </button>

                            {/* Dropdown Notificações */}
                            {showNotifications && (
                                <div className="absolute top-14 right-0 w-80 bg-white rounded-[32px] shadow-2xl border border-slate-100 z-50 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Globe size={16} className="text-blue-500" /> Agendamentos Online
                                    </h3>
                                    <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                                        {onlineAppointments.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic py-4">Nenhum agendamento online hoje.</p>
                                        ) : onlineAppointments.map(app => (
                                            <div key={app.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-orange-200 transition-colors cursor-pointer">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-slate-800 text-xs">{app.client?.nome}</span>
                                                    <span className="text-[10px] font-black text-orange-600">{format(app.start, 'HH:mm')}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1">{app.service.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setShowNotifications(false)} className="w-full mt-4 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Fechar</button>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => setModalState({ type: 'appointment', data: { start: new Date(currentDate.setHours(9,0,0,0)), professional: professionals[0] } })} 
                            className="bg-slate-900 hover:bg-black text-white font-black text-xs py-3.5 px-6 rounded-2xl shadow-xl flex items-center gap-2 active:scale-95 transition-all"
                        >
                            <Plus size={18} /> <span className="hidden md:inline uppercase tracking-widest">Agendar</span>
                        </button>
                    </div>
                </header>

                {/* ÁREA DA GRADE COM LINHA DO TEMPO */}
                <div className="flex-1 flex overflow-hidden relative">
                    {isLoading && (
                        <div className="absolute inset-0 z-50 bg-slate-50/50 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 bg-white p-8 rounded-[32px] shadow-2xl border border-slate-100">
                                <Loader2 className="animate-spin text-orange-500" size={32} />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando...</p>
                            </div>
                        </div>
                    )}

                    <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide relative bg-slate-50">
                        <div className="inline-grid min-w-full" style={{ gridTemplateColumns: `60px repeat(${visibleProfIds.length}, ${colWidth}px)`, minHeight: '100%' }}>
                            
                            {/* CABEÇALHO FIXO */}
                            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 h-20"></div>
                            {professionals.filter(p => visibleProfIds.includes(p.id)).map((prof) => (
                                <div key={prof.id} className="sticky top-0 z-40 bg-white border-b border-slate-200 border-r border-slate-100 flex flex-col items-center justify-center p-2">
                                    <div className="flex items-center gap-3 w-full px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100 transition-all">
                                        <img src={prof.avatarUrl} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0" alt="" />
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[10px] font-black text-slate-800 truncate leading-tight uppercase">{prof.name.split(' ')[0]}</span>
                                            <span className="text-[8px] font-bold text-slate-400 truncate uppercase tracking-widest">{prof.role || 'PRO'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* COLUNA HORÁRIOS */}
                            <div className="relative border-r border-slate-200 bg-white z-20">
                                {timeSlots.map(time => {
                                    const isHour = time.endsWith(':00');
                                    return (
                                        <div 
                                            key={time} 
                                            className={`text-right pr-3 text-[10px] font-black pt-1.5 border-b border-slate-100/50 border-dashed ${isHour ? 'h-20 text-slate-500' : 'h-10 text-slate-300'}`}
                                            style={{ height: `${(intervalMin / 60) * BASE_ROW_HEIGHT}px` }}
                                        >
                                            {isHour && <span>{time}</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* CÉLULAS E CARDS */}
                            {professionals.filter(p => visibleProfIds.includes(p.id)).map(prof => (
                                <div key={prof.id} className="relative border-r border-slate-100 min-h-full">
                                    {/* Linha do Tempo Vermelha (Renderizada apenas uma vez sobre a grade) */}
                                    {nowPosition !== null && visibleProfIds[0] === prof.id && (
                                        <div className="absolute left-0 z-30 pointer-events-none flex items-center" style={{ top: `${nowPosition}px`, width: `${visibleProfIds.length * colWidth}px` }}>
                                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg -ml-1.5"></div>
                                            <div className="h-0.5 bg-red-500 flex-1 opacity-50"></div>
                                            <div className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-lg ml-2 shadow-xl">AGORA</div>
                                        </div>
                                    )}

                                    {/* Slots Clickable */}
                                    {timeSlots.map((time, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => {
                                                const [h, m] = time.split(':').map(Number);
                                                const start = new Date(currentDate);
                                                start.setHours(h, m, 0, 0);
                                                setModalState({ type: 'appointment', data: { start, professional: prof } });
                                            }}
                                            className="border-b border-slate-100/30 border-dashed cursor-cell hover:bg-orange-50/20 transition-colors"
                                            style={{ height: `${(intervalMin / 60) * BASE_ROW_HEIGHT}px` }}
                                        ></div>
                                    ))}

                                    {/* Agendamentos */}
                                    {appointments.filter(app => Number(app.professional.id) === prof.id).map(app => {
                                        const isOnline = (app as any).origem === 'link';
                                        const isBlock = app.status === 'bloqueado';

                                        return (
                                            <div
                                                key={app.id}
                                                ref={(el) => { appointmentRefs.current.set(app.id, el); }}
                                                onClick={(e) => { e.stopPropagation(); setActiveDetail(app); }}
                                                style={getAppStyle(app)}
                                                className={`absolute left-1/2 -translate-x-1/2 w-[94%] rounded-2xl shadow-lg p-2.5 cursor-pointer hover:scale-[1.02] hover:shadow-2xl transition-all z-10 overflow-hidden text-white flex flex-col justify-center border border-white/20 ${isBlock ? 'pattern-diagonal-lines-sm opacity-60' : ''}`}
                                            >
                                                {/* Indicador Online */}
                                                {isOnline && !isBlock && (
                                                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm" title="Agendado via Link Público">
                                                        <Globe size={10} className="text-white" />
                                                        <span className="text-[7px] font-black uppercase">Online</span>
                                                    </div>
                                                )}

                                                <p className="font-black truncate text-[11px] uppercase leading-none mb-0.5">{app.client?.nome || 'BLOQUEIO'}</p>
                                                <p className="text-[10px] font-bold truncate opacity-80 leading-tight">{app.service.name}</p>
                                                
                                                <div className="flex items-center gap-1 mt-1.5 opacity-60">
                                                    <Clock size={8} />
                                                    <span className="text-[8px] font-black">{format(app.start, 'HH:mm')} - {format(app.end, 'HH:mm')}</span>
                                                </div>
                                                
                                                {isBlock && <Lock size={12} className="absolute bottom-2 right-2 opacity-30" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* DRAWER AJUSTES MOBILE */}
            {showMobileSettings && (
                <div className="fixed inset-0 z-[100] flex items-end lg:hidden animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileSettings(false)}></div>
                    <div className="relative w-full bg-white rounded-t-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-xl text-orange-600"><SlidersHorizontal size={20}/></div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Filtros da Agenda</h3>
                            </div>
                            <button onClick={() => setShowMobileSettings(false)} className="p-2 bg-slate-50 text-slate-400 rounded-full"><X size={24}/></button>
                        </div>
                        <SidebarContent />
                    </div>
                </div>
            )}

            {/* MODAIS DE FLUXO */}
            {modalState?.type === 'appointment' && (
                <AppointmentModal 
                    appointment={modalState.data} 
                    onClose={() => setModalState(null)} 
                    onSave={handleSaveAppointment} 
                />
            )}
            
            {activeDetail && (
                <AppointmentDetailPopover 
                    appointment={activeDetail} 
                    targetElement={appointmentRefs.current.get(activeDetail.id) || null} 
                    onClose={() => setActiveDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={async (id) => { 
                        if(window.confirm("Remover este agendamento permanentemente?")){ 
                            const { error } = await supabase.from('appointments').delete().eq('id', id); 
                            if(!error) { fetchData(); setActiveDetail(null); }
                        }
                    }} 
                    onUpdateStatus={async (id, status) => { 
                        const { error } = await supabase.from('appointments').update({ status }).eq('id', id); 
                        if(!error) { fetchData(); setActiveDetail(null); }
                    }} 
                />
            )}
        </div>
    );
};

export default AtendimentosView;
