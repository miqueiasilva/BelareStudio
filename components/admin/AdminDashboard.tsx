
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Use legacy types with aliases to match mock data structure and resolve type errors.
import { LegacyAppointment as Appointment, LegacyProfessional as Professional, Client, LegacyService as Service, AppointmentStatus } from '../../types';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Bell, MessageSquare } from 'lucide-react';

// --- MOCK DATA ---
const today = new Date();
const professionals: Professional[] = [
    { id: 1, name: 'Jaciene Félix', avatarUrl: 'https://i.pravatar.cc/150?img=1' },
    { id: 2, name: 'Graziela Oliveira', avatarUrl: 'https://i.pravatar.cc/150?img=2' },
    { id: 3, name: 'Jéssica Félix', avatarUrl: 'https://i.pravatar.cc/150?img=3' },
    { id: 4, name: 'Glezia', avatarUrl: 'https://i.pravatar.cc/150?img=4' },
    { id: 5, name: 'Elá Priscila', avatarUrl: 'https://i.pravatar.cc/150?img=5' },
    { id: 6, name: 'Herlon', avatarUrl: 'https://i.pravatar.cc/150?img=6' },
];

// FIX: Update mock client data to use 'nome' instead of 'name' and add 'consent' property to match the Client type.
const clients: Client[] = [
    { id: 1, nome: 'Alemão', consent: true }, { id: 2, nome: 'Juanita Estefano', consent: true }, { id: 3, nome: 'Clara Coelho', consent: true },
    { id: 4, nome: 'Eliude Alves', consent: true }, { id: 5, nome: 'Janniles', consent: true }, { id: 6, nome: 'Bárbara Salles', consent: true }, { id: 7, nome: 'Naná', consent: true }
];

// FIX: Use LegacyService type which matches the mock data structure (name, duration, price, color).
const services: { [key: string]: Service } = {
    designSimples: { id: 1, name: 'Design Simples', duration: 30, price: 50, color: 'blue' },
    designComTintura: { id: 2, name: 'Design Com Tintura', duration: 40, price: 70, color: 'blue' },
    limpezaMicro: { id: 3, name: 'Limpeza Micro', duration: 30, price: 60, color: 'blue' },
    designComHenna: { id: 4, name: 'Design Com Henna', duration: 40, price: 75, color: 'blue' },
    volumeEgipcio: { id: 5, name: 'Volume EGÍPCIO', duration: 110, price: 250, color: 'blue' },
    manutencaoVolume: { id: 6, name: 'Manutenção Volume Brasileiro 21 Dias', duration: 150, price: 180, color: 'blue' },
    limpezaPele: { id: 7, name: 'Limpeza de Pele Premium', duration: 50, price: 120, color: 'blue' },
    bloqueio: { id: 8, name: 'Horário Bloqueado', duration: 300, price: 0, color: 'gray' },
};

const createTime = (hour: number, minute: number) => {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d;
};

// FIX: Use LegacyAppointment type which matches the mock data structure (client, professional, service, start, end).
const appointments: Appointment[] = [
    { id: 1, client: clients[0], professional: professionals[0], service: services.designSimples, start: createTime(9, 30), end: createTime(10, 0), status: 'confirmado' },
    { id: 2, client: clients[1], professional: professionals[0], service: services.designComTintura, start: createTime(10, 30), end: createTime(11, 10), status: 'confirmado' },
    { id: 3, client: clients[2], professional: professionals[0], service: services.limpezaMicro, start: createTime(11, 10), end: createTime(11, 40), status: 'agendado' },
    { id: 4, client: clients[0], professional: professionals[0], service: services.designSimples, start: createTime(11, 40), end: createTime(12, 10), status: 'agendado' },
    { id: 5, client: clients[3], professional: professionals[0], service: services.designComHenna, start: createTime(14, 0), end: createTime(14, 40), status: 'concluido' },
    { id: 6, client: clients[4], professional: professionals[2], service: services.volumeEgipcio, start: createTime(9, 30), end: createTime(11, 20), status: 'confirmado' },
    { id: 7, client: clients[5], professional: professionals[2], service: services.manutencaoVolume, start: createTime(13, 30), end: createTime(16, 0), status: 'agendado' },
    { id: 8, client: clients[6], professional: professionals[4], service: services.limpezaPele, start: createTime(9, 30), end: createTime(10, 20), status: 'confirmado' },
    { id: 9, professional: professionals[3], service: services.bloqueio, start: createTime(13, 0), end: createTime(18, 0), status: 'bloqueado' },
    { id: 10, client: clients[1], professional: professionals[1], service: services.designComTintura, start: createTime(16, 30), end: createTime(17, 10), status: 'cancelado' },
];
// --- END MOCK DATA ---

// FIX: Added missing 'faltou' and 'em_atendimento' properties to satisfy the AppointmentStatus type.
// FIX: Added missing 'chegou' property to satisfy the AppointmentStatus type.
// FIX: Added missing 'confirmado_whatsapp' property to satisfy the AppointmentStatus type.
// FIX: Added missing 'em_espera' property.
const statusClasses: { [key in AppointmentStatus]: string } = {
    confirmado: 'bg-cyan-100 border-cyan-300 text-cyan-800',
    confirmado_whatsapp: 'bg-teal-100 border-teal-300 text-teal-800',
    agendado: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    chegou: 'bg-purple-100 border-purple-300 text-purple-800',
    concluido: 'bg-green-100 border-green-300 text-green-800',
    cancelado: 'bg-pink-100 border-pink-300 text-pink-800 line-through',
    bloqueado: 'bg-slate-200 border-slate-300 text-slate-600 pattern-diagonal-lines-sm pattern-slate-400 pattern-bg-slate-200 pattern-size-4 pattern-opacity-100',
    faltou: 'bg-orange-100 border-orange-300 text-orange-800 line-through',
    em_atendimento: 'bg-indigo-100 border-indigo-300 text-indigo-800 animate-pulse',
    em_espera: 'bg-stone-100 border-stone-300 text-stone-700',
};

// FIX: Changed component definition to use React.FC to resolve potential 'key' prop type errors.
const AppointmentCard: React.FC<{ app: Appointment }> = ({ app }) => {
    const START_HOUR = 9;
    const ROW_HEIGHT_PX = 40; // Corresponds to 30 minutes
    const MINUTES_IN_ROW = 30;

    const startMinutes = app.start.getHours() * 60 + app.start.getMinutes();
    const endMinutes = app.end.getHours() * 60 + app.end.getMinutes();

    const top = ((startMinutes - START_HOUR * 60) / MINUTES_IN_ROW) * ROW_HEIGHT_PX;
    const height = ((endMinutes - startMinutes) / MINUTES_IN_ROW) * ROW_HEIGHT_PX;
    
    return (
        <div
            className={`absolute w-[95%] left-1/2 -translate-x-1/2 p-2 rounded-lg border text-[11px] leading-tight cursor-pointer hover:ring-2 hover:ring-[#705336] transition-all duration-200 ${statusClasses[app.status]}`}
            style={{ top: `${top}px`, height: `${height - 4}px` }}
        >
            <p className="font-bold truncate">{format(app.start, 'HH:mm')} - {format(app.end, 'HH:mm')}</p>
            {/* FIX: Use 'nome' property from Client type instead of 'name'. */}
            {app.client && <p className="font-semibold truncate">{app.client.nome}</p>}
            <p className="truncate">{app.service.name}</p>
        </div>
    );
};

const TimelineIndicator = () => {
    const [topPosition, setTopPosition] = useState(0);

    useEffect(() => {
        const calculatePosition = () => {
            const now = new Date();
            const START_HOUR = 9;
            const ROW_HEIGHT_PX = 40; // Corresponds to 30 minutes
            const MINUTES_IN_ROW = 30;
            const startOfDayMinutes = START_HOUR * 60;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            
            if (nowMinutes < startOfDayMinutes) {
                setTopPosition(-1); // Hide if before working hours
                return;
            }

            const top = ((nowMinutes - startOfDayMinutes) / MINUTES_IN_ROW) * ROW_HEIGHT_PX;
            setTopPosition(top);
        };

        calculatePosition();
        const intervalId = setInterval(calculatePosition, 60000); // Update every minute

        return () => clearInterval(intervalId);
    }, []);
    
    if (topPosition < 0) return null;

    return (
        <div className="absolute w-full z-10" style={{ top: `${topPosition}px` }}>
            <div className="h-px bg-red-500 w-full relative">
                <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full"></div>
            </div>
        </div>
    );
};


const AdminDashboard: React.FC = () => {
    const [visibleProfessionals, setVisibleProfessionals] = useState<number[]>(professionals.map(p => p.id));

    const handleProfessionalToggle = (id: number) => {
        setVisibleProfessionals(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const filteredProfessionals = useMemo(
        () => professionals.filter(p => visibleProfessionals.includes(p.id)),
        [visibleProfessionals]
    );

    const timeSlots = Array.from({ length: 20 }, (_, i) => {
        const hour = 9 + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="flex-shrink-0 h-16 border-b border-slate-200 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800">Atendimentos</h2>
                    <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><ChevronLeft className="w-5 h-5" /></button>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span>HOJE</span>
                            <span>Seg, 03/Novembro/2025</span>
                        </div>
                        <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-2.5 rounded-md hover:bg-slate-100 text-slate-500">
                        <Bell className="w-5 h-5" />
                    </button>
                    <button className="px-4 py-2 text-sm font-semibold bg-[#705336] text-white rounded-md hover:bg-[#5a442a] transition">Agendar</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Settings Panel */}
                <aside className="w-64 border-r border-slate-200 p-4 space-y-4 overflow-y-auto">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Configurações</h3>
                    <div>
                        <label className="text-xs font-semibold">Profissionais</label>
                        <div className="mt-2 space-y-2">
                            {professionals.map(prof => (
                                <div key={prof.id} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`prof-${prof.id}`}
                                        checked={visibleProfessionals.includes(prof.id)}
                                        onChange={() => handleProfessionalToggle(prof.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-[#705336] focus:ring-[#705336]"
                                    />
                                    <label htmlFor={`prof-${prof.id}`} className="ml-2 block text-sm text-gray-900">{prof.name}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-auto">
                    <div className="sticky top-0 bg-white z-10">
                        <div className="grid" style={{ gridTemplateColumns: `60px repeat(${filteredProfessionals.length}, minmax(120px, 1fr))` }}>
                            <div className="p-2 border-b border-r border-slate-200"></div>
                            {filteredProfessionals.map(prof => (
                                <div key={prof.id} className="flex items-center gap-2 p-2 border-b border-r border-slate-200">
                                    <img src={prof.avatarUrl} alt={prof.name} className="w-8 h-8 rounded-full" />
                                    <span className="text-sm font-semibold">{prof.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="relative">
                        <div className="grid" style={{ gridTemplateColumns: `60px repeat(${filteredProfessionals.length}, minmax(120px, 1fr))` }}>
                            {/* Time Column */}
                            <div className="border-r border-slate-200">
                                {timeSlots.map(time => (
                                    <div key={time} className="h-10 text-right pr-2 text-xs text-slate-500 relative">
                                        <span className="absolute -top-[7px] right-2">{time}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Professional Columns */}
                            {filteredProfessionals.map(prof => (
                                <div key={prof.id} className="relative border-r border-slate-200">
                                    {timeSlots.map((_, index) => (
                                        <div key={index} className="h-10 border-b border-dashed border-slate-200"></div>
                                    ))}
                                    {appointments.filter(app => app.professional.id === prof.id).map(app => (
                                        <AppointmentCard key={app.id} app={app} />
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="absolute top-0 bottom-0 left-[60px] right-0 pointer-events-none">
                           <TimelineIndicator />
                        </div>
                    </div>
                </div>
            </div>
            {/* JaciBot Floating Action Button */}
            <div className="absolute bottom-6 right-6 z-20">
              <button className="w-14 h-14 bg-[#705336] rounded-full shadow-lg flex items-center justify-center text-white hover:bg-[#5a442a] transition ring-2 ring-white">
                <MessageSquare className="w-7 h-7" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center border-2 border-white">2</span>
              </button>
            </div>
        </div>
    );
};

export default AdminDashboard;
