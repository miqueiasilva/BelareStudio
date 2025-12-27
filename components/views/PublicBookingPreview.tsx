
import React, { useState, useMemo, useEffect } from 'react';
import { 
    ChevronLeft, Check, Star, Search, Image as ImageIcon, 
    ChevronDown, ChevronUp, Share2, Loader2, MapPin, Phone, 
    User, Mail, ShoppingBag, Clock, Calendar, Scissors, 
    CheckCircle2, ArrowRight, UserCircle2
} from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import ToggleSwitch from '../shared/ToggleSwitch';

// --- Assets & Fallbacks ---
const DEFAULT_COVER = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1350&q=80";
const DEFAULT_LOGO = "https://ui-avatars.com/api/?name=BelaFlow&background=random";

// --- Sub-componente: Item de Serviço ---
const ServiceItem = ({ service, isSelected, onToggle }: any) => (
    <div 
        onClick={() => onToggle(service)}
        className={`p-4 flex justify-between items-center border-b border-slate-50 last:border-0 cursor-pointer transition-all active:scale-[0.98] ${isSelected ? 'bg-orange-50/50' : 'hover:bg-slate-50'}`}
    >
        <div className="flex-1 pr-4">
            <h4 className="font-bold text-slate-800 text-sm">{service.name}</h4>
            <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                    <Clock size={10} /> {service.duracao_min} min
                </span>
                <span className="text-orange-600 font-black text-sm">
                    R$ {service.preco.toFixed(2)}
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

// --- Sub-componente: Accordion de Categoria ---
const AccordionCategory = ({ category, services, selectedIds, onToggleService }: any) => {
    const [isOpen, setIsOpen] = useState(true);
    const selectedCount = services.filter((s: any) => selectedIds.includes(s.id)).length;

    return (
        <div className="mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">{category}</h3>
                    {selectedCount > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {selectedCount}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
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
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const PublicBookingPreview: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [studio, setStudio] = useState<any>(null);
    const [services, setServices] = useState<any[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    
    // UI State
    const [selectedServices, setSelectedServices] = useState<any[]>([]);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [bookingStep, setBookingStep] = useState(1); // 1: Profissional, 2: Data/Hora, 3: Identificação

    // --- Data Fetching ---
    useEffect(() => {
        const loadPageData = async () => {
            setLoading(true);
            try {
                // 1. Studio Branding
                const { data: studioData } = await supabase.from('studio_settings').select('*').maybeSingle();
                if (studioData) setStudio(studioData);

                // 2. Available Services
                const { data: servicesData } = await supabase.from('services').select('*').eq('ativo', true);
                if (servicesData) setServices(servicesData);

                // 3. Professionals
                const { data: profsData } = await supabase.from('professionals').select('*').eq('active', true);
                if (profsData) setProfessionals(profsData);

            } catch (e) {
                console.error("Erro ao carregar dados públicos", e);
            } finally {
                setLoading(false);
            }
        };
        loadPageData();
    }, []);

    // --- Logical Grouping ---
    const servicesByCategory = useMemo(() => {
        const groups: Record<string, any[]> = {};
        services.forEach(s => {
            const cat = s.categoria || 'Outros';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });
        return groups;
    }, [services]);

    const totalPrice = useMemo(() => {
        return selectedServices.reduce((acc, s) => acc + s.preco, 0);
    }, [selectedServices]);

    // --- Handlers ---
    const toggleService = (service: any) => {
        setSelectedServices(prev => {
            const isAlreadySelected = prev.find(s => s.id === service.id);
            if (isAlreadySelected) return prev.filter(s => s.id !== service.id);
            return [...prev, service];
        });
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="animate-spin text-orange-500 w-10 h-10 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Acessando BelaFlow...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans relative pb-40">
            
            {/* HEADER: BANNER + IDENTITY */}
            <div className="relative h-48 md:h-64 bg-slate-900">
                <img 
                    src={studio?.cover_image_url || DEFAULT_COVER} 
                    className="w-full h-full object-cover opacity-50"
                    alt="Banner"
                />
                {/* Botão Meus Agendamentos */}
                <button className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20 shadow-xl">
                    <UserCircle2 size={20} />
                    <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Meus Agendamentos</span>
                </button>
            </div>

            <div className="max-w-xl mx-auto px-6 -mt-16 relative z-10">
                <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-3xl bg-white border-4 border-white shadow-xl -mt-20 overflow-hidden mb-4">
                        <img src={studio?.logo_image_url || DEFAULT_LOGO} className="w-full h-full object-cover" alt="Logo" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 leading-tight">
                        {studio?.studio_name || "Seu Estúdio"}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-slate-400">
                        <div className="flex items-center gap-1 text-amber-400 font-bold">
                            <Star size={14} fill="currentColor" /> 5.0
                        </div>
                        <span className="text-slate-200">|</span>
                        <div className="flex items-center gap-1 text-xs font-medium">
                            <MapPin size={14} className="text-orange-500" /> 
                            {studio?.address || "Endereço não informado"}
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-500 leading-relaxed italic">
                        "{studio?.presentation_text || "Bem-vindo ao nosso espaço de beleza!"}"
                    </p>
                </div>

                {/* LISTA DE SERVIÇOS (Accordions) */}
                <div className="mt-8 space-y-2">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Escolha os serviços</h2>
                    
                    {Object.entries(servicesByCategory).map(([cat, items]) => (
                        <AccordionCategory 
                            key={cat}
                            category={cat}
                            services={items}
                            selectedIds={selectedServices.map(s => s.id)}
                            onToggleService={toggleService}
                        />
                    ))}
                </div>
            </div>

            {/* BARRA FLUTUANTE (Bottom Sheet) */}
            {selectedServices.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-6 z-40 bg-gradient-to-t from-white via-white to-white/80 backdrop-blur-md border-t border-slate-100 animate-in slide-in-from-bottom-full duration-500">
                    <div className="max-w-xl mx-auto flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {selectedServices.length} {selectedServices.length === 1 ? 'Serviço selecionado' : 'Serviços selecionados'}
                            </p>
                            <p className="text-xl font-black text-slate-800">Total R$ {totalPrice.toFixed(2)}</p>
                        </div>
                        <button 
                            onClick={() => { setIsBookingOpen(true); setBookingStep(1); }}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-orange-100 flex items-center gap-2 transition-all active:scale-95"
                        >
                            Continuar <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DE AGENDAMENTO (Wizard) */}
            {isBookingOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <header className="p-6 border-b border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {bookingStep > 1 && (
                                    <button onClick={() => setBookingStep(prev => prev - 1)} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:bg-slate-200">
                                        <ChevronLeft size={20} />
                                    </button>
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
                            <button onClick={() => setIsBookingOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
                        </header>

                        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            
                            {/* STEP 1: PROFISSIONAL */}
                            {bookingStep === 1 && (
                                <div className="space-y-4">
                                    <button 
                                        onClick={() => setBookingStep(2)}
                                        className="w-full p-5 flex items-center gap-4 border-2 border-slate-100 rounded-3xl hover:border-orange-200 hover:bg-orange-50/30 transition-all text-left group"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-500 transition-colors">
                                            <Scissors size={24} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-base leading-none">Qualquer Profissional</p>
                                            <p className="text-xs text-slate-400 mt-1 font-medium">O horário disponível mais próximo.</p>
                                        </div>
                                    </button>

                                    {professionals.map(p => (
                                        <button 
                                            key={p.id}
                                            onClick={() => setBookingStep(2)}
                                            className="w-full p-5 flex items-center gap-4 border-2 border-slate-100 rounded-3xl hover:border-orange-200 hover:bg-orange-50/30 transition-all text-left"
                                        >
                                            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-md">
                                                <img src={p.photo_url || DEFAULT_LOGO} className="w-full h-full object-cover" alt={p.name} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-base leading-none">{p.name}</p>
                                                <p className="text-xs text-slate-400 mt-1 font-medium">{p.role}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* STEP 2: DATA/HORA (Placeholder) */}
                            {bookingStep === 2 && (
                                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                                    <Calendar size={64} className="mb-4 opacity-20" />
                                    <p className="font-bold">Calendário de disponibilidade</p>
                                    <p className="text-xs max-w-[200px] mt-2">Escolha um dia e um dos horários livres.</p>
                                    <button onClick={() => setBookingStep(3)} className="mt-8 bg-slate-800 text-white px-8 py-3 rounded-2xl font-black text-sm">Simular Próximo</button>
                                </div>
                            )}

                            {/* STEP 3: IDENTIFICAÇÃO */}
                            {bookingStep === 3 && (
                                <div className="space-y-6">
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Resumo do Pedido</h4>
                                        <div className="space-y-3">
                                            {selectedServices.map(s => (
                                                <div key={s.id} className="flex justify-between items-center text-sm font-bold text-slate-700">
                                                    <span>{s.name}</span>
                                                    <span>R$ {s.preco.toFixed(2)}</span>
                                                </div>
                                            ))}
                                            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                                                <span className="text-xs font-black uppercase text-slate-400">Total</span>
                                                <span className="text-xl font-black text-orange-600">R$ {totalPrice.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Seu Nome Completo</label>
                                            <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-100 font-bold" placeholder="Como devemos te chamar?" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">WhatsApp para Lembrete</label>
                                            <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-100 font-bold" placeholder="(00) 00000-0000" />
                                        </div>
                                    </div>
                                    
                                    <button className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-[24px] font-black shadow-xl shadow-green-100 flex items-center justify-center gap-3 transition-all active:scale-95">
                                        <CheckCircle2 size={24} />
                                        Finalizar Agendamento
                                    </button>
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            )}
        </div>
    );
};

const X = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export default PublicBookingPreview;
