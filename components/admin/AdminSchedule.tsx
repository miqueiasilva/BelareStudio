
import React, { useState } from 'react';
import Card from '../shared/Card';
// FIX: Use legacy types with aliases to match mock data structure and resolve type errors.
import { LegacyAppointment as Appointment, LegacyService as Service, LegacyProfessional as Professional, Client, AppointmentStatus } from '../../types';
import { Calendar, Clock, User, Scissors, DollarSign, Tag, Info, X } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

// Mock Data
// FIX: Update mock client data to use 'nome' instead of 'name' and add 'consent' property to match the Client type.
const clients: Client[] = [
    { id: 1, nome: 'Juliana Paes', consent: true },
    { id: 2, nome: 'Bruno Gagliasso', consent: true },
    { id: 3, nome: 'Marina Ruy Barbosa', consent: true },
    { id: 4, nome: 'Cauã Reymond', consent: true }
];

const professionals: Professional[] = [
    // FIX: Removed 'specialty' property as it does not exist in the 'Professional' type.
    { id: 1, name: 'Maria Silva', avatarUrl: 'https://i.pravatar.cc/150?img=1' },
    // FIX: Removed 'specialty' property as it does not exist in the 'Professional' type.
    { id: 2, name: 'João Pereira', avatarUrl: 'https://i.pravatar.cc/150?img=2' },
];

const services: Service[] = [
    // FIX: Added required 'color' property.
    { id: 1, name: 'Corte Feminino', duration: 60, price: 90, color: 'blue' },
    // FIX: Added required 'color' property.
    { id: 2, name: 'Corte Masculino & Barba', duration: 45, price: 75, color: 'blue' },
    // FIX: Added required 'color' property.
    { id: 3, name: 'Manicure', duration: 30, price: 30, color: 'blue' },
];

const today = new Date();
const appointments: Appointment[] = [
    { id: 1, client: clients[0], professional: professionals[0], service: services[0], start: new Date(today.setHours(9, 0, 0)), end: new Date(today.setHours(10, 0, 0)), status: 'concluido' },
    { id: 2, client: clients[1], professional: professionals[1], service: services[1], start: new Date(today.setHours(10, 0, 0)), end: new Date(today.setHours(10, 45, 0)), status: 'concluido' },
    { id: 3, client: clients[2], professional: professionals[0], service: services[0], start: new Date(today.setHours(11, 0, 0)), end: new Date(today.setHours(12, 0, 0)), status: 'confirmado' },
    { id: 4, client: clients[3], professional: professionals[1], service: services[1], start: new Date(today.setHours(14, 0, 0)), end: new Date(today.setHours(14, 45, 0)), status: 'agendado' },
    { id: 5, client: clients[0], professional: professionals[0], service: services[2], start: new Date(today.setHours(15, 0, 0)), end: new Date(today.setHours(15, 30, 0)), status: 'agendado' },
];

// FIX: Added missing 'faltou' and 'em_atendimento' properties to satisfy the AppointmentStatus type.
// FIX: Added missing 'chegou' property and aligned colors for consistency.
// FIX: Added missing 'confirmado_whatsapp' property to satisfy the AppointmentStatus type.
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
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const todayStr = format(today, "EEEE, dd 'de' MMMM", { locale: pt });

    return (
        <Card title="Agenda Inteligente do Dia" icon={<Calendar className="w-5 h-5" />}>
            <p className="text-sm text-slate-500 mb-4 capitalize">{todayStr}</p>
            <div className="space-y-3">
                {appointments.map(app => (
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
                ))}
            </div>
            {selectedAppointment && <AppointmentModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} />}
        </Card>
    );
};

export default AdminSchedule;