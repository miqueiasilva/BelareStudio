
import { 
    format, addDays, isSameDay, startOfDay, addMinutes, 
    isAfter, isBefore, getDay, parseISO, subDays,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, addMonths, subMonths, isSameMonth
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import ToggleSwitch from '../shared/ToggleSwitch';
import ClientAppointmentsModal from '../modals/ClientAppointmentsModal';
import React, { useState, useMemo, useEffect } from 'react';
import { 
    ChevronLeft, Check, Star, Search, Image as ImageIcon, 
    ChevronDown, ChevronUp, Share2, Loader2, MapPin, Phone, 
    User, Mail, ShoppingBag, Clock, Calendar, Scissors, 
    CheckCircle2, ArrowRight, UserCircle2, X, AlertTriangle,
    ArrowLeft, ChevronRight
} from 'lucide-react';

const DEFAULT_COVER = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1350&q=80";
const DEFAULT_LOGO = "https://ui-avatars.com/api/?name=BelareStudio&background=random";

const ServiceItem = ({ service, isSelected, onToggle }: any) => (
    <div 
        onClick={(e) => { e.stopPropagation(); onToggle(service); }}
        className={`p-4 flex justify-between items-center border-b border-slate-50 last:border-0 cursor-pointer transition-all active:scale-[0.98] ${isSelected ? 'bg-orange-50/50' : 'hover:bg-slate-50'}`}
    >
        <div className="flex-1 pr-4">
            <h4 className="font-bold text-slate-800 text-sm">{service.nome || service.name}</h4>
            <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                    <Clock size={10} /> {service.duracao_min} min
                </span>
                <span className="text-orange-600 font-black text-sm">
                    R$ {Number(service.preco).toFixed(2)}
                </span>
            </div>
        </div>
        <button 
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isSelected 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' 
                : 'border-2 border-slate-100 text-slate-300'
            }`}
        >
            {isSelected ? <Check size={20} /> : <Plus size={20} />}
        </button>
    </div>
);

const AccordionCategory = ({ category, services, selectedIds, onToggleService, defaultOpen = false }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const selectedCount = services.filter((s: any) => selectedIds.includes(s.id)).length;

    return (
        <div className="mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-200">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-5 flex items-center justify-between transition-colors ${isOpen ? 'bg-slate-50/50 border-b border-slate-50' : 'bg-white hover:bg-slate-50'}`}
            >
                <div className="flex items-center gap-3">
                    <h3 className={`font-black text-sm uppercase tracking-widest transition-colors ${isOpen ? 'text-orange-600' : 'text-slate-800'}`}>
                        {category}
                    </h3>
                    {selectedCount > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                            {selectedCount}
                        </span>
                    )}
                </div>
                <div className={`p-1.5 rounded-lg transition-all duration-300 ${isOpen ? 'bg-orange-100 text-orange-600 rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronDown size={18} />
                </div>
            </button>
            
            {isOpen && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                    {services.map((s: any) => (
                        <ServiceItem 
                            key={s.id} 
                            service={s} 
                            isSelected={selectedIds.includes(s.id)}
                            onToggle={onToggleService}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const Plus = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
    </svg>
);

const PublicBookingPreview: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [studio, setStudio] = useState<any>(null);
    const [services, setServices] = useState<any[]>([]);
    const [popularServiceIds, setPopularServiceIds] = useState<number[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    
    // UI State
    const [selectedServices, setSelectedServices] = useState<any[]>([]);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [isClientAppsOpen, setIsClientAppsOpen] = useState(false);
    const [bookingStep, setBookingStep] = useState(1); 

    // Regras de Agendamento Dinâmicas
    const [rules, setRules] = useState({
        windowDays: 30,
        minNoticeMinutes: 120, 
        cancellationHours: 24
    });

    // Appointment Choices
    const [selectedProfessional, setSelectedProfessional] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    // Form Data
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');

    const weekdayMap: Record<number, string> = {
        0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday'
    };

    useEffect(() => {
        const fetchRulesAndData = async () => {
            setLoading(true);
            try {
                const { data: studioData } = await supabase
                    .from('studio_settings')
                    .select('*')
                    .limit(1)
                    .maybeSingle();

                if (studioData) {
                    setStudio(studioData);
                    let rawNotice = parseFloat(studioData.min_scheduling_notice || '2');
                    let finalNoticeMinutes = rawNotice < 48 ? rawNotice * 60 : rawNotice;

                    setRules({
                        windowDays: parseInt(studioData.max_scheduling_window || '30', 10),
                        minNoticeMinutes: Math.round(finalNoticeMinutes),
                        cancellationHours: parseInt(studioData.cancellation_notice || '24', 10)
                    });
                }

                const { data: servicesData } = await supabase.from('services').select('*').eq('ativo', true);
                if (servicesData) setServices(servicesData);

                const { data: profsData } = await supabase
                    .from('team_members')
                    .select('id, name, photo_url, role')
                    .eq('active', true)
                    .eq('online_booking_enabled', true)
                    .order('order_index');
                
                if (profsData) setProfessionals(profsData);

                const sixtyDaysAgo = subDays(new Date(), 60).toISOString();
                const { data: recentApps } = await supabase
                    .from('appointments')
                    .select('service_name') 
                    .gte('date', sixtyDaysAgo)
                    .in('status', ['concluido', 'agendado', 'confirmado', 'confirmado_whatsapp']);

                if (recentApps && recentApps.length > 5) {
                    const counts: Record<string, number> = {};
                    recentApps.forEach(app => {
                        counts[app.service_name] = (counts[app.service_name] || 0) + 1;
                    });
                    const sortedNames = Object.entries(counts)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([name]) => name);
                    const topIds = servicesData?.filter(s => sortedNames.includes(s.nome)).map(s => s.id) || [];
                    setPopularServiceIds(topIds);
                }

            } catch (e) {
                console.error("Erro ao buscar regras:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchRulesAndData();
    }, []);

    const calendarDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end });
    }, [viewMonth]);

    const horizonLimit = useMemo(() => addDays(startOfDay(new Date()), rules.windowDays), [rules.windowDays]);

    const handlePrevMonth = () => {
        const prev = subMonths(viewMonth, 1);
        if (!isBefore(endOfMonth(prev), startOfMonth(new Date()))) {
            setViewMonth(prev);
        }
    };

    const handleNextMonth = () => {
        const next = addMonths(viewMonth, 1);
        if (!isAfter(startOfMonth(next), horizonLimit)) {
            setViewMonth(next);
        }
    };

    const generateAvailableSlots = async (date: Date, professional: any) => {
        if (!studio || selectedServices.length === 0) return;
        setIsLoadingSlots(true);
        setSelectedTime(null);

        try {
            const dayKey = weekdayMap[getDay(date)];
            const businessHours = studio.business_hours?.[dayKey];

            if (!businessHours || !businessHours.active) {
                setAvailableSlots([]);
                return;
            }

            const totalDuration = selectedServices.reduce((acc, s) => acc + s.duracao_min, 0);
            const now = new Date();
            const minTimeLimit = addMinutes(now, rules.minNoticeMinutes);

            // Sincronizando com professional_id (estável) para busca de slots livres
            const { data: busyAppointments } = await supabase
                .from('appointments')
                .select('date, duration')
                .eq('professional_id', professional?.id)
                .neq('status', 'cancelado')
                .gte('date', startOfDay(date).toISOString())
                .lte('date', addDays(startOfDay(date), 1).toISOString());

            const slots: string[] = [];
            const [startH, startM] = businessHours.start.split(':').map(Number);
            const [endH, endM] = businessHours.end.split(':').map(Number);
            
            let currentPointer = new Date(date);
            currentPointer.setHours(startH, startM, 0, 0);
            
            const endLimit = new Date(date);
            endLimit.setHours(endH, endM, 0, 0);

            while (isBefore(addMinutes(currentPointer, totalDuration), endLimit)) {
                if (isSameDay(date, now)) {
                    if (isBefore(currentPointer, minTimeLimit)) {
                        currentPointer = addMinutes(currentPointer, 30);
                        continue;
                    }
                }

                const hasOverlap = busyAppointments?.some(app => {
                    const appStart = parseISO(app.date);
                    const appEnd = addMinutes(appStart, app.duration);
                    const slotStart = currentPointer;
                    const slotEnd = addMinutes(currentPointer, totalDuration);
                    return (slotStart < appEnd) && (slotEnd > appStart);
                });

                if (!hasOverlap) {
                    slots.push(format(currentPointer, 'HH:mm'));
                }
                currentPointer = addMinutes(currentPointer, 30); 
            }
            setAvailableSlots(slots);
        } catch (e) {
            console.error("Erro ao gerar slots", e);
        } finally {
            setIsLoadingSlots(false);
        }
    };

    useEffect(() => {
        if (bookingStep === 2 && selectedDate && selectedProfessional) {
            generateAvailableSlots(selectedDate, selectedProfessional);
        }
    }, [selectedDate, selectedProfessional, bookingStep, selectedServices, rules]);

    const handleSubmitBooking = async () => {
        if (!clientName || !clientPhone || !selectedTime) return;
        setIsFinalizing(true);

        try {
            const cleanPhone = clientPhone.replace(/\D/g, '');
            if (cleanPhone.length < 10) throw new Error("Informe um WhatsApp válido.");

            const { data: existingClient } = await supabase
                .from('clients')
                .select('id, nome')
                .eq('whatsapp', cleanPhone)
                .maybeSingle();

            let clientId: number;
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const { data: newClient } = await supabase
                    .from('clients')
                    .insert([{ nome: clientName, whatsapp: cleanPhone, consent: true, origem: 'Link Público' }])
                    .select().single();
                clientId = newClient.id;
            }

            const [h, m] = selectedTime.split(':').map(Number);
            const appointmentDate = new Date(selectedDate);
            appointmentDate.setHours(h, m, 0, 0);

            const totalDuration = selectedServices.reduce((acc, s) => acc + s.duracao_min, 0);
            const totalValue = selectedServices.reduce((acc, s) => acc + Number(s.preco), 0);
            const serviceNames = selectedServices.map(s => s.nome || s.name).join(' + ');

            // Enviar estritamente professional_id. resource_id é gerado no DB como espelho.
            const { error: apptErr } = await supabase
                .from('appointments')
                .insert([{
                    client_id: clientId,
                    client_name: clientName,
                    client_whatsapp: cleanPhone,
                    professional_id: selectedProfessional.id,
                    professional_name: selectedProfessional.name,
                    service_name: serviceNames,
                    value: totalValue,
                    duration: totalDuration,
                    date: appointmentDate.toISOString(),
                    status: 'agendado',
                    origem: 'link'
                }]);

            if (apptErr) throw apptErr;
            setBookingSuccess(true);
        } catch (e: any) {
            alert(`Falha no agendamento: ${e.message}`);
        } finally {
            setIsFinalizing(false);
        }
    };

    const servicesByCategory = useMemo(() => {
        const groups: Record<string, any[]> = {};
        if (popularServiceIds.length >= 3) {
            groups['⭐ Mais Populares'] = services.filter(s => popularServiceIds.includes(s.id));
        }
        services.forEach(s => {
            const cat = s.categoria || 'Outros';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });
        return groups;
    }, [services, popularServiceIds]);

    const totalPrice = useMemo(() => {
        return selectedServices.reduce((acc, s) => acc + Number(s.preco), 0);
    }, [selectedServices]);

    const toggleService = (service: any) => {
        setSelectedServices(prev => {
            const isAlreadySelected = prev.find(s => s.id === service.id);
            if (isAlreadySelected) return prev.filter(s => s.id !== service.id);
            return [...prev, service];
        });
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <div className="relative">
                <Loader2 className="animate-spin text-orange-500 w-12 h-12 mb-4" />
                <div className="absolute inset-0 border-4 border-orange-100 rounded-full animate-ping opacity-20"></div>
            </div>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Sincronizando com BelareStudio...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans relative pb-40 text-left">
            
            {user && (
                <button 
                    onClick={() => window.location.hash = '#/'}
                    className="fixed top-4 left-4 z-[60] bg-white/90 backdrop-blur-sm hover:bg-white text-slate-800 px-5 py-2.5 rounded-full shadow-2xl border border-slate-100 flex items-center gap-2 transition-all duration-300 font-black text-xs uppercase tracking-widest group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform text-orange-500" />
                    Voltar ao Painel
                </button>
            )}

            <div 
                className="relative w-full h-56 md:h-72 lg:h-96 bg-slate-200 bg-cover bg-center transition-all duration-500 overflow-hidden"
                style={{ backgroundImage: `url(${studio?.cover_url || DEFAULT_COVER})` }}
            >
                <div className="absolute inset-0 bg-slate-900/30"></div>
                <button 
                    onClick={() => setIsClientAppsOpen(true)}
                    className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20 shadow-xl z-20"
                >
                    <UserCircle2 size={20} />
                    <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Meus Agendamentos</span>
                </button>
            </div>

            <div className="max-w-xl mx-auto px-6 -mt-16 relative z-10 text-center">
                <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-[28px] bg-white border-4 border-white shadow-xl -mt-20 overflow-hidden mb-4 flex items-center justify-center">
                        {studio?.profile_url ? (
                            <img src={studio.profile_url} className="w-full h-full object-cover" alt="Logo" />
                        ) : (
                            <div className="w-full h-full bg-orange-100 text-orange-50 flex items-center justify-center font-black text-2xl">{studio?.studio_name?.charAt(0) || 'B'}</div>
                        )}
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 leading-tight">{studio?.studio_name || "Seu Estúdio de Beleza"}</h1>
                    <div className="flex flex-col items-center gap-2 mt-2 text-slate-400">
                        <div className="flex items-center gap-1 text-amber-400 font-bold"><Star size={14} fill="currentColor" /> 5.0</div>
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-500 leading-tight">
                            <MapPin size={14} className="text-orange-500" /> 
                            <span>{studio?.address_street ? `${studio.address_street}, ${studio.address_number || ''}` : "Endereço não informado"}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-2 text-left">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Serviços Disponíveis</h2>
                    {Object.entries(servicesByCategory).map(([cat, items]) => (
                        <AccordionCategory 
                            key={cat} category={cat} services={items} 
                            selectedIds={selectedServices.map(s => s.id)} onToggleService={toggleService}
                            defaultOpen={cat === '⭐ Mais Populares'} 
                        />
                    ))}
                </div>
            </div>

            {selectedServices.length > 0 && !isBookingOpen && (
                <div className="fixed bottom-0 left-0 right-0 p-6 z-40 bg-gradient-to-t from-white via-white to-white/80 backdrop-blur-md border-t border-slate-100 animate-in slide-in-from-bottom-full duration-500">
                    <div className="max-w-xl mx-auto flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedServices.length} selecionados</p>
                            <p className="text-xl font-black text-slate-800">Total R$ {totalPrice.toFixed(2)}</p>
                        </div>
                        <button onClick={() => { setIsBookingOpen(true); setBookingStep(1); }} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">Continuar <ArrowRight size={20} /></button>
                    </div>
                </div>
            )}

            {isBookingOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {bookingSuccess ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center space-y-6">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><CheckCircle2 size={56} /></div>
                                <h2 className="text-2xl font-black text-slate-800">Reserva Confirmada!</h2>
                                <button onClick={() => window.location.reload()} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black shadow-xl">Voltar ao Início</button>
                            </div>
                        ) : (
                            <>
                                <header className="p-6 border-b border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {bookingStep > 1 && (
                                            <button onClick={() => setBookingStep(prev => prev - 1)} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:bg-slate-200 transition-all"><ChevronLeft size={20} /></button>
                                        )}
                                        <div>
                                            <h3 className="font-black text-slate-800">
                                                {bookingStep === 1 && "Escolha o Profissional"}
                                                {bookingStep === 2 && "Data e Horário"}
                                                {bookingStep === 3 && "Confirmar Reserva"}
                                            </h3>
                                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Passo {bookingStep} de 3</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsBookingOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors text-slate-400"><X size={24}/></button>
                                </header>

                                <main className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30 text-left">
                                    {bookingStep === 1 && (
                                        <div className="space-y-4">
                                            {professionals.map(p => (
                                                <button 
                                                    key={p.id} onClick={() => { setSelectedProfessional(p); setBookingStep(2); }}
                                                    className={`w-full p-5 flex items-center gap-4 border-2 rounded-3xl transition-all text-left bg-white ${selectedProfessional?.id === p.id ? 'border-orange-500 bg-orange-50/30' : 'border-slate-100 hover:border-orange-200'}`}
                                                >
                                                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-100 flex items-center justify-center">
                                                        {p.photo_url || p.avatarUrl ? (
                                                            <img src={p.photo_url || p.avatarUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User size={24} className="text-slate-300" />
                                                        )}
                                                    </div>
                                                    <div><p className="font-bold text-slate-800 text-base">{p.name}</p><p className="text-xs text-slate-400 mt-1 font-medium">{p.role}</p></div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {bookingStep === 2 && (
                                        <div className="space-y-8 animate-in fade-in duration-300">
                                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                                        <Calendar size={18} className="text-orange-500" />
                                                        <span className="capitalize">{format(viewMonth, 'MMMM yyyy', { locale: pt })}</span>
                                                    </h4>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={handlePrevMonth} 
                                                            disabled={isSameMonth(viewMonth, new Date())}
                                                            className="p-2 rounded-xl border border-slate-100 hover:bg-slate-50 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            <ChevronLeft size={20} />
                                                        </button>
                                                        <button 
                                                            onClick={handleNextMonth} 
                                                            disabled={isAfter(endOfMonth(viewMonth), horizonLimit)}
                                                            className="p-2 rounded-xl border border-slate-100 hover:bg-slate-50 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            <ChevronRight size={20} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-7 gap-1">
                                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                                                        <div key={d} className="text-center text-[10px] font-black text-slate-400 py-2 tracking-widest">{d}</div>
                                                    ))}
                                                    {calendarDays.map((day) => {
                                                        const isToday = isSameDay(day, new Date());
                                                        const isSelected = isSameDay(day, selectedDate);
                                                        const isCurrentMonth = isSameMonth(day, viewMonth);
                                                        const isPast = isBefore(day, startOfDay(new Date()));
                                                        const isOverLimit = isAfter(day, horizonLimit);
                                                        const dayKey = weekdayMap[getDay(day)];
                                                        const isClosed = !studio?.business_hours?.[dayKey]?.active;
                                                        
                                                        const isDisabled = isPast || isOverLimit || isClosed;

                                                        return (
                                                            <button
                                                                key={day.toISOString()}
                                                                disabled={isDisabled}
                                                                onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                                                                className={`
                                                                    aspect-square rounded-2xl flex items-center justify-center text-sm font-bold transition-all relative
                                                                    ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : ''}
                                                                    ${isSelected ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-110 z-10' : 
                                                                      isDisabled ? 'text-slate-300 cursor-not-allowed' : 
                                                                      'text-slate-600 hover:bg-orange-50 hover:text-orange-600'}
                                                                `}
                                                            >
                                                                {format(day, 'd')}
                                                                {isToday && !isSelected && (
                                                                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-500"></div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 ml-1">
                                                    <Clock size={16} className="text-slate-400" />
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Horários para {format(selectedDate, "dd/MM")}</h4>
                                                </div>
                                                
                                                {isLoadingSlots ? (
                                                    <div className="py-10 text-center text-slate-400 flex flex-col items-center"><Loader2 className="animate-spin mb-2" /><p className="text-xs font-bold">Consultando agenda...</p></div>
                                                ) : availableSlots.length > 0 ? (
                                                    <div className="grid grid-cols-4 gap-2 animate-in slide-in-from-top-2">
                                                        {availableSlots.map(time => (
                                                            <button 
                                                                key={time} 
                                                                onClick={() => setSelectedTime(time)} 
                                                                className={`py-3 rounded-xl text-sm font-black border-2 transition-all ${selectedTime === time ? 'bg-slate-800 border-slate-800 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-600 hover:border-orange-300'}`}
                                                            >
                                                                {time}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 bg-slate-100/50 rounded-[32px] border border-dashed border-slate-200 text-center">
                                                        <Clock className="mx-auto text-slate-300 mb-2 opacity-40" size={32} />
                                                        <p className="text-sm font-bold text-slate-400 leading-tight">Nenhum horário livre para este dia.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {selectedTime && (
                                                <button onClick={() => setBookingStep(3)} className="w-full bg-slate-800 text-white py-5 rounded-3xl font-black shadow-xl flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2 transition-transform active:scale-95">Continuar <ArrowRight size={20} /></button>
                                            )}
                                        </div>
                                    )}

                                    {bookingStep === 3 && (
                                        <div className="space-y-6 animate-in fade-in duration-300">
                                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                                <div className="flex items-center gap-4 pb-4 border-b border-slate-50">
                                                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-inner">
                                                        <Calendar size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumo do Horário</p>
                                                        <p className="text-base font-black text-slate-800">{format(selectedDate, "dd 'de' MMMM", { locale: pt })} às {selectedTime}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                                                    <span className="text-xs font-black uppercase text-slate-400">Total</span>
                                                    <span className="text-xl font-black text-orange-600">R$ {totalPrice.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Seu Nome Completo</label>
                                                    <input value={clientName} onChange={e => setClientName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold shadow-sm focus:ring-4 focus:ring-orange-100 transition-all" placeholder="Como devemos te chamar?" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">WhatsApp para Lembrete</label>
                                                    <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 outline-none font-bold shadow-sm focus:ring-4 focus:ring-orange-100 transition-all" placeholder="(00) 00000-0000" />
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={handleSubmitBooking} 
                                                disabled={isFinalizing || !clientName || clientPhone.length < 10} 
                                                className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-3xl font-black shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                            >
                                                {isFinalizing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />} 
                                                Finalizar Agendamento
                                            </button>
                                        </div>
                                    )}
                                </main>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isClientAppsOpen && <ClientAppointmentsModal onClose={() => setIsClientAppsOpen(false)} />}
        </div>
    );
};

export default PublicBookingPreview;
