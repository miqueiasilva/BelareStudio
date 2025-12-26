
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { LegacyAppointment, FinancialTransaction, AppointmentStatus, LegacyProfessional, LegacyService, Client } from '../../types';
import { Loader2, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, MessageCircle, Clock, User } from 'lucide-react';
import { format, startOfDay, addMinutes, differenceInMinutes } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';
import AppointmentModal from '../modals/AppointmentModal';

const START_HOUR = 8;
const END_HOUR = 19;
const ROW_HEIGHT = 80; // Pixels por hora
const TIME_LABEL_WIDTH = 60;

const AtendimentosView: React.FC<{ onAddTransaction: (t: FinancialTransaction) => void }> = ({ onAddTransaction }) => {
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [modalState, setModalState] = useState<LegacyAppointment | Partial<LegacyAppointment> | null>(null);

    const timeSlots = useMemo(() => {
        const slots = [];
        for (let i = START_HOUR; i <= END_HOUR; i++) {
            slots.push(`${i.toString().padStart(2, '0')}:00`);
        }
        return slots;
    }, []);

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Buscar Profissionais para as colunas
            const { data: profs } = await supabase.from('professionals').select('*').eq('active', true).order('name');
            const mappedProfs = (profs || []).map(p => ({ id: p.id, name: p.name, avatarUrl: p.photo_url }));
            setProfessionals(mappedProfs);

            // 2. Buscar Agendamentos
            const { data: apps, error } = await supabase.from('appointments').select('*');
            if (error) throw error;
            
            const mappedApps: LegacyAppointment[] = (apps || []).map(app => ({
                id: app.id,
                client: { nome: app.client_name } as Client,
                professional: { id: app.resource_id, name: app.professional_name } as LegacyProfessional,
                service: { name: app.service_name, price: app.value, duration: app.duration },
                start: new Date(app.date),
                end: addMinutes(new Date(app.date), app.duration || 30),
                status: app.status as AppointmentStatus,
                origin: (app as any).origin
            })) as any;
            
            setAppointments(mappedApps);
        } catch (e: any) {
            setToast({ message: 'Erro ao carregar dados.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

    const handleSaveAppointment = async (app: LegacyAppointment) => {
        // ... lógica de salvamento existente mantida para integridade com o banco
        setIsLoading(true);
        try {
            const payload = {
                client_name: app.client?.nome, 
                resource_id: app.professional.id, 
                professional_name: app.professional.name,
                service_name: app.service.name, 
                value: app.service.price, 
                duration: app.service.duration,
                date: app.start.toISOString(), 
                status: app.status, 
                notes: app.notas,
                origin: 'manual'
            };
            if (app.id) {
                await supabase.from('appointments').update(payload).eq('id', app.id);
            } else {
                await supabase.from('appointments').insert([payload]);
            }
            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null);
            fetchInitialData();
        } catch (e) {
            setToast({ message: 'Erro ao salvar.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const calculatePosition = (date: Date, duration: number) => {
        const hours = date.getHours() + date.getMinutes() / 60;
        const relativeHours = hours - START_HOUR;
        return {
            top: relativeHours * ROW_HEIGHT,
            height: (duration / 60) * ROW_HEIGHT
        };
    };

    const statusColors: any = {
        agendado: 'bg-amber-50 border-amber-200 text-amber-700',
        confirmado: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        concluido: 'bg-slate-100 border-slate-300 text-slate-500 opacity-60',
        cancelado: 'bg-rose-50 border-rose-200 text-rose-400 line-through'
    };

    if (isLoading && professionals.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                <p className="text-xs font-black uppercase tracking-widest">Montando timeline...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-30">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <CalendarIcon className="text-orange-500" /> Agenda
                    </h1>
                    <div className="bg-slate-100 px-3 py-1.5 rounded-full text-slate-600 text-xs font-black uppercase tracking-tighter">
                        {format(new Date(), "EEEE, dd 'de' MMMM", { locale: pt })}
                    </div>
                </div>
                <button 
                    onClick={() => setModalState({ status: 'agendado', start: new Date() })}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-100 active:scale-95"
                >
                    <Plus size={18} /> Novo
                </button>
            </header>

            {/* TIMELINE GRID */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                {/* Header das Colunas (Profissionais) */}
                <div className="sticky top-0 z-20 flex bg-white border-b border-slate-200" style={{ paddingLeft: TIME_LABEL_WIDTH }}>
                    {professionals.map(prof => (
                        <div key={prof.id} className="flex-1 min-w-[150px] py-4 px-2 border-l border-slate-100 flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden">
                                {prof.avatarUrl ? <img src={prof.avatarUrl} className="w-full h-full object-cover" /> : <User size={20} className="m-2 text-slate-400" />}
                            </div>
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter truncate w-full text-center">
                                {prof.name.split(' ')[0]}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="relative flex" style={{ height: (END_HOUR - START_HOUR + 1) * ROW_HEIGHT }}>
                    {/* Régua de Horários */}
                    <div className="sticky left-0 z-10 bg-white border-r border-slate-200" style={{ width: TIME_LABEL_WIDTH }}>
                        {timeSlots.map(time => (
                            <div key={time} className="text-[10px] font-black text-slate-400 flex items-start justify-center pr-2" style={{ height: ROW_HEIGHT, paddingTop: '4px' }}>
                                {time}
                            </div>
                        ))}
                    </div>

                    {/* Linhas de Grade e Colunas de Dados */}
                    <div className="absolute inset-0 flex" style={{ marginLeft: TIME_LABEL_WIDTH }}>
                        {professionals.map(prof => (
                            <div key={prof.id} className="flex-1 min-w-[150px] relative border-l border-slate-50">
                                {/* Linhas de fundo */}
                                {timeSlots.map(time => (
                                    <div key={time} className="border-b border-slate-50 w-full" style={{ height: ROW_HEIGHT }}></div>
                                ))}

                                {/* Agendamentos da Coluna */}
                                {appointments
                                    .filter(app => app.professional.id === prof.id)
                                    .map(app => {
                                        const pos = calculatePosition(app.start, app.service.duration);
                                        return (
                                            <div
                                                key={app.id}
                                                onClick={() => setModalState(app)}
                                                className={`absolute left-1 right-1 rounded-lg border-l-4 p-2 shadow-sm cursor-pointer transition-all hover:scale-[1.02] hover:z-10 group overflow-hidden ${statusColors[app.status] || 'bg-blue-50 border-blue-400'}`}
                                                style={{ top: pos.top, height: pos.height - 2 }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[9px] font-black opacity-60">{format(app.start, 'HH:mm')}</span>
                                                    {(app as any).origin === 'online' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                                                </div>
                                                <p className="text-[11px] font-black leading-tight truncate mt-0.5">{app.client?.nome || 'Bloqueado'}</p>
                                                <p className="text-[10px] font-medium opacity-80 truncate">{app.service.name}</p>
                                            </div>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {modalState && (
                <AppointmentModal 
                    appointment={modalState} 
                    onClose={() => setModalState(null)} 
                    onSave={handleSaveAppointment} 
                />
            )}
        </div>
    );
};

export default AtendimentosView;
