
import React, { useState, useEffect, useRef } from 'react';
import { 
    Store, Save, Loader2, MapPin, Phone, Instagram, 
    Camera, ArrowLeft, Clock, Coffee, Building2, Hash, Mail, Globe, 
    Image as ImageIcon, RefreshCw, Palette, ChevronDown
} from 'lucide-react';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

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
    enabled: false, 
    start: '09:00', 
    end: '18:00', 
    break: { enabled: false, start: '12:00', end: '13:00' } 
};

const BusinessSettings = ({ onBack }: { onBack: () => void }) => {
    const { activeStudioId } = useStudio();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState<'cover' | 'logo' | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<any>({
        business_name: '',
        cnpj_cpf: '',
        phone: '',
        email: '',
        instagram_handle: '',
        description: '',
        cover_url: '',
        logo_url: '',
        zip_code: '',
        street: '',
        number: '',
        district: '',
        city: '',
        state: '',
        business_hours: {},
        primary_color: '#f97316',
        portfolio_urls: []
    });

    const sanitizeBusinessHours = (rawHours: any) => {
        const sanitized: any = {};
        const source = rawHours || {};
        DAYS_ORDER.forEach(({ key }) => {
            const dayData = source[key] || {};
            sanitized[key] = {
                enabled: dayData.enabled ?? dayData.open ?? DEFAULT_DAY.enabled,
                start: dayData.start || DEFAULT_DAY.start,
                end: dayData.end || DEFAULT_DAY.end,
                break: {
                    enabled: dayData.break?.enabled ?? dayData.break?.active ?? DEFAULT_DAY.break.enabled,
                    start: dayData.break?.start || DEFAULT_DAY.break.start,
                    end: dayData.break?.end || DEFAULT_DAY.break.end
                }
            };
        });
        return sanitized;
    };

    const fetchProfile = async () => {
        if (!activeStudioId) return;
        try {
            const { data, error } = await supabase.rpc('get_business_profile');
            if (error) throw error;
            if (data) {
                setFormData({
                    business_name: data.business_name ?? '',
                    cnpj_cpf: data.cnpj_cpf ?? '',
                    phone: data.phone ?? '',
                    email: data.email ?? '',
                    description: data.description ?? '',
                    zip_code: data.zip_code ?? '',
                    street: data.street ?? '',
                    number: data.number ?? '',
                    district: data.district ?? '',
                    city: data.city ?? '',
                    state: data.state ?? '',
                    instagram_handle: data.instagram_handle ?? '',
                    primary_color: data.primary_color ?? '#f97316',
                    logo_url: data.logo_url ?? '',
                    cover_url: data.cover_url ?? '',
                    portfolio_urls: data.portfolio_urls ?? [],
                    business_hours: sanitizeBusinessHours(data.business_hours)
                });
            }
        } catch (err) {
            console.error("Erro ao carregar perfil:", err);
            setToast({ message: "Erro ao carregar dados.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [activeStudioId]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'logo') => {
        const file = event.target.files?.[0];
        if (!file || !activeStudioId) return;
        setIsUploading(type);
        try {
            const fileName = `${activeStudioId}/${Date.now()}_${type}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('business-media').upload(fileName, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('business-media').getPublicUrl(fileName);
            setFormData(prev => ({ ...prev, [type === 'cover' ? 'cover_url' : 'logo_url']: publicUrl }));
            setToast({ message: "Imagem enviada!", type: 'success' });
        } finally { setIsUploading(null); }
    };

    const handleSave = async () => {
        if (!activeStudioId) return;
        setIsSaving(true);
        try {
            // ✅ Utilizando o RPC save_business_profile conforme a assinatura solicitada
            const { error } = await supabase.rpc('save_business_profile', {
                p_business_name: formData.business_name,
                p_cnpj_cpf: formData.cnpj_cpf,
                p_phone: formData.phone,
                p_email: formData.email,
                p_description: formData.description,
                p_zip_code: formData.zip_code,
                p_street: formData.street,
                p_number: formData.number,
                p_district: formData.district,
                p_city: formData.city,
                p_state: formData.state,
                p_instagram_handle: formData.instagram_handle,
                p_primary_color: formData.primary_color,
                p_logo_url: formData.logo_url,
                p_cover_url: formData.cover_url,
                p_portfolio_urls: formData.portfolio_urls,
                p_business_hours: formData.business_hours
            });

            if (error) throw error;

            // ✅ Recarrega para garantir que UI está 100% igual ao banco
            const { data: refreshData, error: refreshError } = await supabase.rpc('get_business_profile');
            if (refreshError) throw refreshError;
            
            if (refreshData) {
                setFormData(prev => ({
                    ...prev,
                    business_hours: sanitizeBusinessHours(refreshData.business_hours)
                }));
            }

            setToast({ message: "Perfil atualizado com sucesso! ✅", type: 'success' });
            setTimeout(onBack, 1500);
        } catch (err: any) {
            console.error(err);
            setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
        } finally { setIsSaving(false); }
    };

    const updateDay = (day: string, field: string, value: any) => {
        setFormData(prev => ({ ...prev, business_hours: { ...prev.business_hours, [day]: { ...prev.business_hours[day], [field]: value } } }));
    };

    const updateBreak = (day: string, field: string, value: any) => {
        setFormData(prev => ({ ...prev, business_hours: { ...prev.business_hours, [day]: { ...prev.business_hours[day], break: { ...prev.business_hours[day].break, [field]: value } } } }));
    };

    if (isLoading) return <div className="h-64 flex flex-col items-center justify-center text-slate-400"><Loader2 className="animate-spin mb-4 text-orange-500" size={40} /><p className="text-xs font-black uppercase">Sincronizando dados...</p></div>;

    return (
        <div className="max-w-4xl mx-auto pb-32 animate-in fade-in duration-500 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <input type="file" ref={coverInputRef} onChange={(e) => handleFileUpload(e, 'cover')} hidden accept="image/*" />
            <input type="file" ref={logoInputRef} onChange={(e) => handleFileUpload(e, 'logo')} hidden accept="image/*" />
            
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-600 transition-all shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Perfil do Negócio</h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Identidade Visual e Atendimento</p>
                </div>
            </div>

            <div className="mb-16">
                <div className="relative group">
                    <div onClick={() => !isUploading && coverInputRef.current?.click()} className={`h-48 md:h-64 w-full rounded-[40px] overflow-hidden bg-slate-200 shadow-inner border border-slate-100 cursor-pointer relative ${isUploading === 'cover' ? 'opacity-70' : ''}`}>
                        {formData.cover_url ? (
                            <img src={formData.cover_url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="Capa" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                <ImageIcon size={40} className="opacity-20" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Clique para enviar Capa</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <button className="bg-white/90 backdrop-blur px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl"><Camera size={18} /> {isUploading === 'cover' ? 'Enviando...' : 'Alterar Capa'}</button>
                        </div>
                        {isUploading === 'cover' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                <RefreshCw className="animate-spin text-orange-500" size={32} />
                            </div>
                        )}
                    </div>

                    <div className="absolute -bottom-10 left-10">
                        <div onClick={() => !isUploading && logoInputRef.current?.click()} className={`relative group/logo cursor-pointer ${isUploading === 'logo' ? 'opacity-70' : ''}`}>
                            <div className="w-32 h-32 rounded-full ring-8 ring-white shadow-2xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center relative">
                                {formData.logo_url ? (
                                    <img src={formData.logo_url} className="w-full h-full object-cover" alt="Logo" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-orange-100 text-orange-50">
                                        <Store size={40} />
                                        <span className="text-[8px] font-black uppercase mt-1 text-center px-2">Upload Logo</span>
                                    </div>
                                )}
                                {isUploading === 'logo' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                        <RefreshCw className="animate-spin text-orange-500" size={24} />
                                    </div>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity pointer-events-none">
                                <Camera className="text-white" size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
                <Card title="Informações Gerais" icon={<Building2 size={18} />}>
                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Estúdio</label>
                            <input value={formData.business_name} onChange={e => setFormData({...formData, business_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 transition-all shadow-sm" placeholder="Nome fantasia" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ / CPF</label>
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input value={formData.cnpj_cpf} onChange={e => setFormData({...formData, cnpj_cpf: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" placeholder="00.000.000/0000-00" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp de Contato</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" placeholder="(00) 00000-0000" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instagram (@)</label>
                                <div className="relative">
                                    <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <input value={formData.instagram_handle} onChange={e => setFormData({...formData, instagram_handle: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" placeholder="@perfil" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Administrativo</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" placeholder="contato@empresa.com" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Principal da Marca</label>
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                    <Palette size={18} className="text-slate-400" />
                                </div>
                                <input type="color" value={formData.primary_color} onChange={e => setFormData({...formData, primary_color: e.target.value})} className="w-full h-8 cursor-pointer bg-transparent border-none p-0" />
                                <span className="text-xs font-black text-slate-500 uppercase font-mono">{formData.primary_color}</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="Endereço da Unidade" icon={<MapPin size={18} />}>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CEP</label>
                            <input value={formData.zip_code} onChange={e => setFormData({...formData, zip_code: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" placeholder="00000-000" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade</label>
                            <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" placeholder="Cidade" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rua / Avenida</label>
                            <input value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" placeholder="Nome do logradouro" />
                        </div>
                        <div className="col-span-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</label>
                            <input value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" placeholder="123" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                            <input value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" placeholder="Bairro" />
                        </div>
                        <div className="col-span-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UF</label>
                            <input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase().slice(0,2)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none text-center" placeholder="SP" maxLength={2} />
                        </div>
                    </div>
                </Card>

                <div className="md:col-span-2">
                    <Card title="Apresentação do Estúdio" icon={<Globe size={18} />}>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Texto de Boas-vindas (Agenda Online)</label>
                            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 min-h-[120px] outline-none focus:ring-4 focus:ring-orange-50 font-medium text-slate-600 resize-none" placeholder="Conte um pouco sobre a história e especialidades do seu estúdio..." />
                        </div>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    <Card title="Horários de Atendimento" icon={<Clock size={18} />}>
                        <div className="grid grid-cols-1 gap-3">
                            {DAYS_ORDER.map(({ key, label }) => {
                                const config = formData.business_hours[key] || DEFAULT_DAY;
                                return (
                                    <div key={key} className={`flex flex-col xl:flex-row items-center justify-between p-5 rounded-3xl border transition-all ${config.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                        <div className="flex items-center gap-4 w-full xl:w-1/4 mb-4 xl:mb-0">
                                            <ToggleSwitch on={config.enabled} onClick={() => updateDay(key, 'enabled', !config.enabled)} />
                                            <span className="font-black text-slate-700 text-sm w-32 uppercase tracking-tighter">{label}</span>
                                        </div>
                                        
                                        {config.enabled ? (
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
                                                        <input type="checkbox" checked={config.break?.enabled ?? false} onChange={e => updateBreak(key, 'enabled', e.target.checked)} className="w-5 h-5 rounded text-orange-500 border-slate-300 focus:ring-orange-500" />
                                                        <Coffee size={16} className={config.break?.enabled ? "text-orange-500" : "text-slate-300"} />
                                                    </div>
                                                    {config.break?.enabled && (
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
                <button onClick={handleSave} disabled={isSaving} className="pointer-events-auto min-w-[240px] px-12 py-5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-[24px] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {isSaving ? 'Sincronizando...' : 'Salvar Perfil do Estúdio'}
                </button>
            </div>
        </div>
    );
};

export default BusinessSettings;
