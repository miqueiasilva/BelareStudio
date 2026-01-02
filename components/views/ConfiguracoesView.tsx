
import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Store, Save, Loader2, MapPin, Phone, 
    Globe, Camera, Image as ImageIcon, Instagram, 
    Facebook, Layout, CreditCard, Hash, Map, Navigation, 
    CheckCircle2, Clock, Calendar, Coffee, AlertCircle, TrendingUp,
    DollarSign
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const InputField = ({ label, icon: Icon, value, onChange, placeholder, type = "text", name, disabled }: any) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group">
            {Icon && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors">
                    <Icon size={18} />
                </div>
            )}
            <input 
                type={type}
                name={name}
                value={value || ''}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
                className={`w-full bg-white border border-slate-200 rounded-xl py-3 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-medium shadow-sm ${Icon ? 'pl-12 pr-4' : 'px-4'}`}
            />
        </div>
    </div>
);

const ConfiguracoesView: React.FC = () => {
    const { user } = useAuth();
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    const coverInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [studioData, setStudioData] = useState<any>({
        studio_name: '',
        cnpj_cpf: '',
        presentation_text: '',
        monthly_revenue_goal: 0,
        address_street: '',
        address_number: '',
        address_neighborhood: '',
        address_city: '',
        address_state: '',
        address_zip: '',
        phone_whatsapp: '',
        instagram_handle: '',
        facebook_url: '',
        website_url: '',
        cover_url: null,
        profile_url: null,
        business_hours: {} 
    });

    const [pendingFiles, setPendingFiles] = useState<{cover: File | null, logo: File | null}>({ cover: null, logo: null });
    const [previews, setPreviews] = useState({ cover: '', logo: '' });

    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const fetchData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('studio_settings')
                .select('*')
                .eq('studio_id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setStudioData(data);
                setPreviews({ 
                    cover: data.cover_url || '', 
                    logo: data.profile_url || '' 
                });
            }
        } catch (e) {
            console.error("Erro ao carregar configurações:", e);
            showToast("Erro ao carregar configurações", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        if (user?.id) fetchData(); 
    }, [user?.id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setStudioData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleHourChange = (dayKey: string, field: 'start' | 'end' | 'break_start' | 'break_end' | 'active', value: any) => {
        const currentHours = studioData.business_hours || {};
        const dayConfig = currentHours[dayKey] || { 
            active: true, 
            start: '08:00', 
            break_start: '12:00', 
            break_end: '13:00', 
            end: '18:00' 
        };
        
        setStudioData((prev: any) => ({
            ...prev,
            business_hours: {
                ...currentHours,
                [dayKey]: { ...dayConfig, [field]: value }
            }
        }));
    };

    const uploadAsset = async (file: File, type: 'cover' | 'logo') => {
        if (!user) return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${type}_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('branding')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('branding')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleSaveStudio = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            let finalCoverUrl = studioData.cover_url;
            let finalProfileUrl = studioData.profile_url;

            if (pendingFiles.cover) finalCoverUrl = await uploadAsset(pendingFiles.cover, 'cover');
            if (pendingFiles.logo) finalProfileUrl = await uploadAsset(pendingFiles.logo, 'logo');

            // Preparação do Payload Final para UPSERT
            const payload = {
                studio_id: user.id,
                studio_name: studioData.studio_name || '',
                cnpj_cpf: studioData.cnpj_cpf || '',
                presentation_text: studioData.presentation_text || '',
                
                // FINANCEIRO
                monthly_revenue_goal: parseFloat(studioData.monthly_revenue_goal) || 0,

                // IMAGENS
                cover_url: finalCoverUrl,
                profile_url: finalProfileUrl,

                // ENDEREÇO
                address_street: studioData.address_street || '',
                address_number: studioData.address_number || '',
                address_neighborhood: studioData.address_neighborhood || '',
                address_city: studioData.address_city || '',
                address_state: studioData.address_state || '',
                address_zip: studioData.address_zip || '',
                address: {
                    street: studioData.address_street,
                    number: studioData.address_number,
                    zip: studioData.address_zip,
                    city: studioData.address_city,
                    neighborhood: studioData.address_neighborhood
                },

                // REDES SOCIAIS (Mapeamento Robusto conforme solicitado)
                phone_whatsapp: studioData.phone_whatsapp || '',
                whatsapp: studioData.phone_whatsapp || '', 
                instagram: studioData.instagram_handle || '', 
                instagram_handle: studioData.instagram_handle || '',
                
                // Persistência robusta para Facebook e Website
                facebook_url: studioData.facebook_url || '',
                website_url: studioData.website_url || '',
                facebook: studioData.facebook_url || '', // Fallback legado
                website: studioData.website_url || '', // Fallback legado

                social_links: {
                    instagram: studioData.instagram_handle || '',
                    facebook: studioData.facebook_url || '',
                    website: studioData.website_url || ''
                },

                // HORÁRIOS
                business_hours: studioData.business_hours || {},
                
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('studio_settings')
                .upsert(payload, { onConflict: 'studio_id' });

            if (error) throw error;

            showToast("Configurações atualizadas com sucesso!");
            setPendingFiles({ cover: null, logo: null });
            fetchData();
        } catch (e: any) {
            console.error("Erro ao salvar:", e);
            showToast(e.message || "Erro de validação no banco", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'logo') => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setPendingFiles(prev => ({ ...prev, [type]: file }));
        setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
    };

    if (isLoading) return <div className="h-full flex flex-col items-center justify-center text-slate-400 font-sans uppercase font-black tracking-widest text-[10px]"><Loader2 className="animate-spin text-orange-500 mb-2" size={32} /> Carregando Painel...</div>;

    return (
        <div className="h-full bg-slate-50 flex flex-col font-sans relative text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0 z-20">
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <Settings size={24} />
                    </div>
                    Configurações do Negócio
                </h1>
                <p className="text-slate-400 text-sm font-medium mt-1 ml-12">Configure a identidade e as metas do seu estúdio.</p>
            </header>

            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-32">
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* CARD 1: IDENTIDADE & APRESENTAÇÃO */}
                    <Card className="p-0 overflow-hidden border-slate-200 shadow-sm rounded-2xl">
                        <div className="relative h-48 bg-slate-100">
                            {previews.cover ? (
                                <img src={previews.cover} className="w-full h-full object-cover" alt="Banner" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                    <ImageIcon size={48} />
                                    <span className="text-[10px] font-black uppercase mt-2">Sem Banner de Fundo</span>
                                </div>
                            )}
                            <button 
                                onClick={() => coverInputRef.current?.click()}
                                className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 backdrop-blur shadow-xl rounded-xl text-xs font-black text-slate-700 hover:bg-white transition-all flex items-center gap-2 border border-slate-200"
                            >
                                <Camera size={14} /> Alterar Capa
                            </button>
                            <input type="file" ref={coverInputRef} className="hidden" onChange={e => handleFileChange(e, 'cover')} accept="image/*" />

                            <div className="absolute -bottom-12 left-8">
                                <div className="relative group">
                                    <div className="w-28 h-28 rounded-full bg-white border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center">
                                        {previews.logo ? (
                                            <img src={previews.logo} className="w-full h-full object-cover" alt="Logo" />
                                        ) : (
                                            <Store size={40} className="text-slate-200" />
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => logoInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-black uppercase"
                                    >
                                        <Camera size={20} />
                                    </button>
                                    <input type="file" ref={logoInputRef} className="hidden" onChange={e => handleFileChange(e, 'logo')} accept="image/*" />
                                </div>
                            </div>
                        </div>

                        <div className="px-8 pt-20 pb-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField 
                                    label="Nome do Estúdio" 
                                    name="studio_name"
                                    value={studioData.studio_name}
                                    onChange={handleInputChange}
                                    placeholder="Ex: Bela Studio Prime"
                                    icon={Store}
                                />
                                <InputField 
                                    label="CNPJ ou CPF" 
                                    name="cnpj_cpf"
                                    value={studioData.cnpj_cpf}
                                    onChange={handleInputChange}
                                    placeholder="00.000.000/0001-00"
                                    icon={CreditCard}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição / Apresentação</label>
                                <textarea 
                                    name="presentation_text"
                                    value={studioData.presentation_text}
                                    onChange={handleInputChange}
                                    className="w-full bg-white border border-slate-200 rounded-xl p-4 min-h-[120px] outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-medium text-slate-600 resize-none shadow-sm"
                                    placeholder="Conte um pouco sobre sua história e especialidades para seus clientes..."
                                />
                            </div>
                        </div>
                    </Card>

                    {/* NOVO CARD: GESTÃO FINANCEIRA */}
                    <Card title="Gestão & Metas" icon={<TrendingUp size={20} className="text-orange-500" />} className="rounded-2xl shadow-sm border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                            <InputField 
                                label="Meta de Faturamento Mensal (R$)" 
                                name="monthly_revenue_goal"
                                type="number"
                                value={studioData.monthly_revenue_goal}
                                onChange={handleInputChange}
                                placeholder="Ex: 10000"
                                icon={DollarSign}
                            />
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                                <AlertCircle size={18} className="text-orange-500 mt-0.5" />
                                <p className="text-[10px] text-orange-800 font-bold leading-relaxed">
                                    Essa meta será usada no Dashboard para calcular seu progresso mensal em tempo real.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* CARD 2: CONTATO & REDES SOCIAIS */}
                    <Card title="Contato & Redes Sociais" icon={<Globe size={20} className="text-orange-500" />} className="rounded-2xl shadow-sm border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                            <InputField 
                                label="WhatsApp Comercial" 
                                name="phone_whatsapp"
                                value={studioData.phone_whatsapp}
                                onChange={handleInputChange}
                                placeholder="(00) 00000-0000"
                                icon={Phone}
                            />
                            <InputField 
                                label="Instagram" 
                                name="instagram_handle"
                                value={studioData.instagram_handle}
                                onChange={handleInputChange}
                                placeholder="@usuario"
                                icon={Instagram}
                            />
                            <InputField 
                                label="Facebook" 
                                name="facebook_url"
                                value={studioData.facebook_url}
                                onChange={handleInputChange}
                                placeholder="facebook.com/meustudio"
                                icon={Facebook}
                            />
                            <InputField 
                                label="Site Próprio" 
                                name="website_url"
                                value={studioData.website_url}
                                onChange={handleInputChange}
                                placeholder="www.meustudio.com.br"
                                icon={Layout}
                            />
                        </div>
                    </Card>

                    {/* CARD 3: ENDEREÇO & LOCALIZAÇÃO */}
                    <Card title="Endereço & Localização" icon={<MapPin size={20} className="text-orange-500" />} className="rounded-2xl shadow-sm border-slate-200">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-6 mt-2">
                            <div className="md:col-span-2">
                                <InputField label="CEP" name="address_zip" value={studioData.address_zip} onChange={handleInputChange} placeholder="00000-000" icon={Hash} />
                            </div>
                            <div className="md:col-span-3">
                                <InputField label="Logradouro" name="address_street" value={studioData.address_street} onChange={handleInputChange} placeholder="Ex: Av. Paulista" icon={Navigation} />
                            </div>
                            <div className="md:col-span-1">
                                <InputField label="Nº" name="address_number" value={studioData.address_number} onChange={handleInputChange} placeholder="123" />
                            </div>
                            <div className="md:col-span-2">
                                <InputField label="Bairro" name="address_neighborhood" value={studioData.address_neighborhood} onChange={handleInputChange} placeholder="Centro" icon={Map} />
                            </div>
                            <div className="md:col-span-2">
                                <InputField label="Cidade" name="address_city" value={studioData.address_city} onChange={handleInputChange} placeholder="São Paulo" />
                            </div>
                            <div className="md:col-span-2">
                                <InputField label="Estado (UF)" name="address_state" value={studioData.address_state} onChange={handleInputChange} placeholder="SP" />
                            </div>
                        </div>
                    </Card>

                    {/* CARD 4: HORÁRIOS DE ATENDIMENTO */}
                    <Card title="Horários de Atendimento" icon={<Clock size={20} className="text-orange-500" />} className="rounded-2xl shadow-sm border-slate-200">
                        <p className="text-xs text-slate-500 mb-6 -mt-2 ml-1">Defina os horários de funcionamento e intervalos de almoço por dia da semana.</p>
                        <div className="space-y-4 mt-4">
                            {DAYS_OF_WEEK.map((day) => {
                                const config = (studioData.business_hours && studioData.business_hours[day.key]) || { 
                                    active: false, 
                                    start: '08:00', 
                                    break_start: '12:00', 
                                    break_end: '13:00', 
                                    end: '18:00' 
                                };

                                const isBreakInvalid = config.active && config.break_end <= config.break_start;

                                return (
                                    <div key={day.key} className={`flex flex-col xl:flex-row items-center justify-between p-5 rounded-2xl border transition-all ${config.active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                        <div className="flex items-center gap-4 w-full xl:w-1/4 mb-4 xl:mb-0">
                                            <ToggleSwitch on={!!config.active} onClick={() => handleHourChange(day.key, 'active', !config.active)} />
                                            <span className="font-black text-slate-700 text-sm w-32">{day.label}</span>
                                        </div>
                                        
                                        {config.active ? (
                                            <div className="flex flex-col md:flex-row items-center gap-4 xl:gap-6 w-full xl:w-3/4 justify-end flex-wrap">
                                                
                                                <div className="flex items-center gap-2 group flex-wrap md:flex-nowrap">
                                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2.5 rounded-xl border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all min-w-[125px]">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Início</span>
                                                        <input 
                                                            type="time" 
                                                            value={config.start || '08:00'} 
                                                            onChange={e => handleHourChange(day.key, 'start', e.target.value)} 
                                                            className="bg-transparent border-none p-0 text-sm font-black text-slate-700 outline-none focus:ring-0 flex-1" 
                                                        />
                                                    </div>
                                                    <span className="text-slate-300 font-bold text-xs">até</span>
                                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2.5 rounded-xl border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all min-w-[125px]">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-right">Almoço</span>
                                                        <input 
                                                            type="time" 
                                                            value={config.break_start || '12:00'} 
                                                            onChange={e => handleHourChange(day.key, 'break_start', e.target.value)} 
                                                            className="bg-transparent border-none p-0 text-sm font-black text-slate-700 outline-none focus:ring-0 flex-1" 
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-center p-2.5 bg-orange-50 text-orange-500 rounded-full" title="Intervalo de Almoço">
                                                    <Coffee size={16} strokeWidth={3} />
                                                </div>

                                                <div className="flex items-center gap-2 group flex-wrap md:flex-nowrap">
                                                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all min-w-[125px] ${isBreakInvalid ? 'bg-rose-50 border-rose-200' : 'bg-slate-100 border-transparent focus-within:border-orange-200 focus-within:bg-white'}`}>
                                                        <span className={`text-[9px] font-black uppercase tracking-tighter ${isBreakInvalid ? 'text-rose-400' : 'text-slate-400'}`}>Volta</span>
                                                        <input 
                                                            type="time" 
                                                            value={config.break_end || '13:00'} 
                                                            onChange={e => handleHourChange(day.key, 'break_end', e.target.value)} 
                                                            className={`bg-transparent border-none p-0 text-sm font-black outline-none focus:ring-0 flex-1 ${isBreakInvalid ? 'text-rose-600' : 'text-slate-700'}`} 
                                                        />
                                                        {isBreakInvalid && <AlertCircle size={14} className="text-rose-500 animate-pulse" />}
                                                    </div>
                                                    <span className="text-slate-300 font-bold text-xs">até</span>
                                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-2.5 rounded-xl border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all min-w-[125px]">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-right">Saída</span>
                                                        <input 
                                                            type="time" 
                                                            value={config.end || '18:00'} 
                                                            onChange={e => handleHourChange(day.key, 'end', e.target.value)} 
                                                            className="bg-transparent border-none p-0 text-sm font-black text-slate-700 outline-none focus:ring-0 flex-1" 
                                                        />
                                                    </div>
                                                </div>

                                            </div>
                                        ) : (
                                            <div className="flex-1 text-right">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-200/40 px-4 py-2 rounded-xl">Estúdio Fechado</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </main>

            <footer className="fixed bottom-0 right-0 left-0 md:left-64 bg-white/80 backdrop-blur-md border-t border-slate-200 p-6 z-40 flex justify-end">
                <div className="max-w-4xl w-full mx-auto flex justify-end">
                    <button 
                        onClick={handleSaveStudio}
                        disabled={isSaving || !user}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-orange-100 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        {isSaving ? 'Gravando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default ConfiguracoesView;
