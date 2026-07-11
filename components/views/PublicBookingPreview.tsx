import { 
    format, addDays, isSameDay, addMinutes, 
    isAfter, isBefore, getDay, 
    endOfMonth, endOfWeek,
    eachDayOfInterval, addMonths, isSameMonth
} from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import ToggleSwitch from '../shared/ToggleSwitch';
import ClientAppointmentsModal from '../modals/ClientAppointmentsModal';
import React, { useState, useMemo, useEffect } from 'react';
import { 
    ChevronLeft, Check, Star, Search, Image as ImageIcon, 
    ChevronDown, ChevronUp, Share2, Loader2, MapPin, Phone, 
    User, Mail, ShoppingBag, Clock, Calendar, Scissors, 
    CheckCircle2, ArrowRight, UserCircle, X, AlertTriangle,
    ArrowLeft, ChevronRight
} from 'lucide-react';

const DEFAULT_COVER = "https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80";
const DEFAULT_LOGO = "https://ui-avatars.com/api/?name=BelareStudio&background=random";

const ServiceItem = ({ service, isSelected, onToggle }: any) => (
    <div 
        onClick={(e) => { e.stopPropagation(); onToggle(service); }}
        className={`group p-4 flex gap-4 items-start border-b border-slate-50 last:border-0 cursor-pointer transition-all active:scale-[0.98] ${isSelected ? 'bg-orange-50/50' : 'hover:bg-slate-50/80'}`}
    >
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-50 shadow-sm transition-transform group-hover:scale-105">
            {service.image_url ? (
                <img src={service.image_url} className="w-full h-full object-cover" alt={service.nome} />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Scissors size={24} />
                </div>
            )}
        </div>
        <div className="flex-1 min-w-0 pr-4">
            <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-orange-600 transition-colors">{service.nome || service.name}</h4>
            <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5">{service.descricao || "Serviço profissional personalizado"}</p>
            <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                    <Clock size={10} /> {service.duracao_min} min
                </span>
                <span className="text-orange-600 font-black text-sm">
                    R$ {Number(service.preco).toFixed(2)}
                </span>
            </div>
        </div>
        <button 
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                isSelected 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' 
                : 'bg-white border-2 border-slate-100 text-slate-300 group-hover:border-orange-200 group-hover:text-orange-400'
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

const getWhatsAppUrl = (phone: string, text?: string) => {
    if (!phone) return text ? `https://wa.me/?text=${encodeURIComponent(text)}` : `https://wa.me/`;
    
    // Remove todos os caracteres não-numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Se começar com zero (ex: 081995685910), remove o zero
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    
    let formattedPhone = cleanPhone;
    
    // Se não começar com 55 (DDI Brasil)
    if (!cleanPhone.startsWith('55')) {
        if (cleanPhone.length === 10 || cleanPhone.length === 11) {
            formattedPhone = `55${cleanPhone}`;
        }
    } else {
        // Se já começa com 55, verifica se tem tamanho válido (12 ou 13 dígitos)
        if (cleanPhone.length === 12 || cleanPhone.length === 13) {
            formattedPhone = cleanPhone;
        }
    }
    
    const queryParam = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${formattedPhone}${queryParam}`;
};

const PublicBookingPreview: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [studio, setStudio] = useState<any>(null);
    const [services, setServices] = useState<any[]>([]);
    const [popularServiceIds, setPopularServiceIds] = useState<number[]>([]);
    const [team_members, setTeamMembers] = useState<any[]>([]);
    
    // UI State
    const [selectedServices, setSelectedServices] = useState<any[]>([]);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [isClientAppsOpen, setIsClientAppsOpen] = useState(false);
    const [bookingStep, setBookingStep] = useState(1); 
    // FIX: Added missing selectedProfessional state and its setter.
    const [selectedProfessional, setSelectedProfessional] = useState<any>(null);

    // Regras de Agendamento Dinâmicas
    const [rules, setRules] = useState({
        windowDays: 30,
        minNoticeMinutes: 120, 
        cancellationHours: 24
    });

    // Appointment Choices
    // FIX: Manual startOfDay replacement.
    const getStartOfDay = (d: Date) => { const nd = new Date(d); nd.setHours(0, 0, 0, 0); return nd; };
    const [selectedDate, setSelectedDate] = useState<Date>(getStartOfDay(new Date()));
    // FIX: Manual startOfMonth replacement.
    const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const [viewMonth, setViewMonth] = useState<Date>(getStartOfMonth(new Date()));
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [clientActiveAppointments, setClientActiveAppointments] = useState<any[]>([]);

    // Client self-confirmation flow
    const [confirmingAppointment, setConfirmingAppointment] = useState<any>(null);
    const [confirmingStatus, setConfirmingStatus] = useState<'pending' | 'success' | 'error' | 'loading'>('pending');

    const handleConfirmBookingSelf = async () => {
        if (!confirmingAppointment) return;
        setConfirmingStatus('loading');
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ 
                    status: 'confirmado_whatsapp',
                    updated_at: new Date().toISOString()
                })
                .eq('id', confirmingAppointment.id);

            if (error) throw error;
            
            setConfirmingStatus('success');
            setConfirmingAppointment({
                ...confirmingAppointment,
                status: 'confirmado_whatsapp'
            });
        } catch (e: any) {
            console.error("Erro ao confirmar agendamento:", e);
            setConfirmingStatus('error');
        }
    };

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
                // Tenta buscar sid, slug ou apid da URL (#/public-preview?sid=ID ou #/public-preview?s=slug)
                const hashParts = window.location.hash.split('?');
                const params = new URLSearchParams(hashParts[1] || '');
                const sid = params.get('sid');
                const slug = params.get('s');
                const apid = params.get('apid');

                let targetStudioId = sid;
                let activeAppointment = null;

                if (apid) {
                    const { data: appt, error: apptErr } = await supabase
                        .from('appointments')
                        .select('*')
                        .eq('id', apid)
                        .maybeSingle();
                    if (apptErr) {
                        console.error('Erro ao buscar agendamento:', apptErr);
                    } else if (appt) {
                        activeAppointment = appt;
                        targetStudioId = targetStudioId || appt.studio_id;
                    }
                }

                if (!targetStudioId && !slug) {
                    throw new Error('Link de agendamento incompleto. O identificador do estúdio (sid) está ausente.');
                }

                let query = supabase.from('studio_settings').select('*');
                
                if (targetStudioId) {
                    query = query.or(`id.eq.${targetStudioId},studio_id.eq.${targetStudioId}`);
                } else if (slug) {
                    query = query.eq('slug', slug);
                } else {
                    query = query.limit(1);
                }

                const { data: studioData, error: studioError } = await query.maybeSingle();

                if (studioError) {
                    console.error('❌ Erro na consulta de estúdio:', studioError);
                }

                if (studioData) {
                    const studioId = targetStudioId || studioData.studio_id || studioData.id;
                    
                    if (activeAppointment) {
                        setConfirmingAppointment(activeAppointment);
                        if (['confirmado_whatsapp', 'confirmado'].includes(activeAppointment.status)) {
                            setConfirmingStatus('success');
                        } else {
                            setConfirmingStatus('pending');
                        }
                    }

                    // Buscar dados adicionais do business_settings e studios para garantir que telefone, whatsapp, nome e endereço fiquem corretos
                    let businessData = null;
                    let studioBaseData = null;

                    try {
                        const { data: bizData } = await supabase
                            .from('business_settings')
                            .select('*')
                            .or(`id.eq.${studioId},studio_id.eq.${studioId}`)
                            .maybeSingle();
                        if (bizData) {
                            businessData = bizData;
                        }
                    } catch (bizErr) {
                        console.error('Erro ao buscar business_settings no preview:', bizErr);
                    }

                    try {
                        const { data: baseData } = await supabase
                            .from('studios')
                            .select('*')
                            .eq('id', studioId)
                            .maybeSingle();
                        if (baseData) {
                            studioBaseData = baseData;
                        }
                    } catch (baseErr) {
                        console.error('Erro ao buscar studios no preview:', baseErr);
                    }

                    const resolvedPhone = businessData?.phone || studioBaseData?.contact_phone || studioData?.phone || '';
                    const resolvedWhatsapp = businessData?.whatsapp_reminder_number || businessData?.phone || studioBaseData?.contact_phone || studioData?.whatsapp || studioData?.phone || '';

                    setStudio({ 
                        ...studioData,
                        ...businessData,
                        phone: resolvedPhone,
                        whatsapp: resolvedWhatsapp,
                        studio_id: studioId,
                        // Garantir que o nome do estúdio venha do studio_settings
                        studio_name: studioData.studio_name || businessData?.business_name || studioBaseData?.name || studioData.business_name || "Seu Estúdio de Beleza",
                        address: businessData?.street ? `${businessData.street}${businessData.number ? `, ${businessData.number}` : ''}${businessData.district ? ` - ${businessData.district}` : ''}` : (studioBaseData?.address || studioData?.address || '')
                    });
                    const rawNotice = parseFloat(studioData.min_scheduling_notice || '2');
                    const finalNoticeMinutes = rawNotice < 48 ? rawNotice * 60 : rawNotice;

                    setRules({
                        windowDays: parseInt(studioData.max_scheduling_window || '30', 10),
                        minNoticeMinutes: Math.round(finalNoticeMinutes),
                        cancellationHours: parseInt(studioData.cancellation_notice || '24', 10)
                    });

                    const { data: servicesData } = await supabase.from('services').select('*').eq('ativo', true).eq('studio_id', studioId);
                    if (servicesData) setServices(servicesData);

                    // DEBUG: Check if command_id exists in clients table
                    const { data: colCheck, error: colError } = await supabase.from('clients').select('*').limit(1);
                    console.log('🔍 [DEBUG] Clients table columns check:', { 
                        columns: colCheck && colCheck.length > 0 ? Object.keys(colCheck[0]) : 'no data',
                        error: colError 
                    });

                    const { data: profsData } = await supabase
                        .from('team_members')
                        .select('id, name, photo_url, role, services_enabled, work_schedule, email')
                        .eq('active', true)
                        .eq('online_booking_enabled', true)
                        .eq('studio_id', studioId)
                        .order('order_index');
                    
                    if (profsData) setTeamMembers(profsData);

                    // Identificação de serviços populares
                    const sixtyDaysAgo = addDays(new Date(), -60).toISOString();
                    const { data: recentApps } = await supabase
                        .from('appointments')
                        .select('service_name') 
                        .eq('studio_id', studioId)
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

                    // Se o cliente já tiver agendamentos associados a este dispositivo
                    if (typeof window !== 'undefined') {
                        const savedPhone = localStorage.getItem('belare_client_phone');
                        if (savedPhone) {
                            const clean = savedPhone.replace(/\D/g, '');
                            const todayStr = new Date().toISOString();
                            const { data: activeAppts, error: activeErr } = await supabase
                                .from('appointments')
                                .select('*')
                                .eq('client_whatsapp', clean)
                                .eq('studio_id', studioId)
                                .gte('date', todayStr)
                                .neq('status', 'cancelado')
                                .order('date', { ascending: true });

                            if (!activeErr && activeAppts) {
                                setClientActiveAppointments(activeAppts);
                            }
                        }
                    }
                } else {
                    throw new Error('Estúdio não encontrado ou link inválido.');
                }

            } catch (e: any) {
                console.error("Erro ao buscar regras:", e);
                alert(e.message || "Erro ao carregar dados do estúdio.");
            } finally {
                setLoading(false);
            }
        };
        fetchRulesAndData();
    }, []);

    const calendarDays = useMemo(() => {
        // FIX: Manual startOfMonth and startOfWeek replacements.
        const sm = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 0, 0, 0, 0);
        const start = new Date(sm);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);

        const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end });
    }, [viewMonth]);

    const horizonLimit = useMemo(() => addDays(getStartOfDay(new Date()), rules.windowDays), [rules.windowDays]);

    const handlePrevMonth = () => {
        // FIX: Manual subMonths replacement using addMonths.
        const prev = addMonths(viewMonth, -1);
        if (!isBefore(endOfMonth(prev), getStartOfMonth(new Date()))) {
            setViewMonth(prev);
        }
    };

    const handleNextMonth = () => {
        const next = addMonths(viewMonth, 1);
        if (!isAfter(getStartOfMonth(next), horizonLimit)) {
            setViewMonth(next);
        }
    };

    const generateAvailableSlots = async (date: Date, professional: any) => {
        if (!studio || selectedServices.length === 0) return;
        setIsLoadingSlots(true);
        setSelectedTime(null);

        try {
            const dayKey = weekdayMap[getDay(date)];
            
            // Prioriza o horário individual do profissional, se existir
            const hasWorkSchedule = professional.work_schedule && Object.keys(professional.work_schedule).length > 0;
            const config = hasWorkSchedule 
                ? professional.work_schedule[dayKey] 
                : studio.business_hours?.[dayKey];

            if (!config || !config.active) {
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
                .gte('date', getStartOfDay(date).toISOString())
                .lte('date', addDays(getStartOfDay(date), 1).toISOString());

            const slots: string[] = [];
            const [startH, startM] = config.start.split(':').map(Number);
            const [endH, endM] = config.end.split(':').map(Number);
            
            let currentPointer = new Date(date);
            currentPointer.setHours(startH, startM, 0, 0);
            
            const endLimit = new Date(date);
            endLimit.setHours(endH, endM, 0, 0);

            // Período de intervalo (break)
            let breakStart: Date | null = null;
            let breakEnd: Date | null = null;
            
            if (config.break_active) {
                const bS = config.break_start || '12:00';
                const bE = config.break_end || '13:00';
                
                breakStart = new Date(date);
                const [bSH, bSM] = bS.split(':').map(Number);
                breakStart.setHours(bSH, bSM, 0, 0);
                
                breakEnd = new Date(date);
                const [bEH, bEM] = bE.split(':').map(Number);
                breakEnd.setHours(bEH, bEM, 0, 0);
            }

            while (isBefore(addMinutes(currentPointer, totalDuration), endLimit)) {
                if (isSameDay(date, now)) {
                    if (isBefore(currentPointer, minTimeLimit)) {
                        currentPointer = addMinutes(currentPointer, 30);
                        continue;
                    }
                }

                const slotStart = currentPointer;
                const slotEnd = addMinutes(currentPointer, totalDuration);

                // Verifica se o slot pretendido sobrepõe o intervalo
                const isDuringBreak = breakStart && breakEnd && (
                    (slotStart < breakEnd) && (slotEnd > breakStart)
                );

                if (isDuringBreak) {
                    currentPointer = addMinutes(currentPointer, 30);
                    continue;
                }

                const hasOverlap = busyAppointments?.some(app => {
                    const appStart = new Date(app.date);
                    const appEnd = addMinutes(appStart, app.duration);
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

            const targetStudioId = studio?.studio_id || studio?.id;
            if (!targetStudioId) {
                console.error('❌ [CRITICAL] studio_id não encontrado no estado studio:', studio);
            }

            const { data: existingClient } = await supabase
                .from('clients')
                .select('id, nome')
                .eq('whatsapp', cleanPhone)
                .eq('studio_id', targetStudioId)
                .maybeSingle();

            let clientId: number;
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                console.log('👤 Criando novo cliente:', clientName, 'no estúdio:', targetStudioId);
                const { data: newClient, error: clientErr } = await supabase
                    .from('clients')
                    .insert([{ 
                        nome: clientName, 
                        whatsapp: cleanPhone, 
                        consent: true, 
                        referral_source: 'Link Público',
                        studio_id: targetStudioId
                    }])
                    .select('id, nome')
                    .single();

                if (clientErr) {
                    console.error('❌ Erro ao criar cliente (Detalhado):', {
                        message: clientErr.message,
                        details: clientErr.details,
                        hint: clientErr.hint,
                        code: clientErr.code,
                        payload: { nome: clientName, whatsapp: cleanPhone, studio_id: targetStudioId }
                    });
                    throw new Error(`Erro ao registrar seus dados: ${clientErr.message}`);
                }

                if (!newClient) {
                    throw new Error("Não foi possível registrar seus dados. Tente novamente.");
                }

                clientId = newClient.id;
            }

            const [h, m] = selectedTime.split(':').map(Number);
            const appointmentDate = new Date(selectedDate);
            appointmentDate.setHours(h, m, 0, 0);

            const totalDuration = selectedServices.reduce((acc, s) => acc + s.duracao_min, 0);
            const totalValue = selectedServices.reduce((acc, s) => acc + Number(s.preco), 0);
            const serviceNames = selectedServices.map(s => s.nome || s.name).join(' + ');

            const endDateTime = addMinutes(appointmentDate, totalDuration);

            // --- AUDIT & VALIDATION TO PREVENT DOUBLE BOOKINGS ---
            // 1. Verificar se o profissional já tem agendamento que conflita com este período
            const startOfDayStr = getStartOfDay(appointmentDate).toISOString();
            const endOfDayStr = addDays(getStartOfDay(appointmentDate), 1).toISOString();

            const { data: profOverlapCheck, error: overlapErr } = await supabase
                .from('appointments')
                .select('id, date, duration, start_at, end_at')
                .eq('professional_id', selectedProfessional.id)
                .neq('status', 'cancelado')
                .gte('date', startOfDayStr)
                .lte('date', endOfDayStr);

            if (overlapErr) {
                console.error("Erro ao verificar sobreposição do profissional:", overlapErr);
            }

            const slotStart = appointmentDate;
            const slotEnd = endDateTime;

            const hasProfOverlap = profOverlapCheck?.some(app => {
                const appStart = new Date(app.date || app.start_at);
                const appEnd = addMinutes(appStart, app.duration);
                return (slotStart < appEnd) && (slotEnd > appStart);
            });

            if (hasProfOverlap) {
                throw new Error("Desculpe, este horário acabou de ser preenchido por outro cliente. Por favor, retorne e selecione outro horário disponível.");
            }

            // 2. Verificar se o próprio cliente já tem um agendamento no mesmo horário (conflitante)
            const { data: clientOverlapCheck, error: clientOverlapErr } = await supabase
                .from('appointments')
                .select('id, date, duration, start_at, end_at')
                .eq('client_whatsapp', cleanPhone)
                .neq('status', 'cancelado')
                .gte('date', startOfDayStr)
                .lte('date', endOfDayStr);

            if (clientOverlapErr) {
                console.error("Erro ao verificar sobreposição do cliente:", clientOverlapErr);
            }

            const hasClientOverlap = clientOverlapCheck?.some(app => {
                const appStart = new Date(app.date || app.start_at);
                const appEnd = addMinutes(appStart, app.duration);
                return (slotStart < appEnd) && (slotEnd > appStart);
            });

            if (hasClientOverlap) {
                throw new Error("Você já possui um agendamento agendado para o mesmo horário. Por favor, selecione um horário diferente.");
            }

            // Enviar estritamente professional_id. resource_id gerado no DB como espelho.
            const payload = {
                studio_id: studio?.studio_id || studio?.id,
                client_id: clientId,
                client_name: clientName,
                client_whatsapp: cleanPhone,
                professional_id: selectedProfessional.id,
                professional_name: selectedProfessional.name,
                service_name: serviceNames,
                value: totalValue,
                duration: totalDuration,
                date: appointmentDate.toISOString(),
                start_at: appointmentDate.toISOString(),
                end_at: endDateTime.toISOString(),
                status: 'agendado',
                origin: 'online'
            };
            console.log('🚀 [DEBUG] PAYLOAD DO INSERT (appointments):', JSON.stringify(payload, null, 2));

            let newAppointment = null;
            try {
                const { data, error: apptErr } = await supabase
                    .from('appointments')
                    .insert([payload])
                    .select('id, studio_id, client_name, client_whatsapp, professional_id, professional_name, service_name, start_at, duration, value, notes, date')
                    .single();

                if (apptErr) throw apptErr;
                newAppointment = data;
                console.log('✅ Agendamento público salvo com sucesso:', newAppointment?.id);
            } catch (dbError: any) {
                console.error('❌ ERRO AO SALVAR AGENDAMENTO PÚBLICO:', dbError);
                throw dbError;
            }

            if (newAppointment) {
                console.log('📧 Iniciando tentativa de notificação por e-mail (Público)...');
                
                const notificationPayload = {
                    appointment_id: newAppointment.id,
                    studio_id: newAppointment.studio_id,
                    client_name: newAppointment.client_name,
                    client_email: null, // No preview público geralmente não temos o email a menos que peçamos
                    client_phone: newAppointment.client_whatsapp,
                    client_whatsapp: newAppointment.client_whatsapp,
                    professional_id: newAppointment.professional_id,
                    professional_name: newAppointment.professional_name,
                    professional_email: selectedProfessional?.email,
                    service_name: newAppointment.service_name,
                    start_at: newAppointment.start_at,
                    duration: newAppointment.duration,
                    total_amount: newAppointment.value,
                    notes: newAppointment.notes,
                    // Campos legados
                    date: newAppointment.date,
                    start_time: format(new Date(newAppointment.start_at), 'HH:mm'),
                    value: newAppointment.value
                };

                console.log('📦 Payload enviado para Edge Function (Público):', notificationPayload);

                try {
                    // Função auxiliar para chamada robusta com logs de debug
                    const invokeFunction = async () => {
                        try {
                            console.log('📡 [DEBUG] Chamando Edge Function via SDK (Público)...');
                            const { data, error: funcError } = await supabase.functions.invoke('send-appointment-notification', {
                                body: notificationPayload
                            });
                            if (funcError) {
                                console.error('❌ [DEBUG] Erro retornado pelo SDK (Público):', funcError);
                                return { error: funcError };
                            }
                            return { data };
                        } catch (err: any) {
                            console.warn('⚠️ [DEBUG] Exceção capturada no SDK (Público):', err.message);
                            
                            // Fallback para fetch direto se o SDK falhar na rede ou por configuração
                            try {
                                let directUrl = '';
                                if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
                                    directUrl = `${supabaseUrl}/functions/v1/send-appointment-notification`;
                                } else {
                                    // Converte https://project.supabase.co para https://project.functions.supabase.co
                                    directUrl = `${supabaseUrl.replace('.supabase.co', '.functions.supabase.co')}/send-appointment-notification`;
                                }
                                
                                console.log(`🔗 [DEBUG] Tentando fetch direto como fallback (Público): ${directUrl}`);
                                
                                const response = await fetch(directUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${supabaseAnonKey}`,
                                        'apikey': supabaseAnonKey
                                    },
                                    mode: 'cors',
                                    body: JSON.stringify(notificationPayload)
                                });
                                
                                if (!response.ok) {
                                    const errorText = await response.text();
                                    console.error(`❌ [DEBUG] Fetch direto falhou (Público) (Status: ${response.status}):`, errorText);
                                    return { error: new Error(response.status === 404 ? 'Edge Function não encontrada (404)' : `Erro HTTP ${response.status}: ${errorText}`) };
                                }
                                const data = await response.json();
                                return { data };
                            } catch (fetchErr: any) {
                                console.error('❌ [DEBUG] Exceção no fetch direto (Público):', fetchErr.message);
                                return { error: fetchErr };
                            }
                        }
                    };

                    const result = await invokeFunction();
                    if (result.error) throw result.error;
                    const data = result.data;
                    
                    if (data?.warning && !data?.notification_sent) {
                        console.warn('⚠️ [PARTIAL_SUCCESS] Agendamento salvo, mas notificação falhou (Público):', data.warning);
                    } else {
                        console.log('✅ [DEBUG] Notificação processada com sucesso (Público)!', data);
                    }
                } catch (emailError: any) {
                    console.error('❌ [DEBUG] ERRO FINAL NA NOTIFICAÇÃO (Público):', emailError.message || emailError);
                    // No link público, logamos mas não bloqueamos o sucesso visual do cliente
                }
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('belare_client_phone', cleanPhone);
                localStorage.setItem('belare_client_name', clientName);
            }
            setBookingSuccess(true);
        } catch (e: any) {
            console.error('Erro completo:', JSON.stringify(e));
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

    const totalDuration = useMemo(() => {
        return selectedServices.reduce((acc, s) => acc + (Number(s.duracao_min) || 0), 0);
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

    if (confirmingAppointment) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center p-4 relative text-left">
                {user && (
                    <button 
                        onClick={() => window.location.hash = '#/'}
                        className="fixed top-4 left-4 z-[60] bg-white/90 backdrop-blur-sm hover:bg-white text-slate-800 px-5 py-2.5 rounded-full shadow-2xl border border-slate-100 flex items-center gap-2 transition-all duration-300 font-black text-xs uppercase tracking-widest group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform text-orange-500" />
                        Voltar ao Painel
                    </button>
                )}

                <div className="w-full max-w-md bg-white rounded-[40px] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden">
                    {/* Header do Estúdio */}
                    <div className="relative h-32 bg-orange-500 bg-cover bg-center" style={{ backgroundImage: `url(${studio?.cover_url || DEFAULT_COVER})` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-[20px] overflow-hidden border-4 border-white bg-white shadow-lg flex items-center justify-center">
                            <img src={studio?.logo_url || DEFAULT_LOGO} className="w-full h-full object-cover" alt="Logo" />
                        </div>
                    </div>

                    <div className="pt-12 px-6 pb-8 flex flex-col items-center text-center">
                        <span className="text-[10px] font-black uppercase text-orange-500 tracking-[0.25em] bg-orange-50 px-3 py-1 rounded-full mb-4">
                            Confirmação de Agenda
                        </span>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                            Olá, {confirmingAppointment.client_name || 'Cliente'}! 😊
                        </h2>
                        <p className="text-xs font-bold text-slate-400 mt-1 max-w-[80%] mx-auto">
                            Por favor, confirme ou gerencie o seu horário no estúdio:
                        </p>

                        {/* Card com detalhes do Agendamento */}
                        <div className="w-full bg-slate-50 border border-slate-105 rounded-3xl p-5 mt-6 text-left space-y-4">
                            <div className="flex items-start gap-3">
                                <Scissors size={18} className="text-orange-500 mt-1 flex-shrink-0" />
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Serviço</span>
                                    <span className="font-extrabold text-slate-700 text-sm leading-snug block">{confirmingAppointment.service_name}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-205/60 pt-4">
                                <div className="flex items-start gap-3">
                                    <Calendar size={18} className="text-orange-500 mt-1 flex-shrink-0" />
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Data</span>
                                        <span className="font-black text-slate-700 text-sm">
                                            {format(new Date(confirmingAppointment.date), 'dd/MM/yyyy')}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Clock size={18} className="text-orange-500 mt-1 flex-shrink-0" />
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Horário</span>
                                        <span className="font-black text-slate-700 text-sm">
                                            {format(new Date(confirmingAppointment.date), 'HH:mm')} ou às {format(new Date(confirmingAppointment.date), 'HH:mm')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-205/60 pt-4">
                                <div className="flex items-start gap-3">
                                    <User size={18} className="text-orange-500 mt-1 flex-shrink-0" />
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Profissional</span>
                                        <span className="font-extrabold text-slate-700 text-sm truncate block">{confirmingAppointment.professional_name || 'Profissional'}</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <span className="text-orange-500 font-extrabold text-lg mt-0.5 flex-shrink-0">R$</span>
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Valor Total</span>
                                        <span className="font-black text-slate-700 text-sm">
                                            {Number(confirmingAppointment.value || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status Widget */}
                        <div className="w-full mt-6">
                            {confirmingStatus === 'success' ? (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 flex flex-col items-center text-center space-y-2 animate-in zoom-in-95 duration-300">
                                    <div className="bg-emerald-100 text-emerald-600 p-2 rounded-full">
                                        <Check className="w-6 h-6 animate-bounce" strokeWidth={3} />
                                    </div>
                                    <h4 className="font-extrabold text-slate-800 text-sm">Presença Confirmada!</h4>
                                    <p className="text-[10px] font-bold text-slate-400 leading-normal max-w-[85%]">
                                        Seu estúdio já recebeu sua confirmação. Te esperamos no horário marcado! ✨
                                    </p>
                                </div>
                            ) : confirmingStatus === 'loading' ? (
                                <div className="bg-orange-50/50 border border-orange-100 rounded-3xl p-6 flex flex-col items-center justify-center space-y-3">
                                    <Loader2 className="animate-spin text-orange-500 w-8 h-8" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Salvando Confirmação...</p>
                                </div>
                            ) : confirmingStatus === 'error' ? (
                                <div className="bg-rose-50 border border-rose-100 rounded-3xl p-4 text-center text-rose-600 font-bold text-xs">
                                    Houve um erro ao salvar a confirmação. Por favor, tente novamente ou fale com o estúdio.
                                    <button 
                                        onClick={handleConfirmBookingSelf}
                                        className="mt-3 w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-bold transition-all text-xs"
                                    >
                                        Tentar Novamente
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <button
                                        onClick={handleConfirmBookingSelf}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-100 hover:shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Check size={18} strokeWidth={3} />
                                        Confirmar Presença
                                    </button>

                                    <button
                                        onClick={() => {
                                            const phone = studio?.whatsapp || studio?.phone || '';
                                            const text = `Olá! Gostaria de reagendar ou tirar dúvidas sobre meu agendamento no dia ${format(new Date(confirmingAppointment.date), 'dd/MM/yyyy')} às ${format(new Date(confirmingAppointment.date), 'HH:mm')} (${confirmingAppointment.service_name})`;
                                            window.open(getWhatsAppUrl(phone, text), '_blank');
                                        }}
                                        className="w-full bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-500 py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
                                    >
                                        Preciso Alterar / Reagendar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Informações do Estúdio de Rodapé */}
                        <div className="mt-8 border-t border-slate-100 pt-6 w-full text-center">
                            <p className="text-xs font-black text-slate-700 uppercase">{studio?.studio_name || studio?.business_name}</p>
                            {studio?.address && (
                                <span className="text-[10px] font-medium text-slate-400 mt-1 block px-4 leading-normal">
                                    {studio.address}
                                </span>
                            )}
                            {(studio?.whatsapp || studio?.phone) && (
                                <span className="text-[10px] font-black text-orange-500 mt-2 block hover:underline cursor-pointer" onClick={() => {
                                    const rawVal = studio.whatsapp || studio.phone;
                                    window.open(getWhatsAppUrl(rawVal), '_blank');
                                }}>
                                    Fale conosco: {studio.whatsapp || studio.phone}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                className="relative w-full h-64 md:h-80 lg:h-[400px] bg-slate-200 bg-cover bg-center transition-all duration-700 overflow-hidden"
                style={{ backgroundImage: `url(${studio?.cover_url || DEFAULT_COVER})` }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
                <button 
                    onClick={() => setIsClientAppsOpen(true)}
                    className="absolute top-6 right-6 p-4 bg-white/10 backdrop-blur-xl rounded-2xl text-white hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20 shadow-2xl z-20 group"
                >
                    <UserCircle size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Minha Agenda</span>
                </button>
            </div>

            <div className="max-w-2xl mx-auto px-6 -mt-24 relative z-10 text-center scale-up-center">
                <div className="bg-white rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/50 backdrop-blur-xl flex flex-col items-center">
                    <div className="w-28 h-28 rounded-[32px] bg-white border-8 border-white shadow-2xl -mt-24 overflow-hidden mb-6 flex items-center justify-center transition-transform hover:scale-105">
                        {studio?.profile_url ? (
                            <img src={studio.profile_url} className="w-full h-full object-cover" alt="Logo" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center font-black text-4xl">{studio?.studio_name?.charAt(0) || 'B'}</div>
                        )}
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 leading-tight tracking-tighter">{studio?.studio_name || "Seu Estúdio de Beleza"}</h1>
                    <p className="text-slate-400 text-xs font-medium mt-2 max-w-xs">{studio?.description || "Realçando sua beleza natural com excelência e cuidado profissional."}</p>
                    <div className="flex flex-wrap justify-center items-center gap-4 mt-6">
                        <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-xs font-black border border-amber-100 italic">
                            <Star size={14} fill="currentColor" /> 5.0 (250+ avaliações)
                        </div>
                        <a 
                            href={getWhatsAppUrl(studio?.whatsapp || studio?.phone || '')} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-black border border-emerald-100 hover:bg-emerald-100 transition-colors"
                        >
                            <Phone size={14} /> WhatsApp
                        </a>
                    </div>
                    <div className="flex items-center gap-2 mt-4 px-6 py-2.5 bg-slate-50 rounded-2xl border border-slate-100 w-full max-w-xs justify-center group overflow-hidden">
                        <MapPin size={16} className="text-orange-500 flex-shrink-0 group-hover:scale-110 transition-transform" /> 
                        <span className="text-[10px] font-bold text-slate-500 truncate lowercase first-letter:uppercase">
                            {studio?.address || studio?.address_street || studio?.street ? `${studio.address || studio.address_street || studio.street}, ${studio.address_number || studio.number || ''}` : "Endereço não informado"}
                        </span>
                    </div>
                </div>

                {clientActiveAppointments.length > 0 && (
                    <div className="mt-8 bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-800 rounded-[32px] p-6 text-left shadow-[0_15px_40px_rgba(30,41,59,0.15)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/10 text-orange-400 flex items-center justify-center flex-shrink-0">
                                <Calendar size={22} className="animate-pulse" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase text-orange-400 tracking-wider bg-orange-500/10 border border-orange-500/10 px-2.5 py-0.5 rounded-full block w-fit">
                                        Horário Agendado
                                    </span>
                                </div>
                                <h4 className="font-extrabold text-white text-sm mt-1.5 leading-snug">
                                    {clientActiveAppointments[0].service_name}
                                </h4>
                                <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tight">
                                    com {clientActiveAppointments[0].professional_name}
                                </p>
                                <p className="text-xs text-slate-300 font-medium mt-1">
                                    {format(new Date(clientActiveAppointments[0].date), "eeee, dd 'de' MMMM 'às' HH:mm", { locale: pt })}
                                </p>
                                
                                {(() => {
                                    const apptDate = new Date(clientActiveAppointments[0].date);
                                    const hoursAhead = (apptDate.getTime() - new Date().getTime()) / 3600000;
                                    const isConfirmed = ['confirmado', 'confirmado_whatsapp'].includes(clientActiveAppointments[0].status);
                                    
                                    if (isConfirmed) {
                                        return (
                                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1 mt-2.5 bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-1 rounded-full w-fit">
                                                <Check size={10} strokeWidth={3} /> Presença Confirmada!
                                            </span>
                                        );
                                    } else if (hoursAhead <= 29) {
                                        return (
                                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1 mt-2.5 bg-amber-500/10 border border-amber-500/10 px-2.5 py-1 rounded-full w-fit animate-pulse">
                                                ⚠️ Reconfirmar Presença (Hoje/Amanhã)
                                            </span>
                                        );
                                    } else {
                                        return (
                                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1 mt-2.5 bg-blue-500/10 border border-blue-500/10 px-2.5 py-1 rounded-full w-fit">
                                                ✓ Horário Marcado!
                                            </span>
                                        );
                                    }
                                })()}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2 justify-end items-stretch">
                            {(() => {
                                const apptDate = new Date(clientActiveAppointments[0].date);
                                const hoursAhead = (apptDate.getTime() - new Date().getTime()) / 3600000;
                                const isConfirmed = ['confirmado', 'confirmado_whatsapp'].includes(clientActiveAppointments[0].status);
                                
                                if (!isConfirmed && hoursAhead <= 29) {
                                    return (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    const { error } = await supabase
                                                        .from('appointments')
                                                        .update({ status: 'confirmado_whatsapp', updated_at: new Date().toISOString() })
                                                        .eq('id', clientActiveAppointments[0].id);
                                                    if (error) throw error;
                                                    
                                                    setClientActiveAppointments(prev => 
                                                        prev.map(a => a.id === clientActiveAppointments[0].id ? { ...a, status: 'confirmado_whatsapp' } : a)
                                                    );
                                                } catch (err) {
                                                    alert("Não foi possível salvar a confirmação. Tente atualizar a página.");
                                                }
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-5 py-3 rounded-2xl transition-all shadow-md shadow-emerald-900/10 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider animate-pulse"
                                        >
                                            <Check size={14} strokeWidth={3} />
                                            Confirmar Presença
                                        </button>
                                    );
                                }
                                return null;
                            })()}
                            <button
                                onClick={() => setIsClientAppsOpen(true)}
                                className="bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/60 text-slate-300 text-xs font-black px-5 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                            >
                                Ver Tudo / Cancelar
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-12 space-y-4 text-left">
                    <div className="flex items-center justify-between px-2 mb-6">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Menu de Serviços</h2>
                        <span className="h-px bg-slate-200 flex-1 ml-4 opacity-50"></span>
                    </div>
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
                <div className="fixed bottom-6 left-6 right-6 z-40 flex justify-center animate-in slide-in-from-bottom-full duration-700">
                    <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl px-6 py-5 rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/10 flex items-center justify-between gap-6 group hover:scale-[1.02] transition-transform">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="flex -space-x-2">
                                    {selectedServices.slice(0, 3).map((s, i) => (
                                        <div key={s.id} className="w-5 h-5 rounded-full border-2 border-slate-900 bg-orange-500 flex items-center justify-center text-[8px] font-black text-white" style={{ zIndex: 3 - i }}>
                                            {s.nome?.[0] || 'S'}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                                    {selectedServices.length} {selectedServices.length === 1 ? 'Serviço' : 'Serviços'} • {totalDuration} min
                                </p>
                            </div>
                            <p className="text-2xl font-black text-white">R$ {totalPrice.toFixed(2)}</p>
                        </div>
                        <button 
                            onClick={() => { setIsBookingOpen(true); setBookingStep(1); }} 
                            className="bg-orange-500 hover:bg-orange-400 text-white px-8 py-4 rounded-[24px] font-black shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap group-hover:px-10"
                        >
                            Agendar <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
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

                                <main className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50/30 text-left pb-32 sm:pb-6">
                                    {bookingStep === 1 && (
                                        <div className="space-y-4">
                                            {team_members
                                                .filter(p => {
                                                    if (selectedServices.length === 0) return true;
                                                    const profSkills = p.services_enabled || [];
                                                    // Se o profissional não tem habilidades definidas, assume que faz tudo (ou nada, dependendo da lógica desejada)
                                                    // Aqui vamos assumir que se tiver habilidades, deve ter todas as selecionadas.
                                                    if (profSkills.length === 0) return true; 
                                                    return selectedServices.every(s => profSkills.includes(s.id));
                                                })
                                                .map(p => (
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
                                        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
                                            <div className="bg-white p-3 sm:p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-4 sm:mb-6">
                                                    <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                                        <Calendar size={16} className="text-orange-500" />
                                                        <span className="capitalize">{format(viewMonth, 'MMMM yyyy', { locale: pt })}</span>
                                                    </h4>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={handlePrevMonth} 
                                                            disabled={isSameMonth(viewMonth, new Date())}
                                                            className="p-1.5 sm:p-2 rounded-xl border border-slate-100 hover:bg-slate-50 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            <ChevronLeft size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={handleNextMonth} 
                                                            disabled={isAfter(endOfMonth(viewMonth), horizonLimit)}
                                                            className="p-1.5 sm:p-2 rounded-xl border border-slate-100 hover:bg-slate-50 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            <ChevronRight size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                                        <div key={`${d}-${i}`} className="text-center text-[9px] sm:text-[10px] font-black text-slate-400 py-1 sm:py-2 tracking-widest">{d}</div>
                                                    ))}
                                                    {calendarDays.map((day) => {
                                                        const isToday = isSameDay(day, new Date());
                                                        const isSelected = isSameDay(day, selectedDate);
                                                        const isCurrentMonth = isSameMonth(day, viewMonth);
                                                        // FIX: Manual startOfDay replacement.
                                                        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
                                                        const isPast = isBefore(day, startOfToday);
                                                        const isOverLimit = isAfter(day, horizonLimit);
                                                        const dayKey = weekdayMap[getDay(day)];
                                                        
                                                        // Verifica se o profissional (ou estúdio) está aberto
                                                        const hasWorkSchedule = selectedProfessional?.work_schedule && Object.keys(selectedProfessional.work_schedule).length > 0;
                                                        const activeConfig = hasWorkSchedule 
                                                            ? selectedProfessional.work_schedule[dayKey] 
                                                            : studio?.business_hours?.[dayKey];
                                                        const isClosed = !activeConfig || !activeConfig.active;
                                                        
                                                        const isDisabled = isPast || isOverLimit || isClosed;

                                                        return (
                                                            <button
                                                                key={day.toISOString()}
                                                                disabled={isDisabled}
                                                                onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                                                                className={`
                                                                    aspect-square rounded-xl sm:rounded-2xl flex items-center justify-center text-xs sm:text-sm font-bold transition-all relative
                                                                    ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : ''}
                                                                    ${isSelected ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-105 sm:scale-110 z-10' : 
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

                                            <div className="space-y-3 sm:space-y-4">
                                                <div className="flex items-center gap-2 ml-1">
                                                    <Clock size={14} className="text-slate-400" />
                                                    <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Horários para {format(selectedDate, "dd/MM")}</h4>
                                                </div>
                                                
                                                {isLoadingSlots ? (
                                                    <div className="py-6 text-center text-slate-400 flex flex-col items-center"><Loader2 className="animate-spin mb-2" /><p className="text-[10px] font-bold">Consultando agenda...</p></div>
                                                ) : availableSlots.length > 0 ? (
                                                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 animate-in slide-in-from-top-2">
                                                        {availableSlots.map(time => (
                                                            <button 
                                                                key={time} 
                                                                onClick={() => setSelectedTime(time)} 
                                                                className={`py-2 sm:py-3 rounded-xl text-xs sm:text-sm font-black border-2 transition-all ${selectedTime === time ? 'bg-slate-800 border-slate-800 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-orange-300'}`}
                                                            >
                                                                {time}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-6 bg-slate-100/50 rounded-[32px] border border-dashed border-slate-200 text-center">
                                                        <Clock className="mx-auto text-slate-300 mb-2 opacity-40" size={24} />
                                                        <p className="text-xs font-bold text-slate-400 leading-tight">Nenhum horário livre para este dia.</p>
                                                    </div>
                                                )}
                                            </div>
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
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviços Selecionados</p>
                                                    {selectedServices.map(s => (
                                                        <div key={s.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                            <span className="text-sm font-bold text-slate-700">{s.nome || s.name}</span>
                                                            <span className="text-xs font-black text-slate-400">R$ {Number(s.preco).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="pt-3 border-t border-slate-50 flex justify-between items-end">
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">Tempo Total</span>
                                                        <span className="text-sm font-bold text-slate-600 flex items-center gap-1"><Clock size={14} /> {totalDuration} min</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">Valor Total</span>
                                                        <span className="text-2xl font-black text-orange-600">R$ {totalPrice.toFixed(2)}</span>
                                                    </div>
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

                                {selectedTime && bookingStep === 2 && (
                                    <div className="p-4 sm:p-6 bg-white border-t border-slate-100 animate-in slide-in-from-bottom-full duration-300">
                                        <button 
                                            onClick={() => setBookingStep(3)} 
                                            className="w-full bg-slate-800 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
                                        >
                                            Continuar <ArrowRight size={20} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {isClientAppsOpen && <ClientAppointmentsModal studioId={studio?.studio_id || studio?.id} onClose={() => setIsClientAppsOpen(false)} />}
        </div>
    );
};

export default PublicBookingPreview;