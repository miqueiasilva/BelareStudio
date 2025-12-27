
import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronLeft, User, Save, Trash2, Camera, Scissors, 
    Loader2, Shield, Clock, DollarSign, CheckCircle, AlertCircle
} from 'lucide-react';
import { LegacyProfessional, LegacyService } from '../../types';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';

interface ProfessionalDetailProps {
    professional: LegacyProfessional;
    onBack: () => void;
    onSave: () => void;
}

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const ProfessionalDetail: React.FC<ProfessionalDetailProps> = ({ professional: initialProf, onBack, onSave }) => {
    // --- State ---
    const [prof, setProf] = useState<any>(null);
    const [allServices, setAllServices] = useState<LegacyService[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'perfil' | 'servicos' | 'horarios' | 'comissoes' | 'permissoes'>('perfil');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Initialization ---
    useEffect(() => {
        const init = async () => {
            // Fetch all available services for the selection tab
            const { data: svcs } = await supabase.from('services').select('*').order('nome');
            if (svcs) setAllServices(svcs as any);

            // Normalize professional data (handle missing fields and JSON structures)
            const normalized = {
                ...initialProf,
                cpf: (initialProf as any).cpf || '',
                bio: (initialProf as any).bio || '',
                email: (initialProf as any).email || '',
                phone: (initialProf as any).phone || '',
                birth_date: (initialProf as any).birth_date || '',
                commission_rate: (initialProf as any).commission_rate ?? 0,
                permissions: (initialProf as any).permissions || { view_calendar: true, edit_calendar: true },
                services_enabled: (initialProf as any).services_enabled || [],
                work_schedule: (initialProf as any).work_schedule || {},
                photo_url: (initialProf as any).photo_url || initialProf.avatarUrl || null
            };
            setProf(normalized);
        };
        init();
    }, [initialProf]);

    // --- Upload Logic ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !prof) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${prof.id}.${fileExt}`;
            const filePath = `public/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Update local state and DB immediately for photo
            setProf({ ...prof, photo_url: publicUrl });
            
            const { error: updateError } = await supabase
                .from('professionals')
                .update({ photo_url: publicUrl })
                .eq('id', prof.id);

            if (updateError) throw updateError;

            alert("Foto atualizada com sucesso!");
        } catch (error: any) {
            console.error("Upload error:", error);
            alert(`Erro no upload: ${error.message}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- Save Logic (Anti-Crash) ---
    const handleSave = async () => {
        if (!prof) return;
        setIsLoading(true);
        
        try {
            // Prepare Payload: Clean data to avoid Postgres constraints errors
            const payload = {
                name: prof.name || 'Sem nome',
                role: prof.role || 'Profissional',
                phone: prof.phone || null,
                email: prof.email || null,
                cpf: prof.cpf || null,
                bio: prof.bio || null,
                active: !!prof.active,
                // Critical: Convert empty date strings to NULL
                birth_date: prof.birth_date === "" ? null : prof.birth_date,
                // Critical: Ensure numbers are not NaN
                commission_rate: isNaN(parseFloat(prof.commission_rate)) ? 0 : parseFloat(prof.commission_rate),
                // JSON Fields
                permissions: prof.permissions,
                services_enabled: prof.services_enabled,
                work_schedule: prof.work_schedule,
                photo_url: prof.photo_url
            };

            const { error } = await supabase
                .from('professionals')
                .update(payload)
                .eq('id', prof.id);

            if (error) throw error;

            alert("Perfil salvo com sucesso! ✅");
            onSave();
        } catch (error: any) {
            console.error("Save error:", error);
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Delete Logic ---
    const handleDelete = async () => {
        if (!prof) return;
        if (!window.confirm("Tem certeza que deseja excluir este colaborador permanentemente?")) return;
        
        setIsLoading(true);
        try {
            const { error } = await supabase.from('professionals').delete().eq('id', prof.id);
            if (error) throw error;
            onBack();
        } catch (error: any) {
            alert(`Erro ao excluir: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Helper Setters ---
    const toggleService = (id: number) => {
        const current = prof.services_enabled || [];
        const next = current.includes(id) ? current.filter((sId: number) => sId !== id) : [...current, id];
        setProf({ ...prof, services_enabled: next });
    };

    const updateSchedule = (day: string, field: string, value: any) => {
        const current = prof.work_schedule[day] || { active: false, start: '09:00', end: '18:00' };
        setProf({
            ...prof,
            work_schedule: {
                ...prof.work_schedule,
                [day]: { ...current, [field]: value }
            }
        });
    };

    const updatePermission = (key: string, value: boolean) => {
        setProf({
            ...prof,
            permissions: { ...prof.permissions, [key]: value }
        });
    };

    if (!prof) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{prof.name}</h2>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{prof.role}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDelete} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors" title="Excluir">
                        <Trash2 size={20} />
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isLoading}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-orange-100 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isLoading ? 'Salvando...' : 'Salvar Dados'}
                    </button>
                </div>
            </header>

            {/* Navigation Tabs */}
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
                            className={`flex items-center gap-2 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
                                activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto">
                    
                    {/* TAB: PERFIL */}
                    {activeTab === 'perfil' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
                            <Card className="lg:col-span-1 h-fit">
                                <div className="flex flex-col items-center py-6">
                                    <div 
                                        className="w-36 h-36 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-100 mb-6 relative group cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {prof.photo_url ? (
                                            <img src={prof.photo_url} className="w-full h-full object-cover" alt="Avatar" />
                                        ) : (
                                            <User size={56} className="m-10 text-slate-300" />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {isUploading ? <Loader2 className="animate-spin text-white" /> : <Camera className="text-white" />}
                                        </div>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" />
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Clique para trocar a foto</p>
                                </div>
                            </Card>
                            
                            <div className="lg:col-span-2 space-y-6">
                                <Card title="Informações Pessoais">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
                                            <input value={prof.name} onChange={e => setProf({...prof, name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo / Especialidade</label>
                                            <input value={prof.role} onChange={e => setProf({...prof, role: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CPF</label>
                                            <input value={prof.cpf} onChange={e => setProf({...prof, cpf: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="000.000.000-00" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Nascimento</label>
                                            <input type="date" value={prof.birth_date} onChange={e => setProf({...prof, birth_date: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp</label>
                                            <input value={prof.phone} onChange={e => setProf({...prof, phone: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="(00) 00000-0000" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</label>
                                            <input type="email" value={prof.email} onChange={e => setProf({...prof, email: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="email@exemplo.com" />
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biografia / Notas</label>
                                        <textarea value={prof.bio} onChange={e => setProf({...prof, bio: e.target.value})} className="w-full h-24 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none resize-none" placeholder="Experiência profissional..." />
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* TAB: SERVICOS */}
                    {activeTab === 'servicos' && (
                        <Card title="Serviços Habilitados" className="animate-in fade-in duration-300">
                            <p className="text-sm text-slate-500 mb-6">Este profissional aparecerá na agenda apenas para os serviços marcados abaixo.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {allServices.map(service => {
                                    const isEnabled = prof.services_enabled?.includes(service.id);
                                    return (
                                        <button
                                            key={service.id}
                                            onClick={() => toggleService(service.id)}
                                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                                                isEnabled ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-slate-200 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: service.color }}></div>
                                                <div className="overflow-hidden">
                                                    <p className={`font-bold text-sm truncate ${isEnabled ? 'text-orange-900' : 'text-slate-700'}`}>{service.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{service.duration} min</p>
                                                </div>
                                            </div>
                                            {isEnabled && <CheckCircle size={18} className="text-orange-500 flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* TAB: HORARIOS */}
                    {activeTab === 'horarios' && (
                        <Card title="Grade Semanal de Horários" className="animate-in fade-in duration-300">
                            <div className="space-y-3">
                                {DAYS_OF_WEEK.map(day => {
                                    const config = prof.work_schedule[day.key] || { active: false, start: '09:00', end: '18:00' };
                                    return (
                                        <div key={day.key} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${config.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                            <div className="flex items-center gap-4">
                                                <ToggleSwitch on={config.active} onClick={() => updateSchedule(day.key, 'active', !config.active)} />
                                                <span className="font-bold text-slate-700 w-32">{day.label}</span>
                                            </div>
                                            {config.active && (
                                                <div className="flex items-center gap-3">
                                                    <input type="time" value={config.start} onChange={e => updateSchedule(day.key, 'start', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-orange-500 outline-none" />
                                                    <span className="text-slate-300 font-bold">até</span>
                                                    <input type="time" value={config.end} onChange={e => updateSchedule(day.key, 'end', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-orange-500 outline-none" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* TAB: COMISSOES */}
                    {activeTab === 'comissoes' && (
                        <Card title="Repasse e Produtividade" className="animate-in fade-in duration-300 max-w-2xl mx-auto">
                            <div className="p-8 bg-gradient-to-br from-orange-50 to-orange-100 rounded-3xl border border-orange-200 mb-6">
                                <label className="block text-xs font-black text-orange-800 uppercase mb-4 tracking-widest">Comissão Padrão (%)</label>
                                <div className="flex items-center gap-8">
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={prof.commission_rate}
                                            onChange={e => setProf({...prof, commission_rate: e.target.value})}
                                            className="w-40 border-2 border-orange-300 rounded-3xl px-6 py-5 text-5xl font-black text-orange-600 outline-none focus:border-orange-500 bg-white shadow-inner"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-black text-orange-300">%</span>
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <p className="text-lg font-bold text-orange-900">Ganhos Diretos</p>
                                        <p className="text-xs text-orange-700 font-medium">Este percentual é aplicado sobre o valor bruto de cada serviço realizado.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
                                <div>
                                    <p className="font-bold text-slate-800">Liberar Agenda Online?</p>
                                    <p className="text-xs text-slate-500">Permite que clientes agendem com este profissional pelo link público.</p>
                                </div>
                                <ToggleSwitch on={!!prof.online_booking} onClick={() => setProf({...prof, online_booking: !prof.online_booking})} />
                            </div>
                        </Card>
                    )}

                    {/* TAB: PERMISSOES */}
                    {activeTab === 'permissoes' && (
                        <Card title="Permissões de Acesso ao Sistema" className="animate-in fade-in duration-300 max-w-2xl mx-auto">
                            <div className="space-y-4">
                                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3 mb-4">
                                    <Shield size={20} className="text-indigo-600 flex-shrink-0" />
                                    <p className="text-xs text-indigo-700 leading-relaxed">As permissões abaixo definem o nível de acesso do colaborador. Administradores têm acesso total por padrão.</p>
                                </div>
                                {[
                                    { key: 'view_calendar', label: 'Ver agenda de terceiros', sub: 'Pode visualizar horários de outros profissionais.' },
                                    { key: 'edit_calendar', label: 'Gerenciar própria agenda', sub: 'Pode mover, cancelar ou reagendar seus serviços.' },
                                    { key: 'view_finance', label: 'Acesso ao Financeiro / PDV', sub: 'Pode realizar vendas e fechar comandas.' },
                                    { key: 'edit_stock', label: 'Controle de Estoque', sub: 'Pode lançar entradas e saídas de produtos.' }
                                ].map(item => (
                                    <div key={item.key} className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-3xl transition-colors border border-transparent hover:border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                                            <p className="text-xs text-slate-400 font-medium">{item.sub}</p>
                                        </div>
                                        <ToggleSwitch 
                                            on={!!prof.permissions?.[item.key]} 
                                            onClick={() => updatePermission(item.key, !prof.permissions?.[item.key])} 
                                        />
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

export default ProfessionalDetail;
