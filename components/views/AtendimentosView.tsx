
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
    ChevronLeft, ChevronRight, Plus, MessageSquare, 
    RefreshCw, User as UserIcon, Calendar as CalendarIcon,
    Scissors, Lock, AlertCircle, Trash2, Edit2, ShieldAlert,
    ArrowLeft, ArrowRight
} from 'lucide-react';
import { format, addDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, differenceInMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';

import { LegacyAppointment, AppointmentStatus, FinancialTransaction, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
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
    type: 'professional' | 'date';
    display_order?: number;
    data?: any; 
}

interface AtendimentosViewProps {
    onAddTransaction: (t: FinancialTransaction) => void;
}

type PeriodType = 'Dia' | 'Semana';

const getAppointmentStyle = (start: Date, end: Date) => {
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const top = (startMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE;
    const height = Math.max(30, (endMinutes - startMinutes) * PIXELS_PER_MINUTE);
    return { top: `${top}px`, height: `${height - 2}px` };
};

const AtendimentosView: React.FC<AtendimentosViewProps> = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [periodType, setPeriodType] = useState<PeriodType>('Dia');
    
    // UI States
    const [modalState, setModalState] = useState<{ type: 'appointment' | 'block'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<LegacyAppointment | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; time: string; column: DynamicColumn } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());
    const abortControllerRef = useRef<AbortController | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    }, []);

    const fetchResources = async (signal?: AbortSignal) => {
        try {
            // FIX: Adicionado .order('display_order') para permitir reordenação manual
            const { data, error } = await supabase
                .from('professionals')
                .select('id, name, photo_url, role, display_order')
                .eq('active', true)
                .order('display_order', { ascending: true })
                .abortSignal(signal!);
            
            if (error) throw error;
            const mapped = (data || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`,
                role: p.role,
                display_order: p.display_order
            }));
            setResources(mapped);
            return mapped;
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Erro recursos:", e);
            return resources;
        }
    };

    const fetchAppointments = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoadingData(true);
        setFetchError(null);

        try {
            const currentResources = await fetchResources(controller.signal);
            const { data, error } = await supabase.from('appointments').select('*').abortSignal(controller.signal);
            if (error) throw error;

            if (data) {
                const mapped: LegacyAppointment[] = data.map(row => {
                    const startTime = new Date(row.date); 
                    const endTime = row.end_date ? new Date(row.end_date) : new Date(startTime.getTime() + 30 * 60000);
                    let matchedProf = currentResources.find(p => p.id === Number(row.resource_id)) || { id: Number(row.resource_id), name: row.professional_name || 'Profissional', avatarUrl: '' };

                    return {
                        id: row.id,
                        start: startTime,
                        end: endTime,
                        status: (row.status as AppointmentStatus) || 'agendado',
                        notas: row.notes || '',
                        client: { id: row.id, nome: row.client_name || 'Cliente', consent: true },
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
                setAppointments(mapped);
            }
        } catch (e: any) {
            if (e.name === 'AbortError') setFetchError("A conexão expirou.");
            else setFetchError(e.message || "Erro na sincronização.");
        } finally {
            setIsLoadingData(false);
        }
    }, [resources]);

    useEffect(() => {
        fetchAppointments();
        return () => abortControllerRef.current?.abort();
    }, [currentDate]);

    // FIX: Função de Reordenação de Colunas
    const handleMoveColumn = async (prof: LegacyProfessional, direction: 'left' | 'right') => {
        const index = resources.findIndex(p => p.id === prof.id);
        const targetIndex = direction === 'left' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= resources.length) return;

        const targetProf = resources[targetIndex];
        const currentOrder = (prof as any).display_order || 0;
        const targetOrder = (targetProf as any).display_order || 0;

        setIsLoadingData(true);
        try {
            await supabase.from('professionals').update({ display_order: targetOrder }).eq('id', prof.id);
            await supabase.from('professionals').update({ display_order: currentOrder }).eq('id', targetProf.id);
            fetchAppointments();
        } catch (err: any) {
            alert("Erro ao reordenar: " + err.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        setModalState(null); 
        setIsLoadingData(true);
        try {
            const isBlock = app.status === 'bloqueado';
            const payload = {
                client_name: isBlock ? 'HORÁRIO BLOQUEADO' : (app.client?.nome || 'Cliente'),
                service_name: isBlock ? 'Indisponível' : (app.service?.name || 'Serviço'),
                professional_name: app.professional?.name || 'Profissional', 
                resource_id: Number(app.professional?.id) || 1,            
                date: app.start.toISOString(),
                end_date: app.end.toISOString(),
                value: isBlock ? 0 : (Number(app.service?.price) || 0),
                status: app.status || 'agendado',
                notes: app.notas || '',
                color: isBlock ? '#94a3b8' : (app.service?.color || '#3b82f6'),
                type: isBlock ? 'block' : 'appointment',
                origem: (app as any).origem || 'interno'
            };

            const { error } = app.id && app.id < 1e12 
                ? await supabase.from('appointments').update(payload).eq('id', app.id)
                : await supabase.from('appointments').insert([payload]);

            if (error) throw error;
            showToast(isBlock ? 'Horário bloqueado com sucesso!' : 'Agendamento salvo!');
            await fetchAppointments();
        } catch (error: any) {
            alert("Falha ao salvar no banco de dados: " + error.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleCellClick = (time: string, col: DynamicColumn) => {
        const [hour, min] = time.split(':').map(Number);
        let start = new Date(currentDate);
        if (col.type === 'date') start = new Date(col.data);
        start.setHours(hour, min, 0, 0);

        setModalState({ 
            type: 'appointment', 
            data: { 
                start, 
                professional: col.type === 'professional' ? col.data : resources[0] 
            } 
        });
    };

    const handleContextMenu = (e: React.MouseEvent, time: string, col: DynamicColumn) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, time, column: col });
    };

    const handleContextAction = (type: 'appointment' | 'block') => {
        if (!contextMenu) return;
        const [hour, min] = contextMenu.time.split(':').map(Number);
        let start = new Date(currentDate);
        if (contextMenu.column.type === 'date') start = new Date(contextMenu.column.data);
        start.setHours(hour, min, 0, 0);

        if (type === 'block') {
            const end = new Date(start.getTime() + 60 * 60000);
            handleSaveAppointment({
                id: 0, start, end, status: 'bloqueado',
                professional: contextMenu.column.type === 'professional' ? contextMenu.column.data : resources[0],
                service: { id: 0, name: 'Bloqueio', price: 0, duration: 60, color: '#94a3b8' }
            } as any);
        } else {
            setModalState({ 
                type: 'appointment', 
                data: { start, professional: contextMenu.column.type === 'professional' ? contextMenu.column.data : resources[0] } 
            });
        }
        setContextMenu(null);
    };

    const columns = useMemo<DynamicColumn[]>(() => {
        if (periodType === 'Semana') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end }).map(day => ({ 
                id: day.toISOString(), title: format(day, 'EEE', { locale: pt }), subtitle: format(day, 'dd/MM'), type: 'date', data: day 
            }));
        }
        return resources.map(p => ({ id: p.id, title: p.name, photo: p.avatarUrl, type: 'professional', data: p }));
    }, [periodType, currentDate, resources]);

    const gridStyle = { gridTemplateColumns: `60px repeat(${columns.length}, minmax(200px, 1fr))` };
    const timeSlots = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => { 
        const h = START_HOUR + Math.floor(i / 2);
        return `${String(h).padStart(2, '0')}:${(i % 2) * 30 === 0 ? '00' : '30'}`;
    });

    return (
        <div className="flex h-full bg-white relative flex-col overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-[60]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        Agenda {isLoadingData && <RefreshCw className="animate-spin text-orange-400" size={20} />}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-black uppercase transition-all">HOJE</button>
                        <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate, professional: resources[0] } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"><Plus size={20} /> Agendar</button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800"><ChevronLeft size={24} /></button>
                    <span className="text-xl font-black text-slate-800 capitalize min-w-[200px] text-center">{format(currentDate, "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                    <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-800"><ChevronRight size={24} /></button>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-slate-50 relative">
                <div className="relative min-h-full min-w-full">
                    <div className="grid sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm" style={gridStyle}>
                        <div className="border-r border-slate-100 h-24 bg-white sticky left-0 z-50"></div>
                        {columns.map((col, idx) => (
                            <div key={col.id} className="flex flex-col items-center justify-center p-4 border-r border-slate-100 h-24 relative group/header">
                                <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 min-w-[160px] relative">
                                    {col.photo ? <img src={col.photo} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" /> : <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><UserIcon size={20} /></div>}
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-black text-slate-800 truncate">{col.title}</span>
                                        {col.subtitle && <span className="text-[10px] font-bold text-slate-400">{col.subtitle}</span>}
                                    </div>
                                    
                                    {/* FIX: Botões de Reordenação de Coluna */}
                                    {periodType === 'Dia' && col.type === 'professional' && (
                                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover/header:opacity-100 transition-all">
                                            {idx > 0 && (
                                                <button onClick={(e) => { e.stopPropagation(); handleMoveColumn(col.data, 'left'); }} className="p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-orange-500 shadow-sm">
                                                    <ChevronLeft size={14} />
                                                </button>
                                            )}
                                            {idx < columns.length - 1 && (
                                                <button onClick={(e) => { e.stopPropagation(); handleMoveColumn(col.data, 'right'); }} className="p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-orange-500 shadow-sm">
                                                    <ChevronRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid relative" style={gridStyle}>
                        <div className="border-r border-slate-100 bg-white sticky left-0 z-30">
                            {timeSlots.map(time => <div key={time} className="h-20 text-right pr-3 text-[11px] text-slate-400 font-black pt-2 border-b border-slate-100/50 border-dashed"><span>{time}</span></div>)}
                        </div>
                        {columns.map((col) => (
                            <div key={col.id} className="relative border-r border-slate-100 min-h-[1000px]">
                                {timeSlots.map((time, i) => (
                                    <div 
                                        key={i} 
                                        className="h-20 border-b border-slate-100/30 border-dashed cursor-cell hover:bg-orange-50/10 transition-colors" 
                                        onClick={() => handleCellClick(time, col)}
                                        onContextMenu={(e) => handleContextMenu(e, time, col)}
                                    ></div>
                                ))}
                                {appointments.filter(app => periodType === 'Semana' ? isSameDay(app.start, col.data) : Number(app.professional.id) === Number(col.id)).filter(app => periodType === 'Semana' || isSameDay(app.start, currentDate)).map(app => {
                                    // FIX: UX DE CARD INTELIGENTE
                                    const duration = differenceInMinutes(app.end, app.start);
                                    const isShort = duration <= 30;

                                    return (
                                        <div
                                            key={app.id}
                                            ref={(el) => { appointmentRefs.current.set(app.id, el); }}
                                            onClick={(e) => { e.stopPropagation(); setActiveAppointmentDetail(app); }}
                                            className={`absolute w-[94%] left-1/2 -translate-x-1/2 rounded-xl shadow-sm border p-1 cursor-pointer hover:scale-[1.01] transition-all z-10 overflow-hidden bg-white hover:border-orange-200 group`}
                                            style={getAppointmentStyle(app.start, app.end)}
                                        >
                                            <div style={{ backgroundColor: app.service.color }} className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                                            <div className="pl-2 h-full flex flex-col justify-start overflow-hidden">
                                                <p className="font-black text-slate-800 truncate text-[10px] uppercase leading-tight">
                                                    {app.client?.nome || 'BLOQUEIO'}
                                                </p>
                                                {!isShort && (
                                                    <p className="text-[9px] font-bold text-slate-500 truncate leading-tight opacity-80">
                                                        {app.service.name}
                                                    </p>
                                                )}
                                                {duration > 45 && (
                                                    <span className="text-[8px] font-black text-slate-400 mt-0.5 uppercase">
                                                        {format(app.start, 'HH:mm')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modals & Context Menus */}
            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} y={contextMenu.y} 
                    onClose={() => setContextMenu(null)}
                    options={[
                        { label: 'Novo Agendamento', icon: <Plus size={16}/>, onClick: () => handleContextAction('appointment') },
                        { label: 'Bloquear Horário', icon: <Lock size={16} className="text-slate-500"/>, onClick: () => handleContextAction('block'), className: 'text-slate-600' }
                    ]}
                />
            )}

            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
            
            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={async (id) => { 
                        if(window.confirm("Remover agendamento?")){ 
                            await supabase.from('appointments').delete().eq('id', id); 
                            fetchAppointments(); 
                            setActiveAppointmentDetail(null); 
                        }
                    }} 
                    onUpdateStatus={async (id, status) => { 
                        await supabase.from('appointments').update({ status }).eq('id', id); 
                        fetchAppointments(); 
                        setActiveAppointmentDetail(null); 
                    }} 
                />
            )}
        </div>
    );
};

export default AtendimentosView;
