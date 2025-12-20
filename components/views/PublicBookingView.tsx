
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChevronLeft, Calendar, Clock, Check, Star, 
    User, Phone, MapPin, Loader2, Scissors, 
    MessageCircle, Heart, ArrowRight
} from 'lucide-react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';

type BookingStep = 'service' | 'professional' | 'datetime' | 'details' | 'success';

const PublicBookingView: React.FC = () => {
    // --- Diagnóstico ---
    useEffect(() => {
        console.log("Public View Carregou - Bypass de Auth OK");
    }, []);

    // --- State ---
    const [step, setStep] = useState<BookingStep>('service');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Data from Database
    const [studio, setStudio] = useState<any>(null);
    const [services, setServices] = useState<any[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    
    // User Selection
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedProfessional, setSelectedProfessional] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    
    // Form
    const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

    // --- Initial Fetch com Try/Catch Robusto ---
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const [studioRes, servicesRes, profRes] = await Promise.all([
                    supabase.from('studio_settings').select('*').maybeSingle(),
                    supabase.from('services').select('*').eq('ativo', true).order('nome'),
                    supabase.from('professionals').select('*').eq('active', true).order('name')
                ]);

                if (studioRes?.data) setStudio(studioRes.data);
                if (servicesRes?.data) setServices(servicesRes.data);
                if (profRes?.data) setProfessionals(profRes.data);
            } catch (err) {
                console.error("Erro ao carregar dados públicos:", err);
                // Fallback silencioso para não travar a UI se apenas uma tabela falhar
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, []);

    // --- Helpers ---
    const timeSlots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', 
        '16:00', '16:30', '17:00', '17:30', '18:00'
    ];

    const next14Days = useMemo(() => {
        return Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));
    }, []);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
        if (val.length > 9) val = `${val.slice(0, 9)}-${val.slice(9)}`;
        setFormData({ ...formData, phone: val });
    };

    const handleConfirmBooking = async () => {
        if (!formData.name || formData.phone.length < 14) {
            alert("Por favor, preencha seu nome e WhatsApp corretamente.");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Verificar/Criar Cliente
            const cleanPhone = formData.phone.replace(/\D/g, '');
            let clientId: number;

            const { data: existingClient } = await supabase
                .from('clients')
                .select('id')
                .eq('whatsapp', cleanPhone)
                .maybeSingle();

            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const { data: newClient, error: cErr } = await supabase
                    .from('clients')
                    .insert([{ 
                        nome: formData.name, 
                        whatsapp: cleanPhone, 
                        email: formData.email || null,
                        consent: true 
                    }])
                    .select('id')
                    .single();
                if (cErr) throw cErr;
                clientId = newClient.id;
            }

            // 2. Criar Agendamento
            const [h, m] = (selectedTime || '09:00').split(':').map(Number);
            const bookingDate = new Date(selectedDate);
            bookingDate.setHours(h, m, 0, 0);

            const { error: aErr } = await supabase.from('appointments').insert([{
                client_id: clientId,
                client_name: formData.name,
                service_name: selectedService.nome,
                professional_name: selectedProfessional?.name || 'Profissional',
                resource_id: selectedProfessional?.id || null,
                date: bookingDate.toISOString(),
                value: selectedService.preco,
                status: 'agendado',
                origem: 'link',
                notes: `Agendado via link público por ${formData.name}.`
            }]);

            if (aErr) throw aErr;
            setStep('success');
        } catch (err: any) {
            alert("Erro ao confirmar horário: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render ---

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Carregando Agenda...</h2>
                <p className="text-slate-400 mt-2">Estamos preparando os melhores horários para você.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20">
            {/* Navbar / Hero */}
            <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-30 shadow-sm">
                <div className="max-w-xl mx-auto flex items-center gap-4">
                    {step !== 'service' && step !== 'success' && (
                        <button 
                            onClick={() => {
                                if(step === 'professional') setStep('service');
                                if(step === 'datetime') setStep('professional');
                                if(step === 'details') setStep('datetime');
                            }}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <div className="flex-1 text-center">
                        <h1 className="text-lg font-black text-slate-900 tracking-tight">{studio?.studio_name || 'BelaApp Studio'}</h1>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            <MapPin size={10} /> Centro, SP
                        </div>
                    </div>
                    <div className="w-10"></div> {/* Spacer */}
                </div>
            </div>

            <div className="flex-1 max-w-xl mx-auto w-full p-4 space-y-6">
                
                {/* STEP 1: SERVICE */}
                {step === 'service' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-black text-slate-800">O que vamos fazer hoje?</h2>
                            <p className="text-slate-500 text-sm mt-1">Selecione o procedimento desejado.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {services.map(svc => (
                                <button 
                                    key={svc.id}
                                    onClick={() => { setSelectedService(svc); setStep('professional'); }}
                                    className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-orange-500 hover:shadow-xl transition-all text-left flex items-center justify-between group active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                                            <Scissors size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{svc.nome}</h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase">{svc.duracao_min} minutos</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-orange-600">R$ {svc.preco.toFixed(2)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 2: PROFESSIONAL */}
                {step === 'professional' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center">
                            <h2 className="text-2xl font-black text-slate-800">Com quem?</h2>
                            <p className="text-slate-500 text-sm mt-1">Escolha um de nossos especialistas.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <button 
                                onClick={() => { setSelectedProfessional(null); setStep('datetime'); }}
                                className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-orange-500 transition-all text-left flex items-center gap-4 group"
                            >
                                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold text-xl">
                                    ?
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Primeiro Disponível</h3>
                                    <p className="text-xs text-slate-500">Agende com quem tiver horário mais cedo.</p>
                                </div>
                            </button>
                            {professionals.map(prof => (
                                <button 
                                    key={prof.id}
                                    onClick={() => { setSelectedProfessional(prof); setStep('datetime'); }}
                                    className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-orange-500 transition-all text-left flex items-center gap-4 group"
                                >
                                    <img src={prof.photo_url || `https://ui-avatars.com/api/?name=${prof.name}`} className="w-14 h-14 rounded-full object-cover border-2 border-slate-50 shadow-sm" alt="" />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800">{prof.name}</h3>
                                        <p className="text-xs text-slate-400 uppercase font-black tracking-widest">{prof.role || 'Especialista'}</p>
                                    </div>
                                    <div className="flex text-amber-400"><Star size={14} fill="currentColor"/></div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 3: DATETIME */}
                {step === 'datetime' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white rounded-[40px] p-6 shadow-sm border border-slate-100">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Calendar size={16} className="text-orange-500" /> Escolha o Dia
                            </h3>
                            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                                {next14Days.map(day => {
                                    const isSelected = isSameDay(day, selectedDate);
                                    return (
                                        <button 
                                            key={day.toISOString()}
                                            onClick={() => setSelectedDate(day)}
                                            className={`flex-shrink-0 w-16 h-24 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${
                                                isSelected 
                                                ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105' 
                                                : 'bg-white border-slate-50 text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="text-[10px] font-black uppercase mb-1">{format(day, 'EEE', { locale: pt })}</span>
                                            <span className="text-xl font-black">{format(day, 'dd')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] p-6 shadow-sm border border-slate-100">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Clock size={16} className="text-orange-500" /> Horários Disponíveis
                            </h3>
                            <div className="grid grid-cols-4 gap-3">
                                {timeSlots.map(time => (
                                    <button 
                                        key={time}
                                        onClick={() => setSelectedTime(time)}
                                        className={`py-3 rounded-xl text-sm font-black border-2 transition-all ${
                                            selectedTime === time
                                            ? 'bg-orange-500 border-orange-500 text-white shadow-lg'
                                            : 'bg-white border-slate-50 text-slate-600 hover:border-orange-200'
                                        }`}
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {selectedTime && (
                            <button 
                                onClick={() => setStep('details')}
                                className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black shadow-xl shadow-slate-200 flex items-center justify-center gap-2 animate-in zoom-in-95"
                            >
                                CONTINUAR <ArrowRight size={20} />
                            </button>
                        )}
                    </div>
                )}

                {/* STEP 4: DETAILS */}
                {step === 'details' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                            <h3 className="text-xl font-black text-slate-800 mb-6">Confirme seus dados</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Seu Nome Completo</label>
                                    <div className="mt-1 flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3.5 focus-within:ring-2 focus-within:ring-orange-200 transition-all">
                                        <User size={18} className="text-slate-400" />
                                        <input 
                                            placeholder="Ex: Maria da Silva" 
                                            className="bg-transparent w-full outline-none text-slate-800 font-bold"
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">WhatsApp para Lembretes</label>
                                    <div className="mt-1 flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3.5 focus-within:ring-2 focus-within:ring-green-200 transition-all">
                                        <Phone size={18} className="text-green-500" />
                                        <input 
                                            placeholder="(00) 00000-0000" 
                                            className="bg-transparent w-full outline-none text-slate-800 font-bold"
                                            value={formData.phone}
                                            onChange={handlePhoneChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-orange-50 border border-orange-100 p-6 rounded-[40px] space-y-4">
                            <div className="flex justify-between items-center text-orange-900">
                                <span className="text-xs font-black uppercase tracking-widest opacity-60">Resumo</span>
                                <Heart size={16} className="fill-orange-500 text-orange-500" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-black text-xl text-orange-800 leading-tight">{selectedService.nome}</p>
                                <p className="text-sm font-bold text-orange-700/70">{format(selectedDate, "dd/MM", { locale: pt })} às {selectedTime}</p>
                            </div>
                        </div>

                        <button 
                            onClick={handleConfirmBooking}
                            disabled={isSaving}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-[28px] font-black shadow-xl shadow-orange-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all"
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <><Check size={24} /> RESERVAR HORÁRIO</>}
                        </button>
                    </div>
                )}

                {/* STEP 5: SUCCESS */}
                {step === 'success' && (
                    <div className="h-full flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-green-200 mb-8">
                            <Check size={48} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tudo pronto!</h2>
                        <p className="text-slate-500 mt-4 max-w-xs mx-auto font-medium">
                            Seu horário foi agendado com sucesso. Enviamos uma confirmação para seu WhatsApp.
                        </p>
                        
                        <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm mt-10 w-full">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deseja reagendar?</p>
                            <p className="text-xs text-slate-500">Acesse o link em seu celular a qualquer momento.</p>
                        </div>

                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-12 text-orange-600 font-black text-sm uppercase tracking-[0.2em] border-b-2 border-orange-100 hover:border-orange-500 transition-all"
                        >
                            Fazer outro agendamento
                        </button>
                    </div>
                )}

            </div>

            {/* Float Message */}
            {step !== 'success' && (
                <div className="fixed bottom-6 right-6 z-40">
                    <a 
                        href={`https://wa.me/5511999990000`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-14 h-14 bg-green-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
                    >
                        <MessageCircle size={28} />
                    </a>
                </div>
            )}
        </div>
    );
};

export default PublicBookingView;