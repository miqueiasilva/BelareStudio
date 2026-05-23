
import React, { useState, useEffect, useRef } from 'react';
import { 
    Store, Save, Loader2, MapPin, Phone, Instagram, 
    Camera, ArrowLeft, Clock, Coffee, Building2, Hash, Mail, Globe, 
    Image as ImageIcon, RefreshCw, Sparkles
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
    open: false, 
    start: '09:00', 
    end: '18:00', 
    break: { active: false, start: '12:00', end: '13:00' } 
};

const BusinessSettings = ({ onBack }: { onBack: () => void }) => {
    const { activeStudioId, refreshStudios, setActiveStudioId } = useStudio();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState<'cover' | 'logo' | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [showSqlInstructions, setShowSqlInstructions] = useState(false);
    const [copied, setCopied] = useState(false);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<any>({
        id: null,
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
        whatsapp_reminder_number: '',
        whatsapp_reminder_template: 'Olá, {cliente}! Confirmamos seu agendamento de {servico} com {profissional} no dia {data} às {horario}. Para confirmar ou reagendar seu horário, use o link: {link_confirmacao}',
        business_hours: {} 
    });

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
        if (!activeStudioId) return;
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('business_settings').select('*').eq('id', activeStudioId).maybeSingle();
                if (data) setFormData({ 
                    ...data, 
                    business_hours: sanitizeBusinessHours(data.business_hours),
                    whatsapp_reminder_number: data.whatsapp_reminder_number || '',
                    whatsapp_reminder_template: data.whatsapp_reminder_template || 'Olá, {cliente}! Confirmamos seu agendamento de {servico} com {profissional} no dia {data} às {horario}. Para confirmar ou reagendar seu horário, use o link: {link_confirmacao}'
                });
                else setFormData(p => ({ 
                    ...p, 
                    whatsapp_reminder_number: '', 
                    whatsapp_reminder_template: 'Olá, {cliente}! Confirmamos seu agendamento de {servico} com {profissional} no dia {data} às {horario}. Para confirmar ou reagendar seu horário, use o link: {link_confirmacao}',
                    business_hours: sanitizeBusinessHours({}) 
                }));
            } catch (err) {
                setToast({ message: "Erro ao carregar dados.", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
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
        setIsSaving(true);
        try {
            let studioId = activeStudioId;

            // Se não houver estúdio ativo, tentamos buscar ou criar um para o usuário
            if (!studioId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Usuário não autenticado.");

                // 1. Tentar buscar estúdio existente (caso o contexto ainda não tenha carregado)
                const { data: memberships } = await supabase
                    .from('user_studios')
                    .select('studio_id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (memberships?.studio_id) {
                    studioId = memberships.studio_id;
                } else {
                    // 2. Criar novo estúdio se não existir nenhum
                    const { data: newStudio, error: studioError } = await supabase
                        .from('studios')
                        .insert({ name: formData.business_name || 'Meu Estúdio' })
                        .select()
                        .single();

                    if (studioError) throw studioError;
                    studioId = newStudio.id;

                    // 3. Vincular usuário ao novo estúdio como dono
                    const { error: memberError } = await supabase
                        .from('user_studios')
                        .insert({
                            user_id: user.id,
                            studio_id: studioId,
                            role: 'owner'
                        });

                    if (memberError) throw memberError;
                }

                // Atualizar contexto
                await refreshStudios(true);
                setActiveStudioId(studioId);
            }

            // Agora salvamos as configurações do negócio
            const payload = { 
                ...formData, 
                id: studioId, // Mantemos id para compatibilidade se for PK
                studio_id: studioId, // Adicionamos explicitamente para evitar o erro de constraint
                updated_at: new Date() 
            };

            const { error } = await supabase
                .from('business_settings')
                .upsert(payload, { onConflict: 'studio_id' });

            if (error) {
                const errorMessage = error.message || '';
                const isColumnMissingError = 
                    errorMessage.includes('whatsapp_reminder_number') || 
                    errorMessage.includes('whatsapp_reminder_template') ||
                    errorMessage.includes('column') ||
                    errorMessage.includes('schema cache') ||
                    error.hint?.includes('column');

                if (isColumnMissingError) {
                    console.log("[Fallback] Colunas de WhatsApp ausentes no banco. Salvando dados básicos...");
                    // Extraimos as colunas que estão ausentes no schema para salvar o restante dos dados do perfil
                    const { whatsapp_reminder_number, whatsapp_reminder_template, ...cleanPayload } = payload;
                    
                    const { error: retryError } = await supabase
                        .from('business_settings')
                        .upsert(cleanPayload, { onConflict: 'studio_id' });

                    if (retryError) throw retryError;

                    setToast({ message: "Dados do perfil salvos! Ative os lembretes a seguir.", type: 'warning' });
                    setShowSqlInstructions(true);
                    return; // Retorna para que o modal com as instruções se mantenha aberto
                } else {
                    throw error;
                }
            }

            setToast({ message: "Perfil atualizado!", type: 'success' });
            setTimeout(onBack, 1000);
        } catch (err: any) {
            console.error("Erro ao salvar perfil:", err);
            setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
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
            <div className="flex items-center gap-4 mb-8"><button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-600 transition-all shadow-sm"><ArrowLeft size={20} /></button><div><h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Perfil do Negócio</h1><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Configurações de marca e atendimento</p></div></div>
            <div className="mb-16"><div className="relative group"><div onClick={() => !isUploading && coverInputRef.current?.click()} className={`h-48 md:h-64 w-full rounded-[40px] overflow-hidden bg-slate-200 shadow-inner border border-slate-100 cursor-pointer relative ${isUploading === 'cover' ? 'opacity-70' : ''}`}>{formData.cover_url ? (<img src={formData.cover_url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="Capa" />) : (<div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2"><ImageIcon size={40} className="opacity-20" /><span className="text-[10px] font-black uppercase tracking-widest">Clique para enviar Capa</span></div>)}<div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"><button className="bg-white/90 backdrop-blur px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl"><Camera size={18} /> {isUploading === 'cover' ? 'Enviando...' : 'Alterar Capa'}</button></div>{isUploading === 'cover' && (<div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]"><RefreshCw className="animate-spin text-orange-500" size={32} /></div>)}</div><div className="absolute -bottom-10 left-1/2 -translate-x-1/2 md:left-10 md:translate-x-0"><div onClick={() => !isUploading && logoInputRef.current?.click()} className={`relative group/logo cursor-pointer ${isUploading === 'logo' ? 'opacity-70' : ''}`}><div className="w-32 h-32 rounded-full ring-8 ring-white shadow-2xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center relative">{formData.logo_url ? (<img src={formData.logo_url} className="w-full h-full object-cover" alt="Logo" />) : (<div className="w-full h-full flex flex-col items-center justify-center bg-orange-100 text-orange-500"><Store size={40} /><span className="text-[8px] font-black uppercase mt-1 text-center px-2">Upload Logo</span></div>)}{isUploading === 'logo' && (<div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]"><RefreshCw className="animate-spin text-orange-500" size={24} /></div>)}</div><div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity pointer-events-none"><Camera className="text-white" size={24} /></div></div></div></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16"><Card title="Informações Gerais" icon={<Building2 size={18} />}><div className="space-y-5"><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Estúdio</label><input value={formData.business_name} onChange={e => setFormData({...formData, business_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 transition-all shadow-sm" placeholder="Nome fantasia" /></div><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ / CPF</label><div className="relative"><Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input value={formData.cnpj_cpf} onChange={e => setFormData({...formData, cnpj_cpf: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" placeholder="00.000.000/0000-00" /></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp (Fixo)</label><div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" placeholder="(00) 00000-0000" /></div></div><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Adm.</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" placeholder="contato@empresa.com" /></div></div></div></div></Card><Card title="Endereço da Unidade" icon={<MapPin size={18} />}><div className="grid grid-cols-3 gap-4"><div className="col-span-1 space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CEP</label><input value={formData.zip_code} onChange={e => setFormData({...formData, zip_code: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" /></div><div className="col-span-2 space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade e UF</label><input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" /></div><div className="col-span-2 space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rua / Avenida</label><input value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" /></div><div className="col-span-1 space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</label><input value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" /></div><div className="col-span-3 space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label><input value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none" /></div></div></Card><div className="md:col-span-2"><Card title="Configurações de Comunicação IA" icon={<Sparkles size={18} className="text-orange-500 animate-pulse" />}><div className="space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp Padrão de Disparos</label><div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input value={formData.whatsapp_reminder_number || ''} onChange={e => setFormData({...formData, whatsapp_reminder_number: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 transition-all shadow-sm" placeholder="(00) 00000-0000" /></div><p className="text-[9px] text-slate-400 font-medium ml-1">Número utilizado para configurar o remetente oficial de notificações e mensagens de lembretes automáticos.</p></div><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Canal de Envio Inteligente</label><div className="p-3.5 bg-orange-50/40 border border-orange-100 rounded-2xl flex items-center gap-3"><Sparkles size={16} className="text-orange-500 shrink-0 animate-bounce" /><p className="text-[11px] text-slate-600 font-bold">Assistente Virtual Jaci IA Integrada</p></div></div></div><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensagem de Lembrete Customizável (WhatsApp)</label><textarea value={formData.whatsapp_reminder_template || ''} onChange={e => setFormData({...formData, whatsapp_reminder_template: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-5 min-h-[100px] outline-none focus:ring-4 focus:ring-orange-50 font-medium text-slate-600 resize-none font-mono text-xs" placeholder="Olá, {cliente}! Confirmamos seu agendamento de {servico}..." /><div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Variáveis Dinâmicas Ativas</p><div className="flex flex-wrap gap-2"><span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 font-bold hover:border-orange-200 select-none cursor-help" title="Nome do cliente">{"{cliente}"}</span><span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 font-bold hover:border-orange-200 select-none cursor-help" title="Nome do serviço">{"{servico}"}</span><span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 font-bold hover:border-orange-200 select-none cursor-help" title="Profissional">{"{profissional}"}</span><span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 font-bold hover:border-orange-200 select-none cursor-help" title="Data do agendamento">{"{data}"}</span><span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 font-bold hover:border-orange-200 select-none cursor-help" title="Horário">{"{horario}"}</span><span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 font-bold hover:border-orange-200 select-none cursor-help" title="Link de confirmação/reagendamento">{"{link_confirmacao}"}</span></div></div></div></div></Card></div><div className="md:col-span-2"><Card title="Apresentação do Estúdio" icon={<Globe size={18} />}><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Texto de Boas-vindas (Agenda Online)</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 min-h-[120px] outline-none focus:ring-4 focus:ring-orange-50 font-medium text-slate-600 resize-none" placeholder="Conte um pouco sobre a histria e especialidades do seu estúdio..." /></div></Card></div><div className="md:col-span-2"><Card title="Horários de Atendimento" icon={<Clock size={18} />}><div className="grid grid-cols-1 gap-3">{DAYS_ORDER.map(({ key, label }) => { const config = formData.business_hours[key] || DEFAULT_DAY; return (<div key={key} className={`flex flex-col xl:flex-row items-center justify-between p-5 rounded-3xl border transition-all ${config.open ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}><div className="flex items-center gap-4 w-full xl:w-1/4 mb-4 xl:mb-0"><ToggleSwitch on={config.open} onClick={() => updateDay(key, 'open', !config.open)} /><span className="font-black text-slate-700 text-sm w-32 uppercase tracking-tighter">{label}</span></div>{config.open ? (<div className="flex flex-col md:flex-row items-center gap-4 xl:gap-8 w-full xl:w-3/4 justify-end"><div className="flex items-center gap-2"><div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all"><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Início</span><input type="time" value={config.start} onChange={e => updateDay(key, 'start', e.target.value)} className="bg-transparent border-none p-0 text-sm font-black text-slate-700 outline-none focus:ring-0" /></div><span className="text-slate-300 font-bold text-xs">até</span><div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all"><span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Fim</span><input type="time" value={config.end} onChange={e => updateDay(key, 'end', e.target.value)} className="bg-transparent border-none p-0 text-sm font-black text-slate-700 outline-none focus:ring-0" /></div></div><div className="flex items-center gap-4 border-l-2 border-slate-100 pl-8"><div className="flex items-center gap-2"><input type="checkbox" checked={config.break?.active ?? false} onChange={e => updateBreak(key, 'active', e.target.checked)} className="w-5 h-5 rounded text-orange-500 border-slate-300 focus:ring-orange-500" /><Coffee size={16} className={config.break?.active ? "text-orange-500" : "text-slate-300"} /></div>{config.break?.active && (<div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2"><div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-xl border border-orange-100"><input type="time" value={config.break.start} onChange={e => updateBreak(key, 'start', e.target.value)} className="bg-transparent border-none p-0 text-xs font-black text-orange-600 outline-none focus:ring-0" /><span className="text-[10px] font-bold text-orange-300">às</span><input type="time" value={config.break.end} onChange={e => updateBreak(key, 'end', e.target.value)} className="bg-transparent border-none p-0 text-xs font-black text-orange-600 outline-none focus:ring-0" /></div></div>)}</div></div>) : (<div className="flex-1 text-right"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-xl">Fechado</span></div>)}</div>); })}</div></Card></div></div>
            <div className="sticky bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent flex justify-center pointer-events-none z-50 mt-8"><button onClick={handleSave} disabled={isSaving} className="pointer-events-auto min-w-[240px] px-12 py-5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-[24px] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}{isSaving ? 'Sincronizando...' : 'Salvar Perfil do Estúdio'}</button></div>

            {showSqlInstructions && (
                <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] max-w-2xl w-full p-8 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                                    <Sparkles size={24} className="animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Habilitar Recurso Jaci IA</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Perfil salvo, mas requer ação de Banco de Dados</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 text-slate-600 text-sm">
                            <p className="font-medium">
                                Seus dados de perfil, horários e endereço foram <strong className="text-emerald-600 font-black">salvos e sincronizados com sucesso</strong>!
                            </p>
                            <p className="text-xs leading-relaxed text-slate-500">
                                Porém, as novas colunas para o Assistente Jaci IA de lembretes automáticos via WhatsApp não existem no seu banco Supabase. Execute o script abaixo no seu painel para ativar o recurso:
                            </p>

                            <div className="relative mt-4">
                                <div className="absolute top-3 right-3 z-10">
                                    <button
                                        onClick={() => {
                                            const sql = `-- 1. Cria as colunas de lembrete no perfil do estúdio\nALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_reminder_number TEXT DEFAULT '';\nALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_reminder_template TEXT DEFAULT 'Olá, {cliente}! Confirmamos seu agendamento de {servico} com {profissional} no dia {data} às {horario}. Para confirmar ou reagendar seu horário, use o link: {link_confirmacao}';\n\n-- 2. Cria a tabela de logs de lembretes enviados se não existir\nCREATE TABLE IF NOT EXISTS public.whatsapp_reminders_log (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    studio_id UUID,\n    appointment_id UUID,\n    client_name TEXT,\n    phone TEXT,\n    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),\n    sender TEXT DEFAULT 'Jaci IA'\n);\n\n-- 3. Habilita RLS para segurança dos dados\nALTER TABLE public.whatsapp_reminders_log ENABLE ROW LEVEL SECURITY;\n\n-- 4. Cria política de acesso amplo\nDROP POLICY IF EXISTS "Allow all on whatsapp_reminders_log" ON public.whatsapp_reminders_log;\nCREATE POLICY "Allow all on whatsapp_reminders_log" ON public.whatsapp_reminders_log FOR ALL USING (true) WITH CHECK (true);`;
                                            navigator.clipboard.writeText(sql);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        className="bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] uppercase tracking-widest px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                                    >
                                        {copied ? 'Copiado! ✓' : 'Copiar Script SQL'}
                                    </button>
                                </div>
                                <pre className="bg-slate-900 text-slate-200 p-5 rounded-2xl text-[10px] font-mono leading-relaxed overflow-y-auto max-h-[180px] text-left pt-12">
{`-- 1. Cria as colunas no perfil do estúdio
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_reminder_number TEXT DEFAULT '';
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_reminder_template TEXT DEFAULT 'Olá, {cliente}! Confirmamos seu agendamento de {servico} com {profissional} no dia {data} às {horario}. Para confirmar ou reagendar seu horário, use o link: {link_confirmacao}';

-- 2. Cria a tabela de logs de lembretes enviados se não existir
CREATE TABLE IF NOT EXISTS public.whatsapp_reminders_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID,
    appointment_id UUID,
    client_name TEXT,
    phone TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sender TEXT DEFAULT 'Jaci IA'
);

-- 3. Habilita RLS para segurança dos dados
ALTER TABLE public.whatsapp_reminders_log ENABLE ROW LEVEL SECURITY;

-- 4. Cria política de acesso amplo
DROP POLICY IF EXISTS "Allow all on whatsapp_reminders_log" ON public.whatsapp_reminders_log;
CREATE POLICY "Allow all on whatsapp_reminders_log" ON public.whatsapp_reminders_log FOR ALL USING (true) WITH CHECK (true);`}
                                </pre>
                            </div>

                            <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 mt-4 text-xs text-orange-800 font-bold space-y-1">
                                <p className="uppercase text-[9px] tracking-widest text-orange-600 block mb-1">Como colocar no Supabase:</p>
                                <p>1. Acesse o console do seu projeto <strong className="text-orange-600">Supabase</strong>.</p>
                                <p>2. Clique em <strong className="text-orange-600">SQL Editor</strong> no menu lateral.</p>
                                <p>3. Clique em <strong className="text-orange-600">New Query</strong>, cole o código acima e clique em <strong className="text-orange-600">Run</strong>.</p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowSqlInstructions(false); onBack(); }}
                                className="px-6 py-3 bg-slate-900 hover:bg-black text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95"
                            >
                                Sair e Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessSettings;
