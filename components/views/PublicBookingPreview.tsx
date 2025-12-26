import React, { useState, useMemo, useEffect } from 'react';
import { 
    ChevronLeft, Check, Star, Search, Image as ImageIcon, 
    ChevronDown, ChevronUp, Share2, Loader2, MapPin, Phone, User, Mail
} from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { services } from '../../data/mockData';

// Fallbacks para quando o estúdio não configurou branding
const DEFAULT_COVER = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1350&q=80";
const DEFAULT_LOGO = "https://ui-avatars.com/api/?name=BelaFlow&background=random";

const PublicBookingPreview: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [studio, setStudio] = useState<any>(null);
    const [step, setStep] = useState('service');

    // Busca dados reais do estúdio
    useEffect(() => {
        const fetchStudio = async () => {
            try {
                const { data, error } = await supabase.from('studio_settings').select('*').maybeSingle();
                if (data) setStudio(data);
            } catch (e) {
                console.error("Erro ao carregar página pública", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStudio();
    }, []);

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="animate-spin text-orange-500 w-10 h-10 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Abrindo agenda online...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8F9FA] pb-32 font-sans relative">
            
            {/* 1. Camada de Visualização - HEADER DINÂMICO */}
            {step === 'service' && (
                <div className="w-full h-56 md:h-72 relative overflow-hidden bg-slate-900 animate-in fade-in duration-700">
                    <img 
                        src={studio?.cover_image_url || DEFAULT_COVER} 
                        className="w-full h-full object-cover opacity-60"
                        alt="Capa do Estúdio"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 right-6">
                        <div className="max-w-md mx-auto flex items-center gap-4">
                            {/* Logo Dinâmica */}
                            <div className="relative">
                                <img 
                                    src={studio?.logo_image_url || DEFAULT_LOGO} 
                                    className="w-20 h-20 rounded-2xl border-4 border-white shadow-2xl object-cover bg-white" 
                                    alt="Logo" 
                                />
                                <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white leading-tight drop-shadow-md">
                                    {studio?.studio_name || "Bela Studio"}
                                </h1>
                                <div className="flex items-center gap-2 text-slate-200 text-xs mt-1">
                                    <MapPin size={12} className="text-orange-400" />
                                    <span className="truncate max-w-[200px]">{studio?.address || "Endereço não informado"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Conteúdo da página segue o layout de reserva... */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-20">
                <div className="max-w-md mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="flex text-amber-400"><Star size={14} fill="currentColor"/> 5.0</div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avaliações</span>
                    </div>
                    <button className="p-2 text-slate-400 hover:text-orange-500"><Share2 size={18}/></button>
                </div>
            </div>

            <div className="max-w-md mx-auto p-4 text-center mt-10">
                <h3 className="font-bold text-slate-800">Selecione o serviço desejado</h3>
                <p className="text-sm text-slate-500 mt-2">Escolha abaixo para ver os horários disponíveis.</p>
                {/* Lista de serviços simulada para o exemplo */}
                <div className="mt-8 space-y-3">
                    {Object.values(services).slice(0, 4).map(s => (
                        <div key={s.id} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-slate-700">{s.name}</span>
                            <button className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-black">Agendar</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PublicBookingPreview;