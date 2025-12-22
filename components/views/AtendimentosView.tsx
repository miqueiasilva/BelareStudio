
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, RefreshCw, 
    User as UserIcon, Settings, Bell, Filter, 
    X, SlidersHorizontal, Lock, Clock, ArrowLeft, ArrowRight,
    Globe, Info, Search, Loader2, Calendar as CalendarIcon,
    LayoutGrid, List, CheckCircle2, ChevronDown, Scissors,
    PanelLeftClose, PanelLeftOpen, Maximize2, MousePointer2,
    Eye, EyeOff, Palette, AlertTriangle
} from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import ToggleSwitch from '../shared/ToggleSwitch';
import ContextMenu from '../shared/ContextMenu';

// --- Constantes de Interface ---
const START_HOUR = 8;
const END_HOUR = 21; 
const BASE_ROW_HEIGHT = 80; 

const AtendimentosView: React.FC = () => {
    // --- Estados de Dados ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // --- Estados de Layout ---
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    
    const [isAutoWidth, setIsAutoWidth] = useState(true);
    const [manualColWidth, setManualColWidth] = useState(240);
    const [intervalMin, setIntervalMin] = useState<15 | 30 | 60>(30);
    const [visibleProfIds, setVisibleProfIds] = useState<number[]>([]);
    const [colorMode, setColorMode] = useState<'service' | 'status' | 'professional'>('professional');
    
    const [nowPosition, setNowPosition] = useState<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, data: any } | null>(null);

    const [modalState, setModalState] = useState<{ type: 'appointment'; data: any } | null>(null);
    const [activeDetail, setActiveDetail] = useState<LegacyAppointment | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message: String(message), type });
    }, []);

    // --- Busca de Dados ---
    const fetchData = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setFetchError(null);

        try {
            // 1. Carregar Profissionais
            const { data: profs, error: pErr } = await supabase
                .from('professionals')
                .select('*')
                .eq('active', true)
                .order('display_order', { ascending: true })
                .abortSignal(controller.signal);
            
            if (pErr) throw pErr;
            
            const mappedProfs: LegacyProfessional[] = (profs || []).map(p => ({
                id: p.id,
                name: p.name,
                avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random`,
                role: p.role,
                color: p.color || '#F97316',
            } as any));
            
            setProfessionals(mappedProfs);

            // Se for a primeira carga ou troca de data, garante que IDs visíveis estejam setados
            if (visibleProfIds.length === 0 && mappedProfs.length > 0) {
                setVisibleProfIds(mappedProfs.map(p => p.id));
            }

            // 2. Carregar Agendamentos (Filtro Local 00:00 às 23:59)
            // Usamos startOfDay e endOfDay da biblioteca date-fns para garantir cobertura total do dia
            const tStart = startOfDay(currentDate).toISOString();
            const tEnd = endOfDay(currentDate).toISOString();

            const { data: apps, error: aErr } = await supabase
                .from('appointments')
                .select('*')
                .gte('date', tStart)
                .lte('date', tEnd)
                .abortSignal(controller.signal);
            
            if (aErr) throw aErr;

            const mappedApps: LegacyAppointment[] = (apps || []).map(row => {
                // NORMALIZAÇÃO CRÍTICA: row.resource_id pode vir como string ou number do Supabase
                const resourceId = row.resource_id ? Number(row.resource_id) : null;
                
                // Busca o profissional ou usa um fallback para não quebrar a UI
                const prof = mappedProfs.find(p => p.id === resourceId) || { 
                    id: resourceId || 0, 
                    name: row.professional_name || 'Desconhecido',
                    avatarUrl: ''
                };

                return {
                    id: row.id,
                    start: new Date(row.date),
                    end: row.end_date ? new Date(row.end_date) : new Date(new Date(row.date).getTime() + 30 * 60000),
                    status: (row.status as AppointmentStatus) || 'agendado',
                    client: { id: 0, nome: row.client_name || 'Cliente', consent: true },
                    professional: prof,
                    service: { 
                        id: 0, name: row.service_name || 'Serviço', 
                        price: parseFloat(row.value) || 0, duration: 30, 
                        color: row.color || '#3b82f6' 
                    },
                    notas: row.notes,
                    origem: row.origem
                } as any;
            });

            setAppointments(mappedApps);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error("Fetch Error:", e);
                setFetchError(e.message || "Erro de conexão.");
            }
        } finally {
            if (!controller.signal.aborted) setIsLoading(false);
        }
    }, [currentDate, visibleProfIds.length]);

    useEffect(() => {
        fetchData();
        return () => abortControllerRef.current?.abort();
    }, [currentDate]);

    // --- Linha do Tempo ---
    useEffect(() => {
        const updateNow = () => {
            const now = new Date();
            if (!isSameDay(now, currentDate)) {
                setNowPosition(null);
                return;
            }
            const mins = now.getHours() * 60 + now.getMinutes();
            const startMins = START_HOUR * 60;
            const endMins = END_HOUR * 60;

            if (mins >= startMins && mins <= endMins) {
                const pxPerMin = BASE_ROW_HEIGHT / 60;
                setNowPosition((mins - startMins) * pxPerMin);
            } else {
                setNowPosition(null);
            }
        };
        updateNow();
        const timer = setInterval(updateNow, 60000);
        return () => clearInterval(timer);
    }, [currentDate]);

    const currentColWidth = useMemo(() => {
        if (isAutoWidth) return window.innerWidth < 1024 ? 180 : 220;
        return manualColWidth;
    }, [isAutoWidth, manualColWidth]);

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
        const startMins = app.start.getHours() * 60 + app.start.getMinutes();
        const endMins = app.end.getHours() * 60 + app.end.getMinutes();
        const pxPerMin = BASE_ROW_HEIGHT / 60;
        const top = (startMins - START_HOUR * 60) * pxPerMin;
        const height = Math.max(28, (endMins - startMins) * pxPerMin);

        let bgColor = app.professional?.color || '#F97316';
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

    const onlineApps = appointments.filter(a => (a as any).origem === 'link');

    const renderAvatar = (prof: LegacyProfessional, sizeClass = "w-10 h-10") => {
        const initials = (prof?.name || 'P').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const photoUrl = (prof as any)?.avatarUrl || (prof as any)?.photo_url;

        return (
            <div className={`${sizeClass} rounded-full flex-shrink-0 border-2 border-white shadow-sm overflow-hidden bg-orange-100 flex items-center justify-center`}>
                {photoUrl ? (
                    <img src={photoUrl} alt={prof.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                    <span className="text-[10px] font-black text-orange-600">{initials}</span>
                )}
            </div>
        );
    };

    const SidebarContent = () => (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Maximize2 size={14} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auto-Largura</span>
                    </div>
                    <ToggleSwitch on={isAutoWidth} onClick={() => setIsAutoWidth(!isAutoWidth)} />
                </div>
                {!isAutoWidth && (
                    <input 
                        type="range" min="150" max="400" step="10"
                        value={manualColWidth} onChange={(e) => setManualColWidth(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                )}
            </div>

            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={14} /> Precisão</label>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    {[15, 30, 60].map(m => (
                        <button key={m} onClick={() => setIntervalMin(m as any)} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${intervalMin === m ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>{m}m</button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={14} /> Equipe</label>
                    <button onClick={() => setVisibleProfIds(professionals.map(p => p.id))} className="text-[9px] font-black text-orange-500 hover:underline">TODOS</button>
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-hide">
                    {professionals.map(p => (
                        <label key={p.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 hover:border-orange-200 rounded-2xl cursor-pointer transition-all">
                            <input 
                                type="checkbox" 
                                checked={visibleProfIds.includes(p.id)} 
                                onChange={() => setVisibleProfIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                className="w-5 h-5 rounded-lg border-slate-300 text-orange-500 focus:ring-orange-500"
                            />
                            {renderAvatar(p, "w-8 h-8")}
                            <span className="text-xs font-bold text-slate-700 truncate">{p.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Palette size={14} /> Cores</label>
                <div className="grid grid-cols-1 gap-2">
                    {['professional', 'service', 'status'].map(mode => (
                        <button key={mode} onClick={() => setColorMode(mode as any)} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-[11px] font-black uppercase transition-all ${colorMode === mode ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 text-slate-400 bg-white'}`}>
                            {mode === 'professional' ? 'Profissional' : mode === 'service' ? 'Serviço' : 'Status'}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans select-none relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* SIDEBAR DESKTOP */}
            <aside className={`hidden lg:flex bg-white border-r border-slate-200 flex-col flex-shrink-0 z-40 transition-all duration-300 ${isSidebarCollapsed ? 'w-0' : 'w-72'}`}>
                {!isSidebarCollapsed && (
                    <>
                        <div className="p-6 border-b border-slate-100 h-20 flex items-center justify-between">
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Agenda Belaflow</h2>
                            <button onClick={() => setIsSidebarCollapsed(true)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><PanelLeftClose size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide"><SidebarContent /></div>
                    </>
                )}
                {isSidebarCollapsed && (
                    <button onClick={() => setIsSidebarCollapsed(false)} className="absolute top-6 left-full ml-4 p-3 bg-white shadow-xl rounded-2xl border border-slate-100 text-orange-600 z-50"><PanelLeftOpen size={24} /></button>
                )}
            </aside>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* TOPBAR */}
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 flex-shrink-0 z-30">
                    <div className="flex items-center gap-2 lg:gap-6">
                        <button onClick={() => setIsFilterDrawerOpen(true)} className="lg:hidden p-3 bg-slate-100 text-slate-600 rounded-2xl active:bg-orange-50"><Settings size={22} /></button>
                        
                        <div className="flex items-center bg-slate-50 p-1.5 rounded-[22px] border border-slate-100">
                            <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-white rounded-xl text-slate-400 active:scale-90 transition-transform"><ChevronLeft size={20} /></button>
                            <div className="flex flex-col items-center min-w-[120px] md:min-w-[160px] px-2">
                                <span className="text-[11px] font-black text-slate-800 capitalize leading-none">{format(currentDate, "EEEE", { locale: pt })}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{format(currentDate, "dd 'de' MMMM", { locale: pt })}</span>
                            </div>
                            <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-white rounded-xl text-slate-400 active:scale-90 transition-transform"><ChevronRight size={20} /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <button onClick={fetchData} className="p-3 text-slate-400 hover:text-orange-600 transition-all active:scale-90"><RefreshCw size={22} className={isLoading ? 'animate-spin' : ''} /></button>
                        <div className="relative">
                            <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className={`p-3 rounded-2xl transition-all relative ${onlineApps.length > 0 ? 'bg-orange-50 text-orange-600 shadow-inner' : 'bg-slate-50 text-slate-400'}`}>
                                <Bell size={22} />
                                {onlineApps.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg">{onlineApps.length}</span>}
                            </button>
                            {isNotificationOpen && (
                                <div className="fixed top-20 right-4 w-80 bg-white rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 z-[9999] p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                            <Globe size={16} className="text-blue-500" /> Online Hoje
                                        </h3>
                                        <button onClick={() => setIsNotificationOpen(false)}><X size={16} className="text-slate-300" /></button>
                                    </div>
                                    <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                                        {onlineApps.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic py-4 text-center">Sem novos agendamentos online.</p>
                                        ) : onlineApps.map(app => (
                                            <div key={app.id} onClick={() => { setActiveDetail(app); setIsNotificationOpen(false); }} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-orange-200 transition-colors cursor-pointer group">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-slate-800 text-xs group-hover:text-orange-600">{app.client?.nome}</span>
                                                    <span className="text-[10px] font-black text-orange-600">{format(app.start, 'HH:mm')}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{app.service.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={() => setModalState({ type: 'appointment', data: { start: new Date(currentDate.setHours(9,0,0,0)), professional: professionals[0] } })} className="bg-slate-900 hover:bg-black text-white font-black text-xs p-3 md:px-6 md:py-3.5 rounded-2xl shadow-xl flex items-center gap-2 active:scale-95 transition-all">
                            <Plus size={22} /> <span className="hidden md:inline uppercase tracking-widest">Agendar</span>
                        </button>
                    </div>
                </header>

                {/* GRADE DA AGENDA */}
                <div className="flex-1 flex overflow-hidden relative">
                    {isLoading && (
                        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                            <Loader2 className="animate-spin text-orange-500" size={40} />
                        </div>
                    )}

                    {fetchError ? (
                        <div className="absolute inset-0 z-50 bg-slate-50 flex items-center justify-center p-6 text-center">
                            <div className="max-w-xs space-y-4">
                                <AlertTriangle className="mx-auto text-orange-500" size={48} />
                                <h3 className="font-black text-slate-800 uppercase tracking-tight">Ops! Erro ao carregar</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{fetchError}</p>
                                <button onClick={fetchData} className="w-full bg-slate-900 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest">Tentar Novamente</button>
                            </div>
                        </div>
                    ) : (
                        <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-hide relative bg-slate-50 touch-action-pan-x">
                            <div className="inline-grid min-w-full" style={{ gridTemplateColumns: `60px repeat(${visibleProfIds.length}, ${currentColWidth}px)`, minHeight: '100%' }}>
                                {/* HEADER FIXO COLUNAS */}
                                <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 h-20"></div>
                                {professionals.filter(p => visibleProfIds.includes(p.id)).map((prof) => (
                                    <div key={prof.id} className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 border-r border-slate-100 flex items-center justify-center p-2">
                                        <div className="flex items-center gap-3 w-full px-3 py-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                            {renderAvatar(prof, "w-10 h-10")}
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-[10px] font-black text-slate-800 truncate leading-tight uppercase">{prof.name.split(' ')[0]}</span>
                                                <span className="text-[8px] font-bold text-slate-400 truncate uppercase tracking-widest">Especialista</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* COLUNA DE HORÁRIOS */}
                                <div className="relative border-r border-slate-200 bg-white/50 z-20">
                                    {timeSlots.map(time => {
                                        const isHour = time.endsWith(':00');
                                        return (
                                            <div key={time} className={`text-right pr-3 text-[10px] font-black pt-1.5 border-b border-slate-100/30 border-dashed ${isHour ? 'text-slate-500' : 'text-slate-300'}`} style={{ height: `${(intervalMin / 60) * BASE_ROW_HEIGHT}px` }}>
                                                {isHour && <span>{time}</span>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* CÉLULAS E CARDS */}
                                {professionals.filter(p => visibleProfIds.includes(p.id)).map(prof => (
                                    <div key={prof.id} className="relative border-r border-slate-100 min-h-full">
                                        {/* Linha do Tempo Vermelha */}
                                        {nowPosition !== null && visibleProfIds[0] === prof.id && (
                                            <div className="absolute left-0 z-30 pointer-events-none flex items-center" style={{ top: `${nowPosition}px`, width: `${visibleProfIds.length * currentColWidth}px` }}>
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] -ml-1.5"></div>
                                                <div className="h-0.5 bg-red-500 flex-1 opacity-40"></div>
                                            </div>
                                        )}

                                        {/* Áreas Clicáveis para Novo Agendamento */}
                                        {timeSlots.map((time, i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => {
                                                    const [h, m] = time.split(':').map(Number);
                                                    const start = new Date(currentDate); start.setHours(h, m, 0, 0);
                                                    setModalState({ type: 'appointment', data: { start, professional: prof } });
                                                }}
                                                className="border-b border-slate-100/20 border-dashed cursor-cell hover:bg-orange-50/30 transition-colors"
                                                style={{ height: `${(intervalMin / 60) * BASE_ROW_HEIGHT}px` }}
                                            ></div>
                                        ))}

                                        {/* Cards de Agendamento - Filtro Normalizado */}
                                        {appointments.filter(app => Number(app.professional.id) === prof.id).map(app => {
                                            const isOnline = (app as any).origem === 'link';
                                            const isBlock = app.status === 'bloqueado';
                                            return (
                                                <div
                                                    key={app.id}
                                                    ref={(el) => { appointmentRefs.current.set(app.id, el); }}
                                                    onClick={(e) => { e.stopPropagation(); setActiveDetail(app); }}
                                                    style={getAppStyle(app)}
                                                    className={`absolute left-1/2 -translate-x-1/2 w-[95%] rounded-2xl shadow-lg p-2.5 cursor-pointer hover:scale-[1.02] hover:shadow-2xl transition-all z-10 overflow-hidden text-white flex flex-col justify-center border border-white/20 ${isBlock ? 'opacity-60 bg-slate-400' : ''}`}
                                                >
                                                    {isOnline && !isBlock && <div className="absolute top-1.5 right-1.5 bg-white/30 px-1.5 py-0.5 rounded-full backdrop-blur-md"><Globe size={10} className="text-white" /></div>}
                                                    <p className="font-black truncate text-[11px] uppercase leading-none mb-1">{app.client?.nome || 'BLOQUEIO'}</p>
                                                    <p className="text-[9px] font-bold truncate opacity-80 leading-tight">{app.service.name}</p>
                                                    {isBlock && <Lock size={12} className="absolute bottom-2 right-2 opacity-30" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAIS E OVERLAYS */}
            {modalState?.type === 'appointment' && (
                <AppointmentModal 
                    appointment={modalState.data} 
                    onClose={() => setModalState(null)} 
                    onSave={async (app) => {
                        setModalState(null);
                        setIsLoading(true);
                        try {
                            const payload = {
                                client_name: app.client?.nome || 'Cliente',
                                service_name: app.service.name || 'Serviço',
                                resource_id: app.professional.id,
                                professional_name: app.professional.name,
                                date: app.start.toISOString(),
                                end_date: app.end.toISOString(),
                                value: app.service.price || 0,
                                status: app.status || 'agendado',
                                origem: 'interno'
                            };
                            const { error } = await supabase.from('appointments').insert([payload]);
                            if (error) throw error;
                            showToast("Agendamento salvo!");
                            fetchData(); // RECARGA IMEDIATA
                        } catch (e: any) {
                            alert("Erro ao salvar: " + (e.message || "Erro inesperado"));
                        } finally {
                            setIsLoading(false);
                        }
                    }} 
                />
            )}
            
            {activeDetail && (
                <AppointmentDetailPopover 
                    appointment={activeDetail} 
                    targetElement={appointmentRefs.current.get(activeDetail.id) || null} 
                    onClose={() => setActiveDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={async (id) => { 
                        if(window.confirm("Excluir agendamento?")){ 
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
