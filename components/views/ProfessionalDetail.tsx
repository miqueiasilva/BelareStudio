
import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronLeft, User, Save, Trash2, Camera, Scissors, 
    Loader2, Shield, Clock, DollarSign, CheckCircle, AlertCircle, Coffee,
    Phone, Mail, Smartphone, CreditCard, LayoutDashboard, Calendar,
    Settings2, Hash, Armchair
} from 'lucide-react';
import { LegacyProfessional, LegacyService, Service } from '../../types';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';

interface ProfessionalDetailProps {
    professional: LegacyProfessional;
    onBack: () => void;
    onSave: () => void;
}

const DAYS_ORDER = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const EditField = ({ label, name, value, onChange, type = "text", placeholder, span = "col-span-1", icon: Icon, disabled, min }: any) => (
    <div className={`space-y-1.5 ${span}`}>
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">{label}</label>
        <div className="relative group">
            {Icon && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors">
                    <Icon size={16} />
                </div>
            )}
            <input 
                type={type}
                name={name}
                value={value !== undefined && value !== null ? value : ''}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
                min={min}
                className={`w-full bg-white border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all shadow-sm ${Icon ? 'pl-11 pr-4' : 'px-4'} disabled:opacity-60 disabled:bg-slate-50`}
            />
        </div>
    </div>
);

const ProfessionalDetail: React.FC<ProfessionalDetailProps> = ({ professional: initialProf, onBack, onSave }) => {
    // --- State ---
    const [prof, setProf] = useState<any>(null);
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allRooms, setAllRooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'perfil' | 'servicos' | 'horarios' | 'comissoes' | 'permissoes'>('perfil');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Initialization ---
    useEffect(() => {
        const init = async () => {
            // Fetch Services
            const { data: svcs } = await supabase.from('services').select('*').order('nome');
            if (svcs) setAllServices(svcs as any);

            // Fetch Rooms (Resources)
            const { data: rooms } = await supabase.from('resources').select('id, name').eq('active', true).order('name');
            if (rooms) setAllRooms(rooms);

            const normalized = {
                ...initialProf,
                cpf: (initialProf as any).cpf || '',
                pix_key: (initialProf as any).pix_key || '',
                bio: (initialProf as any).bio || '',
                email: (initialProf as any).email || '',
                phone: (initialProf as any).phone || '',
                birth_date: (initialProf as any).birth_date || '',
                order_index: (initialProf as any).order_index ?? 0,
                commission_rate: (initialProf as any).commission_rate ?? 30,
                permissions: (initialProf as any).permissions || { view_calendar: true, edit_calendar: true },
                services_enabled: (initialProf as any).services_enabled || [],
                work_schedule: (initialProf as any).work_schedule || {},
                photo_url: (initialProf as any).photo_url || initialProf.avatarUrl || null,
                online_booking_enabled: (initialProf as any).online_booking_enabled ?? (initialProf as any).online_booking ?? true,
                show_in_calendar: (initialProf as any).show_in_calendar ?? true, 
                active: (initialProf as any).active ?? true,
                resource_id: (initialProf as any).resource_id || ''
            };
            setProf(normalized);
        };
        init();
    }, [initialProf]);

    // --- Lógica de Upload ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !prof?.id) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `prof_${prof.id}_${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from('team_members')
                .update({ photo_url: publicUrl })
                .eq('id', prof.id);

            if (dbError) throw dbError;

            setProf(prev => ({ ...prev, photo_url: publicUrl }));
            alert("Foto de perfil atualizada!");
        } catch (error: any) {
            console.error("[UPLOAD_ERROR]", error);
            alert(`Falha no upload: ${error.message}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- Lógica de Salvamento ---
    const handleSave = async () => {
        if (!prof) return;
        setIsLoading(true);
        
        try {
            const payload = {
                name: prof.name || 'Sem nome',
                role: prof.role || 'Profissional',
                phone: prof.phone || null,
                email: prof.email || null,
                cpf: prof.cpf || null,
                pix_key: prof.pix_key || null,
                bio: prof.bio || null,
                active: !!prof.active,
                birth_date: prof.birth_date === "" ? null : prof.birth_date,
                order_index: parseInt(String(prof.order_index)) || 0,
                commission_rate: isNaN(parseFloat(String(prof.commission_rate))) ? 0 : parseFloat(String(prof.commission_rate)),
                permissions: prof.permissions,
                services_enabled: prof.services_enabled,
                work_schedule: prof.work_schedule,
                photo_url: prof.photo_url,
                online_booking_enabled: !!prof.online_booking_enabled, 
                show_in_calendar: !!prof.show_in_calendar,
                resource_id: prof.resource_id ? prof.resource_id : null
            };

            const { error } = await supabase
                .from('team_members')
                .update(payload)
                .eq('id', prof.id);

            if (error) throw error;

            alert("Dados salvos com sucesso! ✅");
            onSave();
        } catch (error: any) {
            console.error("[SAVE_ERROR]", error);
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!prof) return;
        if (!window.confirm("Excluir este colaborador permanentemente?")) return;
        
        setIsLoading(true);
        try {
            const { error } = await supabase.from('team_members').delete().eq('id', prof.id);
            if (error) throw error;
            onBack();
        } catch (error: any) {
            alert(`Erro: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleService = (id: number) => {
        const current = prof.services_enabled || [];
        const next = current.includes(id) ? current.filter((sId: number) => sId !== id) : [...current, id];
        setProf({ ...prof, services_enabled: next });
    };

    const updateSchedule = (day: string, field: string, value: any) => {
        const current = prof.work_schedule[day] || { active: false, start: '09:00', end: '18:00' };
        setProf({
            ...prof,
            work_schedule: { ...prof.work_schedule, [day]: { ...current, [field]: value } }
        });
    };

    const updatePermission = (key: string, value: boolean) => {
        setProf({ ...prof, permissions: { ...prof.permissions, [key]: value } });
    };

    const handleInputChange = (e: any) => {
        const { name, value } = e.target;
        setProf(prev => ({ ...prev, [name]: value }));
    };

    if (!prof) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-500 w-10 h-10" /></div>;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-left">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><ChevronLeft size={24} /></button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{prof.name}</h2>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{prof.role}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDelete} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={20} /></button>
                    <button onClick={handleSave} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-orange-100 flex items-center gap-2 disabled:opacity-50">
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </header>

            <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto scrollbar-hide">
                <div className="flex gap-8 max-w-5xl mx-auto">
                    {[
                        { id: 'perfil', label: 'Perfil', icon: User },
                        { id: 'servicos', label: 'Serviços', icon: Scissors },
                        { id: 'horarios', label: 'Horários', icon: Clock },
                        { id: 'comissoes', label: 'Ganhos', icon: DollarSign },
                        { id: 'permissoes', label: 'Acessos', icon: Shield }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'perfil' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
                            <div className="lg:col-span-1 space-y-6">
                                <Card>
                                    <div className="flex flex-col items-center py-6 text-center">
                                        <div 
                                            className="w-40 h-40 rounded-[32px] border-4 border-white shadow-2xl overflow-hidden bg-slate-100 mb-6 relative group cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {prof.photo_url ? (
                                                <img src={prof.photo_url} className="w-full h-full object-cover" alt="Avatar" />
                                            ) : (
                                                <User size={64} className="m-12 text-slate-300" />
                                            )}
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isUploading ? <Loader2 className="text-white animate-spin" size={20} /> : <Camera className="text-white" />}
                                                <span className="text-[10px] text-white font-black uppercase mt-2">Trocar Foto</span>
                                            </div>
                                        </div>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" />
                                        <h3 className="font-black text-slate-800 text-lg">{prof.name}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-widest">{prof.role}</p>
                                    </div>
                                </Card>

                                <Card title="Visibilidade" icon={<Settings2 size={18} className="text-orange-500" />}>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-orange-200">
                                            <div>
                                                <p className="font-black text-slate-800 text-xs">Exibir na Agenda?</p>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Se desmarcado, não terá coluna na agenda.</p>
                                            </div>
                                            <ToggleSwitch 
                                                on={!!prof.show_in_calendar} 
                                                onClick={() => setProf({...prof, show_in_calendar: !prof.show_in_calendar})} 
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-orange-200">
                                            <div>
                                                <p className="font-black text-slate-800 text-xs">Agenda Online</p>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Disponível para agendamento via link.</p>
                                            </div>
                                            <ToggleSwitch 
                                                on={!!prof.online_booking_enabled} 
                                                onClick={() => setProf({...prof, online_booking_enabled: !prof.online_booking_enabled})} 
                                            />
                                        </div>
                                    </div>
                                </Card>
                            </div>
                            
                            <div className="lg:col-span-2 space-y-6">
                                <Card title="Informações Pessoais">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <EditField label="Nome Completo" name="name" value={prof.name} onChange={handleInputChange} icon={User} span="md:col-span-2" />
                                        <EditField label="Cargo / Especialidade" name="role" value={prof.role} onChange={handleInputChange} />
                                        
                                        {/* NOVO CAMPO: Sala de Atendimento */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">Sala de Atendimento</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors">
                                                    <Armchair size={16} />
                                                </div>
                                                <select 
                                                    name="resource_id"
                                                    value={prof.resource_id}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-11 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all shadow-sm appearance-none"
                                                >
                                                    <option value="">Selecione uma sala...</option>
                                                    {allRooms.map(room => (
                                                        <option key={room.id} value={room.id}>{room.name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        <EditField label="Ordem na Agenda (1, 2, 3...)" name="order_index" type="number" min="0" value={prof.order_index} onChange={handleInputChange} icon={Hash} />
                                        <EditField label="Data de Nascimento" name="birth_date" type="date" value={prof.birth_date} onChange={handleInputChange} />
                                        <EditField label="WhatsApp" name="phone" value={prof.phone} onChange={handleInputChange} icon={Phone} placeholder="(00) 00000-0000" />
                                        <EditField label="E-mail" name="email" value={prof.email} onChange={handleInputChange} icon={Mail} placeholder="email@exemplo.com" />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                                            <EditField label="CPF" name="cpf" value={prof.cpf} onChange={handleInputChange} placeholder="000.000.000-00" icon={CreditCard} />
                                            <EditField label="Chave PIX" name="pix_key" value={prof.pix_key} onChange={handleInputChange} icon={Smartphone} placeholder="CPF, E-mail, Celular ou Aleatória" />
                                        </div>
                                    </div>
                                    <div className="mt-6 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Biografia e Notas</label>
                                        <textarea value={prof.bio} name="bio" onChange={handleInputChange} className="w-full h-24 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-orange-50 outline-none resize-none font-medium text-slate-600 shadow-sm" placeholder="Experiência profissional..." />
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'servicos' && (
                        <Card title="Habilidades e Catálogo" className="animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {allServices.map(service => {
                                    const isEnabled = prof.services_enabled?.includes(service.id);
                                    return (
                                        <button key={service.id} onClick={() => toggleService(service.id)} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${isEnabled ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                                            <div className="overflow-hidden">
                                                <p className={`font-bold text-sm truncate ${isEnabled ? 'text-orange-900' : 'text-slate-700'}`}>{service.nome}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{service.duracao_min} min</p>
                                            </div>
                                            {isEnabled && <CheckCircle size={18} className="text-orange-500 flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {activeTab === 'horarios' && (
                        <Card title="Disponibilidade Semanal" className="animate-in fade-in">
                            <div className="space-y-4">
                                {DAYS_ORDER.map(day => {
                                    const config = prof.work_schedule[day.key] || { active: false, start: '09:00', end: '18:00' };
                                    return (
                                        <div key={day.key} className={`flex items-center justify-between p-5 rounded-3xl border transition-all ${config.active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                            <div className="flex items-center gap-4 w-48">
                                                <ToggleSwitch on={config.active} onClick={() => updateSchedule(day.key, 'active', !config.active)} />
                                                <span className="font-black text-slate-700 text-sm uppercase tracking-tighter">{day.label}</span>
                                            </div>
                                            {config.active && (
                                                <div className="flex items-center gap-2">
                                                    <input type="time" value={config.start} onChange={e => updateSchedule(day.key, 'start', e.target.value)} className="bg-slate-100 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 border-none outline-none focus:ring-2 focus:ring-orange-200" />
                                                    <span className="text-slate-300 font-bold text-xs">até</span>
                                                    <input type="time" value={config.end} onChange={e => updateSchedule(day.key, 'end', e.target.value)} className="bg-slate-100 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 border-none outline-none focus:ring-2 focus:ring-orange-200" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {activeTab === 'comissoes' && (
                        <Card title="Remuneração" className="animate-in fade-in max-w-2xl mx-auto">
                            <div className="p-8 bg-gradient-to-br from-orange-50 to-orange-100 rounded-[32px] border border-orange-200 text-center">
                                <label className="block text-[10px] font-black text-orange-800 uppercase tracking-widest mb-4">Taxa de Comissão Padrão (%)</label>
                                <div className="relative inline-block">
                                    <input type="number" step="0.01" value={prof.commission_rate} onChange={handleInputChange} name="commission_rate" className="w-40 border-2 border-orange-300 rounded-3xl px-6 py-5 text-5xl font-black text-orange-600 outline-none focus:border-orange-500 bg-white shadow-inner text-center" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-black text-orange-300">%</span>
                                </div>
                                <p className="text-xs text-orange-700 font-medium mt-6">Este valor será a base para o cálculo de todos os serviços realizados por este profissional no módulo de Remunerações.</p>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'permissoes' && (
                        <Card title="Acessos ao Sistema" className="animate-in fade-in max-w-2xl mx-auto">
                             <div className="space-y-4">
                                {[
                                    { key: 'view_calendar', label: 'Ver agenda de terceiros' },
                                    { key: 'edit_calendar', label: 'Gerenciar própria agenda' },
                                    { key: 'view_finance', label: 'Acesso ao Financeiro / PDV' },
                                    { key: 'edit_stock', label: 'Controle de Estoque' }
                                ].map(item => (
                                    <div key={item.key} className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-3xl transition-colors border border-transparent hover:border-slate-100">
                                        <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                                        <ToggleSwitch on={!!prof.permissions?.[item.key]} onClick={() => updatePermission(item.key, !prof.permissions?.[item.key])} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
};

const ChevronDown = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6"/>
    </svg>
);

export default ProfessionalDetail;
