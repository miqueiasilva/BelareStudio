
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Use legacy types with aliases to match mock data structure and resolve type errors.
import { LegacyAppointment as Appointment, LegacyProfessional as Professional, Client, LegacyService as Service, AppointmentStatus } from '../../types';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Bell, MessageSquare, Search, UserCheck, UserX, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

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

const AppointmentCard: React.FC<{ app: Appointment }> = ({ app }) => {
    const START_HOUR = 9;
    const ROW_HEIGHT_PX = 40; // Corresponde a 30 minutos
    const MINUTES_IN_ROW = 30;

    const startMinutes = app.start.getHours() * 60 + app.start.getMinutes();
    const endMinutes = app.end.getHours() * 60 + app.end.getMinutes();

    const pixelsPerMinute = ROW_HEIGHT_PX / MINUTES_IN_ROW;
    const top = Math.floor((startMinutes - START_HOUR * 60) * pixelsPerMinute);
    const height = Math.floor((endMinutes - startMinutes) * pixelsPerMinute);
    
    return (
        <div
            className={`absolute p-2 rounded-none border text-[11px] leading-tight cursor-pointer hover:ring-2 hover:ring-[#705336] transition-all duration-200 ${statusClasses[app.status]}`}
            style={{ 
                position: 'absolute',
                top: `${top}px`, 
                left: '0px',
                width: '100%',
                height: `${height}px`,
                margin: '0px',
                zIndex: 20
            }}
            title={`${format(app.start, 'HH:mm')} - ${app.client?.nome || 'Bloqueado'} (${app.service.name})`}
        >
            <p className="font-bold truncate">{format(app.start, 'HH:mm')} - {format(app.end, 'HH:mm')}</p>
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
            const ROW_HEIGHT_PX = 40; 
            const MINUTES_IN_ROW = 30;
            const startOfDayMinutes = START_HOUR * 60;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            
            if (nowMinutes < startOfDayMinutes) {
                setTopPosition(-1); 
                return;
            }

            const top = ((nowMinutes - startOfDayMinutes) / MINUTES_IN_ROW) * ROW_HEIGHT_PX;
            setTopPosition(top);
        };

        calculatePosition();
        const intervalId = setInterval(calculatePosition, 60000); 

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
    const { activeStudioId } = useStudio();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [profSearch, setProfSearch] = useState('');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [team_members, setTeamMembers] = useState<Professional[]>([]);
    const [loading, setLoading] = useState(true);
    const [visibleProfessionals, setVisibleProfessionals] = useState<number[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!activeStudioId) return;
            setLoading(true);
            try {
                // Fetch Professionals
                const { data: profsData, error: profsError } = await supabase
                    .from('team_members')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .eq('active', true);
                
                if (profsError) throw profsError;
                
                const mappedProfs = (profsData || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}&background=random`
                }));
                setProfessionals(mappedProfs);
                setVisibleProfessionals(mappedProfs.map(p => p.id));

                // Fetch Appointments for the day
                const start = startOfDay(currentDate);
                const end = endOfDay(currentDate);

                const { data: apptsData, error: apptsError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .gte('date', start.toISOString())
                    .lte('date', end.toISOString());

                if (apptsError) throw apptsError;

                const mappedAppts = (apptsData || []).map(row => {
                    const s = new Date(row.date);
                    const d = row.duration || 30;
                    const e = new Date(s.getTime() + d * 60000);
                    return {
                        id: row.id,
                        start: s,
                        end: e,
                        status: row.status as AppointmentStatus,
                        client: { id: row.client_id, nome: row.client_name || 'Cliente', consent: true },
                        professional: mappedProfs.find(p => p.id === row.professional_id) || { id: row.professional_id, name: row.professional_name, avatarUrl: '' },
                        service: { id: 0, name: row.service_name, price: row.value, duration: d, color: row.service_color || 'blue' }
                    } as Appointment;
                });
                setAppointments(mappedAppts);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeStudioId, currentDate]);

    const filteredProfList = useMemo(() => 
        team_members.filter(p => p.name.toLowerCase().includes(profSearch.toLowerCase())),
        [team_members, profSearch]
    );

    const handleProfessionalToggle = (id: number) => {
        setVisibleProfessionals(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const selectAllProfs = () => setVisibleProfessionals(team_members.map(p => p.id));
    const clearProfs = () => setVisibleProfessionals([]);
    const focusProf = (id: number) => setVisibleProfessionals([id]);

    const filteredProfessionals = useMemo(
        () => team_members.filter(p => visibleProfessionals.includes(p.id)),
        [team_members, visibleProfessionals]
    );

    const timeSlots = Array.from({ length: 20 }, (_, i) => {
        const hour = 9 + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });

    return (
        <div className="flex flex-col h-full bg-white">
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
                {loading ? (
                    <div className="flex-1 flex items-center justify-center bg-slate-50">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Carregando Dashboard...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <aside className="w-64 border-r border-slate-200 p-4 space-y-6 overflow-y-auto bg-slate-50/50">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissionais</h3>
                            <div className="flex gap-1">
                                <button 
                                    onClick={selectAllProfs}
                                    title="Selecionar Todos"
                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                >
                                    <UserCheck size={14} />
                                </button>
                                <button 
                                    onClick={clearProfs}
                                    title="Limpar Seleção"
                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                >
                                    <UserX size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text"
                                placeholder="Buscar..."
                                value={profSearch}
                                onChange={(e) => setProfSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#705336]/20 focus:border-[#705336] outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                            {filteredProfList.map(prof => (
                                <div 
                                    key={prof.id} 
                                    className={`group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                                        visibleProfessionals.includes(prof.id) 
                                        ? 'bg-white border border-slate-200 shadow-sm' 
                                        : 'hover:bg-slate-100 border border-transparent'
                                    }`}
                                    onClick={() => handleProfessionalToggle(prof.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <img src={prof.avatarUrl} alt={prof.name} className="w-7 h-7 rounded-full object-cover border border-slate-100" />
                                            {visibleProfessionals.includes(prof.id) && (
                                                <div className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                                            )}
                                        </div>
                                        <span className={`text-xs font-bold truncate max-w-[100px] ${visibleProfessionals.includes(prof.id) ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {prof.name}
                                        </span>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            focusProf(prof.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-[10px] font-black text-[#705336] uppercase tracking-tighter transition-all"
                                    >
                                        Focar
                                    </button>
                                </div>
                            ))}
                            {filteredProfList.length === 0 && (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4 uppercase tracking-widest">Nenhum profissional encontrado</p>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Legenda</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {Object.entries(statusClasses).map(([status, classes]) => (
                                <div key={status} className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full border ${classes.split(' ')[0]} ${classes.split(' ')[1]}`}></div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{status.replace('_', ' ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

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
                            <div className="border-r border-slate-200">
                                {timeSlots.map(time => (
                                    <div key={time} className="h-10 text-right pr-2 text-xs text-slate-500 relative">
                                        <span className="absolute -top-[7px] right-2">{time}</span>
                                    </div>
                                ))}
                            </div>

                            {filteredProfessionals.map(prof => (
                                <div 
                                    key={prof.id} 
                                    className="relative !p-0 !m-0 border-r border-slate-200"
                                    style={{ minHeight: `${timeSlots.length * 40}px` }}
                                >
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
                    </>
                )}
            </div>
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
