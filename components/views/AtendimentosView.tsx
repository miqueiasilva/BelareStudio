
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { LegacyAppointment, FinancialTransaction, AppointmentStatus, LegacyProfessional, LegacyService, Client } from '../../types';
import { Loader2, Plus, Calendar, ChevronLeft, ChevronRight, Bell, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import Toast, { ToastType } from '../shared/Toast';
import AppointmentModal from '../modals/AppointmentModal';

interface AtendimentosViewProps {
  onAddTransaction: (t: FinancialTransaction) => void;
}

const AtendimentosView: React.FC<AtendimentosViewProps> = ({ onAddTransaction }) => {
    const [appointments, setAppointments] = useState<LegacyAppointment[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [modalState, setModalState] = useState<LegacyAppointment | Partial<LegacyAppointment> | null>(null);

    // FIX: fetchAppointments function to retrieve data from Supabase and map it to LegacyAppointment type.
    const fetchAppointments = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .order('date', { ascending: false });
            
            if (error) throw error;
            
            // Map Supabase columns to LegacyAppointment interface properties.
            const mapped: LegacyAppointment[] = (data || []).map(app => ({
                id: app.id,
                client: { nome: app.client_name, consent: true } as Client,
                professional: { id: app.resource_id, name: app.professional_name, avatarUrl: '' } as LegacyProfessional,
                service: { name: app.service_name, price: app.value, duration: app.duration, color: 'blue' } as LegacyService,
                start: new Date(app.date),
                end: new Date(new Date(app.date).getTime() + (app.duration || 30) * 60000),
                status: app.status as AppointmentStatus,
                notas: app.notes
            }));
            
            setAppointments(mapped);
        } catch (e: any) {
            console.error("Error fetching appointments:", e);
            setToast({ message: 'Erro ao carregar agendamentos.', type: 'error' });
        } finally {
            setIsLoadingData(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    // FIX: handleSaveAppointment integrated with correct variable names (supabase, appointments, setIsLoadingData, setToast, setModalState, fetchAppointments).
    const handleSaveAppointment = async (app: LegacyAppointment) => {
        setIsLoadingData(true);
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
                origin: 'manual' // Define explicitamente como manual
            };
            if (app.id && appointments.some(a => a.id === app.id)) {
                const { error } = await supabase.from('appointments').update(payload).eq('id', app.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('appointments').insert([payload]);
                if (error) throw error;
            }
            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null);
            fetchAppointments();
        } catch (e: any) { 
            setToast({ message: 'Erro ao salvar.', type: 'error' }); 
        } finally { 
            setIsLoadingData(false); 
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Calendar className="text-orange-500" /> Agenda de Atendimentos
                    </h1>
                    <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-slate-500 text-xs font-bold uppercase tracking-wider">
                         <span className="capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: pt })}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                      onClick={() => setModalState({ status: 'agendado', start: new Date() })}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-100 active:scale-95"
                  >
                      <Plus size={18} /> Novo Agendamento
                  </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6">
                {isLoadingData && appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                        <p className="text-xs font-black uppercase tracking-widest">Sincronizando agenda...</p>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-60">
                        <Calendar size={64} className="mb-4" />
                        <p className="font-bold">Nenhum agendamento registrado ainda.</p>
                        <button onClick={() => setModalState({ status: 'agendado', start: new Date() })} className="text-orange-500 font-bold hover:underline mt-2">Agendar o primeiro cliente</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                        {appointments.map(app => (
                            <div 
                                key={app.id} 
                                onClick={() => setModalState(app)}
                                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group flex flex-col justify-between h-40"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                            {format(app.start, 'HH:mm')}
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                            app.status === 'concluido' ? 'bg-green-100 text-green-700' : 
                                            app.status === 'cancelado' ? 'bg-rose-100 text-rose-700' :
                                            'bg-orange-100 text-orange-700'
                                        }`}>
                                            {app.status}
                                        </span>
                                    </div>
                                    <h4 className="font-black text-slate-800 text-base leading-tight group-hover:text-orange-600 transition-colors truncate">{app.client?.nome || 'Bloqueado'}</h4>
                                    <p className="text-xs text-slate-500 font-medium mt-1 truncate">{app.service.name}</p>
                                </div>
                                <div className="flex items-center gap-2 pt-3 border-t border-slate-50 mt-auto">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black uppercase text-slate-500">
                                        {app.professional.name?.charAt(0)}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 truncate">{app.professional.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

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
