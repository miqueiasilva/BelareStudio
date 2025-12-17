import React, { useState, useMemo } from 'react';
import { services, mockOnlineConfig } from '../../data/mockData';
import { 
    ChevronLeft, Calendar, Clock, Check, Star, 
    Search, Info, Image as ImageIcon, ChevronDown, ChevronUp, Share2, 
    Loader2, MapPin, Phone, User, Mail, Heart
} from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../services/supabaseClient';
import { LegacyService } from '../../types';

// --- Configuration ---

// Lista fixa de profissionais para garantir o mapeamento correto do resource_id no banco
const PROFISSIONAIS = [
  { id: '1', title: 'Jacilene Félix', avatar: 'https://i.pravatar.cc/150?img=1', role: 'Especialista' },
  { id: '2', title: 'Graziela Oliveira', avatar: 'https://i.pravatar.cc/150?img=5', role: 'Especialista' },
  { id: '3', title: 'Jéssica Félix', avatar: 'https://i.pravatar.cc/150?img=9', role: 'Designer' },
  { id: '4', title: 'Glezia', avatar: 'https://i.pravatar.cc/150?img=4', role: 'Manicure' },
  { id: '5', title: 'Elda Priscila', avatar: 'https://i.pravatar.cc/150?img=12', role: 'Esteticista' },
  { id: '6', title: 'Herlon', avatar: 'https://i.pravatar.cc/150?img=11', role: 'Cabeleireiro' }
];

type Step = 'service' | 'professional' | 'datetime' | 'form' | 'success';

const PublicBookingPreview: React.FC = () => {
    // --- State ---
    const [step, setStep] = useState<Step>('service');
    
    // Selection State
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    
    // Client Form State
    const [clientForm, setClientForm] = useState({ 
        name: '', 
        phone: '', 
        email: '', 
        notes: '' 
    });

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        'Mais Agendados': true,
        'Sobrancelhas': true,
        'Geral': true
    });

    // --- Derived Data ---

    const selectedServicesList = useMemo(() => {
        const allServices = Object.values(services);
        return allServices.filter(s => selectedServiceIds.includes(s.id));
    }, [selectedServiceIds]);

    const totalStats = useMemo(() => {
        return selectedServicesList.reduce((acc, curr) => ({
            price: acc.price + curr.price,
            duration: acc.duration + curr.duration
        }), { price: 0, duration: 0 });
    }, [selectedServicesList]);

    const groupedServices = useMemo(() => {
        const allServices = Object.values(services);
        const filtered = allServices.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        const groups: Record<string, LegacyService[]> = {};
        
        if (!searchTerm) groups['Mais Agendados'] = allServices.slice(0, 3);

        filtered.forEach(service => {
            const cat = service.category || 'Geral';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(service);
        });
        return groups;
    }, [searchTerm]);

    const timeSlots = useMemo(() => {
        const slots = [];
        const start = 9; // 9 AM
        const end = 19; // 7 PM
        for (let i = start; i < end; i++) {
            slots.push(`${String(i).padStart(2, '0')}:00`);
            slots.push(`${String(i).padStart(2, '0')}:30`);
        }
        return slots;
    }, []);

    const dates = useMemo(() => {
        const start = new Date();
        start.setHours(0,0,0,0);
        return Array.from({ length: 14 }, (_, i) => addDays(start, i));
    }, []);

    // --- Handlers ---

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        if (value.length > 9) value = `${value.slice(0, 9)}-${value.slice(9)}`;
        setClientForm(prev => ({ ...prev, phone: value }));
    };

    const handleConfirmBooking = async () => {
        if (!clientForm.name || !clientForm.phone) {
            alert("Por favor, preencha seu nome e telefone/WhatsApp.");
            return;
        }
        
        setIsSaving(true);

        try {
            // 1. Identify Professional & Resource ID
            // Default to '1' (Jacilene) if "Any" or null is selected, to ensure it shows on a column
            const profId = selectedProfessionalId || '1';
            const profObj = PROFISSIONAIS.find(p => p.id === profId);
            const professionalName = profObj ? profObj.title : 'Profissional do Estúdio';

            // 2. Prepare Date
            const [hours, minutes] = (selectedTime || '09:00').split(':').map(Number);
            const startDateTime = new Date(selectedDate);
            startDateTime.setHours(hours, minutes, 0, 0);

            // 3. Prepare Payload
            const serviceNames = selectedServicesList.map(s => s.name).join(' + ');
            const notes = `WhatsApp: ${clientForm.phone}. ${clientForm.notes ? `Obs: ${clientForm.notes}` : ''}`;

            const payload = {
                client_name: clientForm.name,
                client_phone: clientForm.phone, // Nova coluna
                client_email: clientForm.email, // Nova coluna
                service_name: serviceNames,
                professional_name: professionalName,
                resource_id: Number(profId), // Important: Integer for DB column
                date: startDateTime.toISOString(),
                value: totalStats.price,
                status: 'agendado',
                notes: notes,
                origem: 'link'
            };

            console.log('Enviando Agendamento:', payload);

            const { error } = await supabase.from('appointments').insert([payload]);

            if (error) throw error;

            setStep('success');
        } catch (error: any) {
            console.error('Erro ao agendar:', error);
            alert(`Erro ao realizar agendamento: ${error.message || 'Tente novamente.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        if (step === 'professional') setStep('service');
        if (step === 'datetime') setStep('professional');
        if (step === 'form') setStep('datetime');
    };

    const handleNext = () => {
        if (step === 'service') setStep('professional');
        else if (step === 'professional') setStep('datetime');
        else if (step === 'datetime') setStep('form');
    };

    const formatDuration = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
    };

    // --- Render ---

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
                <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Agendamento Confirmado!</h2>
                    <p className="text-slate-500 mb-8">
                        Obrigado, <b>{clientForm.name.split(' ')[0]}</b>. Já reservamos seu horário.
                    </p>
                    
                    <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Serviço</p>
                        <p className="font-semibold text-slate-800 mb-3">{selectedServicesList[0]?.name} {selectedServicesList.length > 1 && `+ ${selectedServicesList.length - 1}`}</p>
                        
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Data e Hora</p>
                        <p className="font-semibold text-slate-800">
                            {format(selectedDate, "dd 'de' MMMM", { locale: pt })} às {selectedTime}
                        </p>
                    </div>

                    <button className="w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition shadow-lg shadow-green-200 mb-3">
                        Receber comprovante no WhatsApp
                    </button>
                    <button onClick={() => window.location.reload()} className="text-slate-400 hover:text-slate-600 text-sm font-medium">
                        Voltar ao início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F9FA] pb-32 font-sans relative">
            {/* Header / Brand */}
            <div className="bg-white p-6 shadow-sm sticky top-0 z-20">
                <div className="max-w-md mx-auto">
                    {step === 'service' ? (
                        <div className="flex gap-4 items-center">
                            <div className="relative">
                                <img src={mockOnlineConfig.logoUrl} className="w-16 h-16 rounded-full border border-slate-100 shadow-sm object-cover" alt="Logo" />
                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                            </div>
                            <div>
                                <h1 className="font-bold text-lg text-slate-900 leading-tight">{mockOnlineConfig.studioName}</h1>
                                <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                                    <MapPin size={12} />
                                    <span className="truncate max-w-[200px]">Centro, São Paulo</span>
                                </div>
                                <div className="flex gap-1 mt-2">
                                    <div className="flex text-amber-400"><Star size={12} fill="currentColor"/> 5.0</div>
                                    <span className="text-xs text-slate-400">(128 avaliações)</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between w-full">
                            <button 
                                onClick={handleBack} 
                                className="flex items-center gap-1 text-slate-600 hover:text-orange-600 transition-colors py-2 pr-3 -ml-2 rounded-lg group"
                            >
                                <div className="bg-slate-100 group-hover:bg-orange-100 rounded-full p-1.5 transition-colors">
                                    <ChevronLeft size={16} />
                                </div>
                                <span className="font-semibold text-sm">Voltar</span>
                            </button>
                            <span className="font-bold text-slate-800 text-sm md:text-base hidden xs:block">
                                {step === 'professional' && 'Escolha o Profissional'}
                                {step === 'datetime' && 'Data e Horário'}
                                {step === 'form' && 'Seus Dados'}
                            </span>
                            <div className="w-16"></div> {/* Spacer */}
                        </div>
                    )}
                    
                    {/* Progress Bar */}
                    {step !== 'service' && (
                        <div className="h-1 bg-slate-100 w-full mt-4 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-orange-500 transition-all duration-500 ease-out"
                                style={{ width: step === 'professional' ? '33%' : step === 'datetime' ? '66%' : '100%' }}
                            ></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-md mx-auto p-4">
                
                {/* STEP 1: SERVICE */}
                {step === 'service' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input 
                                type="text" 
                                placeholder="Buscar procedimento..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white border-none shadow-sm rounded-2xl text-slate-700 focus:ring-2 focus:ring-orange-100 outline-none"
                            />
                        </div>

                        {Object.entries(groupedServices).map(([cat, items]) => (
                            <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <button 
                                    onClick={() => setExpandedCategories(prev => ({...prev, [cat]: !prev[cat]}))}
                                    className="w-full flex items-center justify-between p-4 bg-white border-b border-slate-50"
                                >
                                    <span className="font-bold text-slate-800">{cat}</span>
                                    {expandedCategories[cat] ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                                </button>
                                
                                {expandedCategories[cat] && (
                                    <div className="divide-y divide-slate-50">
                                        {(items as LegacyService[]).map(service => {
                                            const isSelected = selectedServiceIds.includes(service.id);
                                            return (
                                                <div 
                                                    key={service.id}
                                                    onClick={() => setSelectedServiceIds(prev => isSelected ? prev.filter(id => id !== service.id) : [...prev, service.id])}
                                                    className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isSelected ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <div className="flex gap-3 items-start">
                                                        <div className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                                                            {isSelected && <Check size={14} className="text-white" />}
                                                        </div>
                                                        <div>
                                                            <p className={`font-semibold text-sm ${isSelected ? 'text-orange-900' : 'text-slate-700'}`}>{service.name}</p>
                                                            <p className="text-xs text-slate-400 mt-0.5">{formatDuration(service.duration)}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-sm font-bold ${isSelected ? 'text-orange-700' : 'text-slate-600'}`}>
                                                        R$ {service.price.toFixed(2)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* STEP 2: PROFESSIONAL */}
                {step === 'professional' && (
                    <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
                        {/* Summary */}
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl mb-6">
                            <p className="text-xs font-bold text-orange-800 uppercase mb-2">Serviços Selecionados</p>
                            <div className="text-sm text-orange-900 space-y-1 mb-3">
                                {selectedServicesList.map(s => <div key={s.id}>• {s.name}</div>)}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-orange-200/50 text-sm font-bold text-orange-800">
                                <span>Total Estimado</span>
                                <span>R$ {totalStats.price.toFixed(2)}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setSelectedProfessionalId(null); setStep('datetime'); }}
                            className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-orange-300 transition-all group"
                        >
                            <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                ?
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-800">Qualquer Profissional</h3>
                                <p className="text-xs text-slate-500">Máxima disponibilidade de horários</p>
                            </div>
                            <ChevronDown className="-rotate-90 ml-auto text-slate-300" />
                        </button>

                        <div className="grid grid-cols-1 gap-3">
                            {PROFISSIONAIS.map(prof => (
                                <button
                                    key={prof.id}
                                    onClick={() => { setSelectedProfessionalId(prof.id); setStep('datetime'); }}
                                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-orange-300 transition-all text-left group"
                                >
                                    <img src={prof.avatar} alt={prof.title} className="w-14 h-14 rounded-full object-cover border-2 border-slate-50" />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800">{prof.title}</h3>
                                        <p className="text-xs text-slate-500">{prof.role}</p>
                                        <div className="flex items-center gap-1 mt-1 text-amber-400">
                                            <Star size={10} fill="currentColor" />
                                            <span className="text-xs font-bold text-slate-600">4.9</span>
                                        </div>
                                    </div>
                                    <ChevronDown className="-rotate-90 text-slate-300 group-hover:text-orange-400" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 3: DATE & TIME */}
                {step === 'datetime' && (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-white p-5 rounded-2xl shadow-sm">
                            <h2 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Escolha o Dia</h2>
                            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                                {dates.map(date => {
                                    const selected = isSameDay(date, selectedDate);
                                    return (
                                        <button
                                            key={date.toISOString()}
                                            onClick={() => setSelectedDate(date)}
                                            className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${
                                                selected 
                                                ? 'bg-slate-800 text-white border-slate-800 shadow-lg scale-105' 
                                                : 'bg-white text-slate-500 border-transparent hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="text-[10px] font-bold uppercase mb-1">{format(date, 'EEE', { locale: pt })}</span>
                                            <span className="text-xl font-bold">{format(date, 'dd')}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm">
                             <h2 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Horários Disponíveis</h2>
                             <div className="grid grid-cols-4 gap-3">
                                {timeSlots.map(time => (
                                    <button
                                        key={time}
                                        onClick={() => setSelectedTime(time)}
                                        className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                            selectedTime === time
                                            ? 'bg-orange-500 text-white border-orange-500 shadow-md transform scale-105'
                                            : 'bg-white text-slate-600 border-slate-100 hover:border-orange-200'
                                        }`}
                                    >
                                        {time}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: FORM */}
                {step === 'form' && (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        {/* Recap Card */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-pink-500"></div>
                            <h3 className="font-bold text-slate-800 mb-4 text-lg">Resumo do Agendamento</h3>
                            
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Serviço</span>
                                    <span className="font-semibold text-slate-900 text-right w-1/2">{selectedServicesList.map(s => s.name).join(', ')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Profissional</span>
                                    <span className="font-semibold text-slate-900">
                                        {selectedProfessionalId ? PROFISSIONAIS.find(p=>p.id===selectedProfessionalId)?.title : 'Qualquer Profissional'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Data e Hora</span>
                                    <span className="font-semibold text-slate-900">{format(selectedDate, "dd/MM", { locale: pt })} às {selectedTime}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-3 flex justify-between items-center mt-2">
                                    <span className="font-bold text-slate-500">Total</span>
                                    <span className="font-bold text-xl text-green-600">R$ {totalStats.price.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                            <h2 className="font-bold text-slate-800 text-lg">Seus Dados</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nome Completo <span className="text-red-500">*</span></label>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-orange-200 focus-within:border-orange-400 transition-all">
                                        <User className="w-5 h-5 text-slate-400" />
                                        <input 
                                            type="text" 
                                            value={clientForm.name}
                                            onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
                                            className="w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                                            placeholder="Seu nome"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">WhatsApp <span className="text-red-500">*</span></label>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-orange-200 focus-within:border-orange-400 transition-all">
                                        <Phone className="w-5 h-5 text-slate-400" />
                                        <input 
                                            type="tel" 
                                            value={clientForm.phone}
                                            onChange={handlePhoneChange}
                                            maxLength={15}
                                            className="w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                                            placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">E-mail (Opcional)</label>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-orange-200 focus-within:border-orange-400 transition-all">
                                        <Mail className="w-5 h-5 text-slate-400" />
                                        <input 
                                            type="email" 
                                            value={clientForm.email}
                                            onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
                                            className="w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                                    <textarea 
                                        value={clientForm.notes}
                                        onChange={(e) => setClientForm({...clientForm, notes: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none transition-all placeholder:text-slate-400"
                                        placeholder="Alguma preferência ou alergia?"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* BOTTOM ACTION BAR */}
            {selectedServicesList.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-100 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{selectedServicesList.length} serviço(s)</span>
                            <div className="flex items-baseline gap-1">
                                <span className="font-extrabold text-slate-800 text-xl">R$ {totalStats.price.toFixed(2)}</span>
                                <span className="text-xs font-medium text-slate-500">{formatDuration(totalStats.duration)}</span>
                            </div>
                        </div>
                        <button 
                            onClick={step === 'form' ? handleConfirmBooking : handleNext}
                            disabled={
                                (step === 'datetime' && !selectedTime) || 
                                (step === 'form' && (!clientForm.name || !clientForm.phone)) ||
                                isSaving
                            }
                            className="bg-slate-900 text-white font-bold py-3.5 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition-all shadow-lg active:scale-95 flex items-center gap-2 min-w-[160px] justify-center"
                        >
                            {isSaving ? (
                                <Loader2 className="animate-spin w-5 h-5" />
                            ) : (
                                <>
                                    {step === 'form' ? 'Confirmar' : 'Continuar'} 
                                    {step !== 'form' && <ChevronDown className="rotate-[-90deg] w-4 h-4"/>}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicBookingPreview;