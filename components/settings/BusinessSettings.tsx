
import React, { useState, useEffect } from 'react';
import { 
    Store, Save, Loader2, MapPin, Phone, Instagram, 
    Camera, ArrowLeft, Clock, Coffee, Building2, Hash
} from 'lucide-react';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';

// --- Constantes de Configuração Segura ---
const DAYS_ORDER = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const DEFAULT_DAY = { 
    open: false, 
    start: '09:00', 
    end: '18:00', 
    break: { active: false, start: '12:00', end: '13:00' } 
};

const BusinessSettings = ({ onBack }: { onBack: () => void }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const [formData, setFormData] = useState<any>({
        studio_name: '',
        cnpj: '',
        whatsapp: '',
        instagram_handle: '',
        cover_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
        profile_url: '',
        address_zip: '',
        address_street: '',
        address_number: '',
        address_neighborhood: '',
        address_city: '',
        address_state: '',
        business_hours: {} // Será preenchido na sanitização
    });

    // Função de Sanitização: Garante que todos os dias existam e tenham a estrutura correta
    const sanitizeBusinessHours = (rawHours: any) => {
        const sanitized: any = {};
        const source = rawHours || {};
        
        DAYS_ORDER.forEach(({ key }) => {
            const dayData = source[key] || {};
            sanitized[key] = {
                open: dayData.open ?? DEFAULT_DAY.open,
                start: dayData.start || DEFAULT_DAY.start,
                end: dayData.end || DEFAULT_DAY.end,
                break: {
                    active: dayData.break?.active ?? DEFAULT_DAY.break.active,
                    start: dayData.break?.start || DEFAULT_DAY.break.start,
                    end: dayData.break?.end || DEFAULT_DAY.break.end
                }
            };
        });
        return sanitized;
    };

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('studio_settings').select('*').limit(1).maybeSingle();
                if (data) {
                    setFormData({
                        ...data,
                        business_hours: sanitizeBusinessHours(data.business_hours)
                    });
                } else {
                    // Inicializa com horas vazias mas sanitizadas se não houver registro
                    setFormData((prev: any) => ({
                        ...prev,
                        business_hours: sanitizeBusinessHours({})
                    }));
                }
            } catch (err) {
                console.error("Erro ao carregar configurações:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.from('studio_settings').upsert({
                ...formData,
                updated_at: new Date()
            }, { onConflict: 'id' });
            
            if (error) throw error;
            
            setToast({ message: "Configurações salvas com sucesso!", type: 'success' });
            setTimeout(onBack, 1500);
        } catch (error: any) {
            setToast({ message: `Erro ao salvar: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const updateDay = (day: string, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            business_hours: {
                ...prev.business_hours,
                [day]: { ...prev.business_hours[day], [field]: value }
            }
        }));
    };

    const updateBreak = (day: string, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            business_hours: {
                ...prev.business_hours,
                [day]: { 
                    ...prev.business_hours[day], 
                    break: { ...prev.business_hours[day].break, [field]: value } 
                }
            }
        }));
    };

    if (isLoading) return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
            <p className="text-xs font-black uppercase tracking-widest">Carregando perfil...</p>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header / Botão Voltar */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-600 transition-all shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Perfil do Negócio</h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Identidade e regras de atendimento</p>
                </div>
            </div>

            {/* Hero: Banner + Logo */}
            <div className="mb-12">
                <div className="relative group">
                    <div className="h-48 md:h-64 w-full rounded-[40px] overflow-hidden bg-slate-200 shadow-inner border border-slate-100">
                        <img src={formData.cover_url} className="w-full h-full object-cover" alt="Capa" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button className="bg-white/90 backdrop-blur p-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl active:scale-95">
                                <Camera size={18} /> Alterar Capa
                            </button>
                        </div>
                    </div>

                    <div className="absolute -bottom-10 left-10">
                        <div className="relative group/logo">
                            <div className="w-32 h-32 rounded-full ring-8 ring-white shadow-2xl overflow-hidden bg-white border border-slate-100">
                                {formData.profile_url ? (
                                    <img src={formData.profile_url} className="w-full h-full object-cover" alt="Logo" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-50">
                                        <Store size={40} />
                                    </div>
                                )}
                            </div>
                            <button className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                                <Camera className="text-white" size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
                {/* Dados Básicos */}
                <Card title="Informações Gerais" icon={<Building2 size={18} />}>
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Fantasia</label>
                            <input 
                                value={formData.studio_name}
                                onChange={e => setFormData({...formData, studio_name: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 transition-all shadow-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input 
                                    value={formData.cnpj}
                                    onChange={e => setFormData({...formData, cnpj: e.target.value})}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                                    placeholder="00.000.000/0000-00"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                                <input 
                                    value={formData.whatsapp}
                                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instagram (@)</label>
                                <input 
                                    value={formData.instagram_handle}
                                    onChange={e => setFormData({...formData, instagram_handle: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Localização */}
                <Card title="Localização" icon={<MapPin size={18} />}>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CEP</label>
                            <input 
                                value={formData.address_zip}
                                onChange={e => setFormData({...formData, address_zip: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade e UF</label>
                            <input 
                                value={formData.address_city}
                                onChange={e => setFormData({...formData, address_city: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logradouro</label>
                            <input 
                                value={formData.address_street}
                                onChange={e => setFormData({...formData, address_street: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</label>
                            <input 
                                value={formData.address_number}
                                onChange={e => setFormData({...formData, address_number: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="col-span-3 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                            <input 
                                value={formData.address_neighborhood}
                                onChange={e => setFormData({...formData, address_neighborhood: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none"
                            />
                        </div>
                    </div>
                </Card>

                {/* Horários de Operação - Implementação Fixa por DAYS_ORDER */}
                <div className="md:col-span-2">
                    <Card title="Horários de Operação" icon={<Clock size={18} />}>
                        <div className="grid grid-cols-1 gap-3">
                            {DAYS_ORDER.map(({ key, label }) => {
                                const config = formData.business_hours[key] || DEFAULT_DAY;
                                return (
                                    <div key={key} className={`flex flex-col xl:flex-row items-center justify-between p-5 rounded-3xl border transition-all ${config.open ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                        <div className="flex items-center gap-4 w-full xl:w-1/4 mb-4 xl:mb-0">
                                            <ToggleSwitch on={config.open} onClick={() => updateDay(key, 'open', !config.open)} />
                                            <span className="font-black text-slate-700 text-sm w-32 uppercase tracking-tighter">{label}</span>
                                        </div>
                                        
                                        {config.open ? (
                                            <div className="flex flex-col md:flex-row items-center gap-4 xl:gap-8 w-full xl:w-3/4 justify-end">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Início</span>
                                                        <input type="time" value={config.start} onChange={e => updateDay(key, 'start', e.target.value)} className="bg-transparent border-none p-0 text-sm font-black text-slate-700 outline-none focus:ring-0" />
                                                    </div>
                                                    <span className="text-slate-300 font-bold text-xs">até</span>
                                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Fim</span>
                                                        <input type="time" value={config.end} onChange={e => updateDay(key, 'end', e.target.value)} className="bg-transparent border-none p-0 text-sm font-black text-slate-700 outline-none focus:ring-0" />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 border-l-2 border-slate-100 pl-8">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={config.break?.active ?? false} 
                                                            onChange={e => updateBreak(key, 'active', e.target.checked)}
                                                            className="w-5 h-5 rounded text-orange-500 border-slate-300 focus:ring-orange-500"
                                                        />
                                                        <Coffee size={16} className={config.break?.active ? "text-orange-500" : "text-slate-300"} />
                                                    </div>
                                                    {config.break?.active && (
                                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                                            <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-xl border border-orange-100">
                                                                <input type="time" value={config.break.start} onChange={e => updateBreak(key, 'start', e.target.value)} className="bg-transparent border-none p-0 text-xs font-black text-orange-600 outline-none focus:ring-0" />
                                                                <span className="text-[10px] font-bold text-orange-300">às</span>
                                                                <input type="time" value={config.break.end} onChange={e => updateBreak(key, 'end', e.target.value)} className="bg-transparent border-none p-0 text-xs font-black text-orange-600 outline-none focus:ring-0" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 text-right">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-xl">Fechado</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white to-transparent flex justify-center pointer-events-none z-50">
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="pointer-events-auto min-w-[240px] px-12 py-5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-[24px] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {isSaving ? 'Gravando Alterações...' : 'Salvar Perfil do Estúdio'}
                </button>
            </div>
        </div>
    );
};

export default BusinessSettings;
