
import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronLeft, Mail, Phone, MapPin, Calendar, Clock, DollarSign, 
    CheckCircle, List, User, Save, Upload, Plus, Trash2, Globe, Camera, Scissors, Loader2, AlertCircle
} from 'lucide-react';
import { LegacyProfessional, LegacyService } from '../../types';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { supabase } from '../../services/supabaseClient';

interface ProfessionalDetailProps {
    professional: LegacyProfessional;
    services: LegacyService[];
    onBack: () => void;
    onSave: (prof: LegacyProfessional) => void;
}

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const ProfessionalDetail: React.FC<ProfessionalDetailProps> = ({ professional: initialProf, services, onBack, onSave }) => {
    // Estado local blindado
    const [prof, setProf] = useState<LegacyProfessional>(initialProf);
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'perfil' | 'servicos' | 'horarios' | 'comissoes'>('perfil');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Carregamento Inicial e Normalização de Dados (Mapeia work_schedule do DB se existir)
    useEffect(() => {
        // Se o profissional já tiver work_schedule vindo do banco (objeto JSON), 
        // convertemos para o array 'schedule' usado na UI.
        const dbSchedule = (initialProf as any).work_schedule;
        
        if (dbSchedule && typeof dbSchedule === 'object' && !Array.isArray(dbSchedule)) {
            const mappedSchedule = DAYS_OF_WEEK.map(day => {
                const key = day.toLowerCase();
                const data = dbSchedule[key] || { active: true, start: '09:00', end: '18:00' };
                return {
                    day,
                    active: data.active ?? true,
                    start: data.start || '09:00',
                    end: data.end || '18:00'
                };
            });
            setProf(prev => ({ ...prev, schedule: mappedSchedule }));
        } else if (!initialProf.schedule || initialProf.schedule.length === 0) {
            // Default caso não tenha nada
            const defaultSchedule = DAYS_OF_WEEK.map(day => ({
                day,
                active: day !== 'Domingo',
                start: '09:00',
                end: day === 'Sábado' ? '14:00' : '18:00'
            }));
            setProf(prev => ({ ...prev, schedule: defaultSchedule }));
        }
    }, [initialProf]);

    /**
     * FUNÇÃO DE SALVAMENTO PRINCIPAL
     * Persiste dados nas novas colunas pix_key e work_schedule
     */
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (!prof.name) {
            return alert("O nome do profissional é obrigatório!");
        }

        setLoading(true);
        console.log("JaciBot: Iniciando salvamento...", prof);

        try {
            // 1. Converte Array de Horários para Objeto JSON (Chaveado por dia)
            const workScheduleObj = (prof.schedule || []).reduce((acc, curr) => {
                acc[curr.day.toLowerCase()] = {
                    active: curr.active,
                    start: curr.start,
                    end: curr.end
                };
                return acc;
            }, {} as Record<string, any>);

            // 2. Prepara o Payload para o Supabase
            const payload = {
                name: prof.name,
                role: prof.role,
                phone: prof.phone,
                email: prof.email,
                active: prof.active,
                online_booking: prof.onlineBooking,
                pix_key: prof.pixKey, // Nova Coluna
                work_schedule: workScheduleObj, // Nova Coluna JSONB
                commission_rate: prof.commissionRate
            };

            // 3. Executa a atualização
            const { error } = await supabase
                .from('professionals')
                .update(payload)
                .eq('id', prof.id);

            if (error) throw error;

            alert("Dados de " + prof.name + " salvos com sucesso! ✅");
            
            // 4. Sincroniza com o componente pai e volta
            onSave(prof);
            onBack();

        } catch (error: any) {
            console.error("JaciBot ERRO ao salvar:", error);
            alert(`Falha ao salvar: ${error.message || "Verifique sua conexão"}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("A imagem é muito grande (máx 5MB).");
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${prof.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('team-photos')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('team-photos')
                .getPublicUrl(fileName);

            setProf(prev => ({ ...prev, avatarUrl: publicUrl }));

            const { error: dbError } = await supabase
                .from('professionals')
                .update({ photo_url: publicUrl })
                .eq('id', prof.id);

            if (dbError) throw dbError;

            alert("Foto atualizada!");
        } catch (error: any) {
            alert("Erro ao enviar foto.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const updateSchedule = (index: number, field: string, value: any) => {
        setProf(prev => {
            const newSchedule = [...(prev.schedule || [])];
            newSchedule[index] = { ...newSchedule[index], [field]: value };
            return { ...prev, schedule: newSchedule };
        });
    };

    const toggleService = (serviceId: number) => {
        setProf(prev => {
            const currentServices = prev.services || [];
            if (currentServices.includes(serviceId)) {
                return { ...prev, services: currentServices.filter(id => id !== serviceId) };
            } else {
                return { ...prev, services: [...currentServices, serviceId] };
            }
        });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Top Bar com Botão Blindado */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} disabled={loading} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 disabled:opacity-50">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">Colaborador</h2>
                </div>
                
                <button 
                    onClick={() => handleSubmit()}
                    disabled={loading}
                    className={`px-6 py-2.5 font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                        loading ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200'
                    }`}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-10">
                <div className="max-w-5xl mx-auto p-6 space-y-6">
                    {/* Header Card */}
                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-orange-50 to-white z-0"></div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div 
                                className="w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-100 group cursor-pointer relative"
                                onClick={() => !isUploading && !loading && fileInputRef.current?.click()}
                            >
                                {prof.avatarUrl ? (
                                    <img src={prof.avatarUrl} alt={prof.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={64} /></div>
                                )}
                                <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {isUploading ? <Loader2 className="text-white animate-spin" /> : <Camera className="text-white" />}
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadFoto} />
                        </div>
                        <div className="relative z-10 flex-1 text-center md:text-left pt-2">
                            <h1 className="text-3xl font-bold text-slate-800">{prof.name || "Novo Colaborador"}</h1>
                            <p className="text-slate-500 font-medium">{prof.role || "Cargo não definido"}</p>
                            <div className="mt-3 flex flex-wrap justify-center md:justify-start gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${prof.active ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                                    {prof.active ? 'COLABORADOR ATIVO' : 'COLABORADOR INATIVO'}
                                </span>
                                {prof.onlineBooking && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                                        <Globe size={12} /> AGENDA ONLINE
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="border-b border-slate-200">
                        <nav className="-mb-px flex gap-8 overflow-x-auto scrollbar-hide">
                            {['perfil', 'servicos', 'horarios', 'comissoes'].map((id) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id as any)}
                                    className={`pb-4 text-sm font-bold tracking-wide transition-colors whitespace-nowrap uppercase ${
                                        activeTab === id ? 'border-b-2 border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {id}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* ABA PERFIL */}
                    {activeTab === 'perfil' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                            <Card title="Dados de Contato">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                                        <input value={prof.name} onChange={e => setProf({...prof, name: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo</label>
                                            <input value={prof.role} onChange={e => setProf({...prof, role: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                                            <input value={prof.phone} onChange={e => setProf({...prof, phone: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Corporativo</label>
                                        <input value={prof.email} onChange={e => setProf({...prof, email: e.target.value})} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                                    </div>
                                </div>
                            </Card>
                            
                            <div className="space-y-6">
                                <Card title="Dados de Pagamento">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Chave Pix para Repasses</label>
                                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                                            <DollarSign className="text-green-600" size={20} />
                                            <input 
                                                value={prof.pixKey || ''} 
                                                onChange={e => setProf({...prof, pixKey: e.target.value})} 
                                                placeholder="CPF, E-mail ou Telefone"
                                                className="bg-transparent w-full outline-none font-medium text-slate-700"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2">Esta chave será usada para o fechamento automático de comissões.</p>
                                    </div>
                                </Card>

                                <Card title="Configurações de Exibição">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">Exibir na Agenda Online</p>
                                                <p className="text-xs text-slate-500">Permitir que clientes agendem pelo link público.</p>
                                            </div>
                                            <ToggleSwitch on={prof.onlineBooking || false} onClick={() => setProf({...prof, onlineBooking: !prof.onlineBooking})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">Status Ativo</p>
                                                <p className="text-xs text-slate-500">Inativo oculta o profissional de todo o sistema.</p>
                                            </div>
                                            <ToggleSwitch on={prof.active || false} onClick={() => setProf({...prof, active: !prof.active})} />
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* ABA HORÁRIOS - IMPLEMENTAÇÃO ROBUSTA */}
                    {activeTab === 'horarios' && (
                        <div className="animate-in slide-in-from-right-4 duration-300">
                            <Card title="Escala de Trabalho Semanal" icon={<Clock className="w-5 h-5" />}>
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 mb-6">
                                        <Clock className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            Configure aqui os horários em que este profissional está disponível. 
                                            Dias desativados serão exibidos como "Folga" ou "Indisponível" para os clientes.
                                        </p>
                                    </div>

                                    {(prof.schedule || []).map((slot, index) => (
                                        <div 
                                            key={slot.day} 
                                            className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border transition-all ${
                                                slot.active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 opacity-60 grayscale-[0.5] border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4 w-full sm:w-44 mb-4 sm:mb-0">
                                                <ToggleSwitch on={slot.active} onClick={() => updateSchedule(index, 'active', !slot.active)} />
                                                <span className={`font-bold ${slot.active ? 'text-slate-800' : 'text-slate-400'}`}>
                                                    {slot.day}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                <div className="relative flex-1 sm:w-32">
                                                    <input 
                                                        type="time" 
                                                        disabled={!slot.active}
                                                        value={slot.start} 
                                                        onChange={(e) => updateSchedule(index, 'start', e.target.value)}
                                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-slate-100"
                                                    />
                                                </div>
                                                <span className="text-slate-400 text-xs font-bold uppercase">até</span>
                                                <div className="relative flex-1 sm:w-32">
                                                    <input 
                                                        type="time" 
                                                        disabled={!slot.active}
                                                        value={slot.end} 
                                                        onChange={(e) => updateSchedule(index, 'end', e.target.value)}
                                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-slate-100"
                                                    />
                                                </div>
                                            </div>

                                            {!slot.active && (
                                                <div className="hidden md:block text-xs font-bold text-slate-400 uppercase tracking-widest px-4">
                                                    Indisponível
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* ABA SERVIÇOS */}
                    {activeTab === 'servicos' && (
                        <Card title="Serviços Habilitados" icon={<Scissors className="w-5 h-5" />}>
                            <p className="text-sm text-slate-500 mb-6">Marque quais serviços este profissional está apto a realizar.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {services.map(service => {
                                    const isSelected = (prof.services || []).includes(service.id);
                                    return (
                                        <div key={service.id} onClick={() => toggleService(service.id)} className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all group ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-200'}`}>
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:border-orange-100'}`}>
                                                    {isSelected ? <CheckCircle size={24} /> : <Scissors size={24} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`font-bold text-sm truncate ${isSelected ? 'text-orange-900' : 'text-slate-700'}`}>{service.name}</p>
                                                    <p className="text-xs text-slate-500">{service.duration} min • R$ {service.price.toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                                                {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* ABA COMISSÕES */}
                    {activeTab === 'comissoes' && (
                        <div className="max-w-xl animate-in fade-in duration-300">
                            <Card title="Regra de Repasse" icon={<DollarSign className="w-5 h-5" />}>
                                <div className="space-y-6">
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                                        <label className="block text-xs font-bold text-orange-800 uppercase mb-3">Porcentagem de Comissão (%)</label>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="number" 
                                                value={prof.commissionRate} 
                                                onChange={e => setProf({...prof, commissionRate: Number(e.target.value)})} 
                                                className="w-32 border border-orange-200 rounded-xl px-4 py-4 text-2xl font-extrabold text-orange-600 focus:ring-2 focus:ring-orange-500 outline-none transition-all" 
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800 text-sm">Comissão Padrão</p>
                                                <p className="text-xs text-slate-500">Calculada sobre o valor líquido de cada serviço realizado.</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ganhos no Mês</p>
                                            <p className="text-xl font-bold text-slate-800">R$ 3.450,00</p>
                                        </div>
                                        <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">A Repassar</p>
                                            <p className="text-xl font-bold text-green-600">R$ 1.725,00</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfessionalDetail;
