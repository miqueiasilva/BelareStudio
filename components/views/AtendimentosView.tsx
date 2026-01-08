
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Maximize2, Plus, Ban, X, Loader2, DollarSign, CheckCircle } from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { LegacyAppointment, AppointmentStatus, LegacyProfessional } from '../../types';
import AppointmentModal from '../modals/AppointmentModal';
import AppointmentDetailPopover from '../shared/AppointmentDetailPopover';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const START_HOUR = 8;
const END_HOUR = 20; 

const AtendimentosView: React.FC<any> = ({ onNavigateToCommand }) => {
    const { user, loading: authLoading } = useAuth(); 
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [resources, setResources] = useState<LegacyProfessional[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [modalState, setModalState] = useState<{ type: 'appointment'; data: any } | null>(null);
    const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<any | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const appointmentRefs = useRef(new Map<number, HTMLDivElement | null>());

    // BUSCA VIA CLIENTE SDK (NUNCA REST DIRETO)
    const loadAppointments = async (date: Date) => {
        if (authLoading || !user) return;
        setIsLoadingData(true);
        try {
            const start = startOfDay(date).toISOString();
            const end = endOfDay(date).toISOString();

            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id, client_id, service_id, professional_id, date, status, origin, created_at,
                    clients!client_id(id, nome, whatsapp),
                    services!service_id(id, nome, preco, cor_hex, duracao_min),
                    team_members!professional_id(id, name, photo_url)
                `)
                .gte('date', start)
                .lte('date', end)
                .neq('status', 'cancelado')
                .order('date', { ascending: true });

            if (error) {
                console.error("LOAD appointments error:", {
                    message: error?.message,
                    details: error?.details,
                    hint: error?.hint,
                    code: error?.code,
                    full: error
                });
                throw error;
            }

            const mapped = (data || []).map(row => ({
                id: row.id,
                start: parseISO(row.date),
                end: new Date(parseISO(row.date).getTime() + (row.services?.duracao_min || 30) * 60000),
                status: row.status,
                client: { id: row.client_id, nome: row.clients?.nome || 'Cliente' },
                professional: { id: row.professional_id, name: row.team_members?.name || 'Profissional' },
                service: { 
                    id: row.service_id, 
                    name: row.services?.nome || 'Serviço', 
                    price: row.services?.preco || 0, 
                    color: row.services?.cor_hex || '#3b82f6' 
                }
            }));

            setAppointments(mapped);
        } catch (e) {
            console.error("Sync Error:", e);
        } finally {
            setIsLoadingData(false);
        }
    };

    const fetchResources = async () => {
        const { data } = await supabase.from('team_members').select('*').eq('active', true).order('order_index');
        if (data) {
            setResources(data.map((p: any) => ({
                id: p.id, name: p.name, avatarUrl: p.photo_url || `https://ui-avatars.com/api/?name=${p.name}`
            })));
        }
    };

    useEffect(() => { fetchResources(); }, []);

    useEffect(() => {
        if (resources.length > 0) loadAppointments(currentDate);
    }, [currentDate, resources, user, authLoading]);

    const handleSaveAppointment = async (app: any) => {
        setIsLoadingData(true);
        try {
            const payload = {
                client_id: Number(app.client?.id),
                service_id: Number(app.service.id),
                professional_id: String(app.professional.id),
                date: app.start.toISOString(),
                status: app.status || 'agendado',
                origin: 'agenda'
            };

            console.log("INSERT appointments payload:", payload);

            const { error } = await supabase.from('appointments').insert([payload]);
            
            if (error) {
                console.error("INSERT appointments error:", {
                    message: error?.message,
                    details: error?.details,
                    hint: error?.hint,
                    code: error?.code,
                    full: error
                });
                throw error;
            }

            setToast({ message: 'Agendamento salvo!', type: 'success' });
            setModalState(null);
            
            // REFRESH IMEDIATO DA LISTA
            await loadAppointments(currentDate);
        } catch (e: any) {
            setToast({ message: 'Erro ao salvar agendamento.', type: 'error' });
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: AppointmentStatus) => {
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
        if (!error) await loadAppointments(currentDate);
        setActiveAppointmentDetail(null);
    };

    return (
        <div className="flex h-full bg-white relative flex-col font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 z-30 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Agenda {isLoadingData && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}</h2>
                    <button onClick={() => setModalState({ type: 'appointment', data: { start: currentDate } })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all active:scale-95">Novo Agendamento</button>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200">HOJE</button>
                    <div className="flex items-center gap-1 text-slate-500">
                        <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                        <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
                    </div>
                    <span className="text-orange-500 font-bold text-lg capitalize">{format(currentDate, "EEE, dd 'de' MMMM", { locale: pt })}</span>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
                <div className="min-w-fit">
                    <div className="grid sticky top-0 z-[50] border-b border-slate-200 bg-white shadow-sm" style={{ gridTemplateColumns: `60px repeat(${resources.length}, 220px)` }}>
                        <div className="sticky left-0 z-[60] bg-white border-r border-slate-200 h-20 flex items-center justify-center"><Maximize2 size={16} className="text-slate-300" /></div>
                        {resources.map((res) => (
                            <div key={res.id} className="flex flex-col items-center justify-center p-2 border-r border-slate-100 h-20 bg-white">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden">
                                    <img src={res.avatarUrl} className="w-8 h-8 rounded-full object-cover" />
                                    <span className="text-[11px] font-black text-slate-800 truncate">{res.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${resources.length}, 220px)` }}>
                        <div className="sticky left-0 z-[50] bg-white border-r border-slate-200">
                            {Array.from({ length: 24 }).map((_, i) => {
                                const hour = 8 + Math.floor(i / 2);
                                const min = (i % 2) * 30;
                                const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                return (
                                    <div key={time} className="h-20 text-right pr-3 text-[10px] text-slate-400 font-black relative border-b border-slate-100/50 border-dashed bg-white">
                                        <span className="absolute top-0 right-3 -translate-y-1/2 bg-white px-1 z-10">{time}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {resources.map((res) => (
                            <div key={res.id} className="relative border-r border-slate-200 min-h-[960px]">
                                {appointments.filter(app => String(app.professional.id) === String(res.id)).map(app => {
                                    const startMinutes = (app.start.getHours() * 60 + app.start.getMinutes()) - (8 * 60);
                                    const durMinutes = (app.end.getTime() - app.start.getTime()) / 60000;
                                    const top = (startMinutes / 30) * 80;
                                    const height = (durMinutes / 30) * 80;

                                    return (
                                        <div 
                                            key={app.id} 
                                            ref={(el) => appointmentRefs.current.set(app.id, el)}
                                            onClick={() => setActiveAppointmentDetail(app)}
                                            className="absolute left-0 right-0 p-1.5 border-l-4 rounded-none shadow-sm cursor-pointer hover:brightness-95 transition-all overflow-hidden"
                                            style={{ 
                                                top: `${top}px`, 
                                                height: `${height}px`, 
                                                borderLeftColor: app.service.color,
                                                backgroundColor: `${app.service.color}15`,
                                                zIndex: 20
                                            }}
                                        >
                                            <p className="text-[10px] font-black text-slate-500 leading-none">{format(app.start, 'HH:mm')}</p>
                                            <p className="text-xs font-bold text-slate-800 truncate">{app.client.nome}</p>
                                            <p className="text-[9px] text-slate-400 font-medium truncate uppercase">{app.service.name}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {activeAppointmentDetail && (
                <AppointmentDetailPopover 
                    appointment={activeAppointmentDetail} 
                    targetElement={appointmentRefs.current.get(activeAppointmentDetail.id) || null} 
                    onClose={() => setActiveAppointmentDetail(null)} 
                    onEdit={(app) => setModalState({ type: 'appointment', data: app })} 
                    onDelete={() => {}} 
                    onUpdateStatus={handleUpdateStatus}
                />
            )}
            
            {modalState?.type === 'appointment' && <AppointmentModal appointment={modalState.data} onClose={() => setModalState(null)} onSave={handleSaveAppointment} />}
        </div>
    );
};

export default AtendimentosView;
