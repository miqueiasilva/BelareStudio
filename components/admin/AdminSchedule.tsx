
import React, { useState, useEffect } from 'react';
import Card from '../shared/Card';
// FIX: Use legacy types with aliases to match mock data structure and resolve type errors.
import { LegacyAppointment as Appointment, LegacyService as Service, LegacyProfessional as Professional, Client, AppointmentStatus } from '../../types';
import { Calendar, Clock, User, Scissors, DollarSign, Tag, Info, X, Loader2 } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
// FIX: Corrected locale import path to 'date-fns/locale/pt-BR' to resolve "no exported member 'ptBR'" error.
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

const statusStyles: { [key in AppointmentStatus]: { bg: string, text: string, border: string } } = {
    agendado: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' },
    confirmado: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-500' },
    confirmado_whatsapp: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-500' },
    chegou: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-500' },
    em_atendimento: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-500' },
    concluido: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' },
    cancelado: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' },
    // FIX: Added missing 'bloqueado' property to satisfy the AppointmentStatus type.
    bloqueado: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-400' },
    faltou: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500' },
    em_espera: { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-300' },
};

const AppointmentModal = ({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-lg font-bold">Detalhes do Agendamento</h3>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><X /></button>
            </div>
            <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-cyan-500" />
                    <div>
                        <p className="text-xs text-slate-500">Cliente</p>
                        {/* FIX: Use 'nome' property from Client type instead of 'name'. Added non-null assertion as client is required here. */}
                        <p className="font-semibold">{appointment.client?.nome}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Scissors className="w-5 h-5 text-cyan-500" />
                    <div>
                        <p className="text-xs text-slate-500">Profissional</p>
                        <p className="font-semibold">{appointment.professional.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Tag className="w-5 h-5 text-cyan-500" />
                    <div>
                        <p className="text-xs text-slate-500">Serviço</p>
                        <p className="font-semibold">{appointment.service.name}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-cyan-500" />
                        <div>
                            <p className="text-xs text-slate-500">Horário</p>
                            <p className="font-semibold">{format(appointment.start, 'HH:mm')} - {format(appointment.end, 'HH:mm')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-cyan-500" />
                        <div>
                            <p className="text-xs text-slate-500">Valor</p>
                            <p className="font-semibold">R$ {appointment.service.price.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <Info className="w-5 h-5 text-cyan-500" />
                    <div>
                        <p className="text-xs text-slate-500">Status</p>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[appointment.status].bg} ${statusStyles[appointment.status].text}`}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
);


const AdminSchedule: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const today = new Date();

    useEffect(() => {
        const fetchAppointments = async () => {
            if (!activeStudioId) return;
            setLoading(true);
            try {
                const start = startOfDay(today);
                const end = endOfDay(today);

                const { data, error } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .gte('date', start.toISOString())
                    .lte('date', end.toISOString())
                    .order('date', { ascending: true });

                if (error) throw error;

                const mapped = (data || []).map(row => {
                    const s = new Date(row.date);
                    const d = row.duration || 30;
                    const e = new Date(s.getTime() + d * 60000);
                    return {
                        id: row.id,
                        start: s,
                        end: e,
                        status: row.status as AppointmentStatus,
                        client: { id: row.client_id, nome: row.client_name || 'Cliente', consent: true },
                        professional: { id: row.professional_id, name: row.professional_name, avatarUrl: '' },
                        service: { id: 0, name: row.service_name, price: row.value, duration: d, color: row.service_color || 'blue' }
                    } as Appointment;
                });
                setAppointments(mapped);
            } catch (error) {
                console.error("Error fetching schedule:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, [activeStudioId]);
    const todayStr = format(today, "EEEE, dd 'de' MMMM", { locale: pt });

    return (
        <Card title="Agenda Inteligente do Dia" icon={<Calendar className="w-5 h-5" />}>
            <p className="text-sm text-slate-500 mb-4 capitalize">{todayStr}</p>
            <div className="space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando...</p>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm font-medium">Nenhum agendamento hoje</p>
                    </div>
                ) : (
                    appointments.map(app => (
                    <button key={app.id} onClick={() => setSelectedAppointment(app)} className="w-full text-left">
                        <div className={`p-3 rounded-lg flex items-center gap-4 transition-all hover:shadow-md ${statusStyles[app.status].bg} border-l-4 ${statusStyles[app.status].border}`}>
                            <div className="font-bold text-sm min-w-[90px] text-center">
                                <p className={statusStyles[app.status].text}>{format(app.start, 'HH:mm')}</p>
                                <p className="text-xs text-slate-500">às {format(app.end, 'HH:mm')}</p>
                            </div>
                            <div className="w-px h-10 bg-slate-300"></div>
                            <div className="flex-1">
                                <p className={`font-semibold ${statusStyles[app.status].text}`}>{app.service.name}</p>
                                {/* FIX: Use 'nome' property from Client type instead of 'name'. Added non-null assertion as client is required here. */}
                                <p className="text-xs text-slate-600">{app.client?.nome} com {app.professional.name}</p>
                            </div>
                            <span className={`hidden sm:inline-block px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[app.status].bg} ${statusStyles[app.status].text} border ${statusStyles[app.status].border}`}>
                                {app.status}
                            </span>
                        </div>
                    </button>
                )))}
            </div>
            {selectedAppointment && <AppointmentModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} />}
        </Card>
    );
};

export default AdminSchedule;
