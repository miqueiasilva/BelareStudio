
import React, { useState, useRef } from 'react';
import { 
    ChevronLeft, Mail, Phone, MapPin, Calendar, Clock, DollarSign, 
    CheckCircle, List, User, Save, Upload, Plus, Trash2, Globe, Camera, Scissors, Loader2
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

const ProfessionalDetail: React.FC<ProfessionalDetailProps> = ({ professional: initialProf, services, onBack, onSave }) => {
    const [prof, setProf] = useState<LegacyProfessional>(initialProf);
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(false); // Feedback de salvamento
    const [activeTab, setActiveTab] = useState<'perfil' | 'servicos' | 'horarios' | 'comissoes'>('perfil');
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * FUNÇÃO DE SALVAMENTO BLINDADA
     * Trata a persistência diretamente e fornece feedback ao usuário
     */
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        console.log("JaciBot DEBUG: Tentando salvar colaborador...", prof);

        if (!prof.name) {
            return alert("O nome do colaborador é obrigatório!");
        }

        setLoading(true);

        try {
            // 1. Prepara o Payload (Mapeia campos do State para colunas do Supabase)
            const payload: any = {
                name: prof.name,
                role: prof.role,
                phone: prof.phone,
                email: prof.email,
                active: prof.active,
                online_booking: prof.onlineBooking,
                pix_key: prof.pixKey,
                commission_rate: prof.commissionRate
                // Adicione outros campos se necessário (ex: services, schedule como JSONB)
            };

            // 2. Blindagem da Foto: Só envia se houver valor real no avatarUrl
            // Isso evita apagar a foto do banco caso o estado esteja vazio momentaneamente
            if (prof.avatarUrl) {
                payload.photo_url = prof.avatarUrl;
            }

            // 3. Executa o UPDATE no Supabase
            const { error } = await supabase
                .from('professionals')
                .update(payload)
                .eq('id', prof.id);

            if (error) throw error;

            // 4. Feedback de Sucesso
            alert("Alterações salvas com sucesso! ✅");
            
            // 5. Notifica o componente pai e retorna
            onSave(prof);
            onBack();

        } catch (error: any) {
            console.error("JaciBot ERROR ao salvar:", error);
            alert(`Erro ao salvar: ${error.message || "Verifique sua conexão"}`);
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

            alert("Foto atualizada com sucesso!");

        } catch (error: any) {
            console.error("Erro no upload:", error);
            alert("Erro ao salvar foto.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemovePhoto = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Deseja remover a foto do perfil?")) return;

        try {
            const { error } = await supabase
                .from('professionals')
                .update({ photo_url: null })
                .eq('id', prof.id);

            if (error) throw error;

            setProf({ ...prof, avatarUrl: '' });
        } catch (error) {
            alert("Erro ao remover foto.");
        }
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

    const updateSchedule = (index: number, field: string, value: any) => {
        setProf(prev => {
            const newSchedule = [...(prev.schedule || [])];
            newSchedule[index] = { ...newSchedule[index], [field]: value };
            return { ...prev, schedule: newSchedule };
        });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header com Botão Salvar Principal */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        disabled={loading}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 disabled:opacity-50"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">Colaborador</h2>
                </div>
                
                {/* BOTÃO SALVAR (HEADER) */}
                <button 
                    onClick={() => handleSubmit()}
                    disabled={loading}
                    className={`px-6 py-2.5 font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                        loading 
                        ? 'bg-orange-300 cursor-not-allowed text-white/80' 
                        : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200'
                    }`}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-20">
                <div className="max-w-5xl mx-auto p-6 space-y-6">
                    {/* Card de Identificação */}
                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-slate-100 to-slate-50 z-0"></div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div 
                                className="w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-200 group cursor-pointer relative"
                                onClick={() => !isUploading && !loading && fileInputRef.current?.click()}
                            >
                                {prof.avatarUrl ? (
                                    <img src={prof.avatarUrl} alt={prof.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                                        <User size={48} />
                                    </div>
                                )}
                                <div className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {isUploading ? <Loader2 className="text-white w-8 h-8 animate-spin" /> : <Camera className="text-white w-8 h-8" />}
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadFoto} />
                            {prof.avatarUrl && !isUploading && (
                                <button onClick={handleRemovePhoto} className="mt-2 text-xs text-red-500 font-bold hover:text-red-700 flex items-center gap-1 bg-white/80 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm">
                                    <Trash2 size={12} /> Remover Foto
                                </button>
                            )}
                        </div>
                        <div className="relative z-10 flex-1 text-center md:text-left pt-2">
                            <h1 className="text-3xl font-bold text-slate-800">{prof.name || "Novo Colaborador"}</h1>
                            <p className="text-slate-500 font-medium">{prof.email || 'E-mail não definido'}</p>
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-3 text-sm">
                                {prof.onlineBooking ? (
                                    <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-3 py-1 rounded-full font-bold border border-orange-100">
                                        <Globe size={14} /> Agendamento Online
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
                                        Manual
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Navegação de Abas */}
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

                    {/* Conteúdo da Aba */}
                    {activeTab === 'perfil' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card title="Informações Pessoais">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                                        <input 
                                            value={prof.name} 
                                            onChange={e => setProf({...prof, name: e.target.value})} 
                                            className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo</label>
                                            <input 
                                                value={prof.role} 
                                                onChange={e => setProf({...prof, role: e.target.value})} 
                                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                                            <input 
                                                value={prof.phone} 
                                                onChange={e => setProf({...prof, phone: e.target.value})} 
                                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                                        <input 
                                            value={prof.email} 
                                            onChange={e => setProf({...prof, email: e.target.value})} 
                                            className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none" 
                                        />
                                    </div>
                                </div>
                            </Card>
                            <div className="space-y-6">
                                <Card title="Dados Bancários (Pix)">
                                    <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
                                        <div className="p-1 bg-green-100 rounded text-green-600"><DollarSign size={16}/></div>
                                        <input 
                                            value={prof.pixKey} 
                                            onChange={e => setProf({...prof, pixKey: e.target.value})} 
                                            placeholder="Chave Pix" 
                                            className="flex-1 outline-none font-medium" 
                                        />
                                    </div>
                                </Card>
                                <Card title="Status e Acesso">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div><p className="font-bold text-slate-800 text-sm">Colaborador Ativo</p></div>
                                            <ToggleSwitch on={prof.active || false} onClick={() => setProf({...prof, active: !prof.active})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div><p className="font-bold text-slate-800 text-sm">Habilitar Agenda Online</p></div>
                                            <ToggleSwitch on={prof.onlineBooking || false} onClick={() => setProf({...prof, onlineBooking: !prof.onlineBooking})} />
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'servicos' && (
                        <Card title="Serviços Habilitados">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {services.map(service => {
                                    const isSelected = (prof.services || []).includes(service.id);
                                    return (
                                        <div key={service.id} onClick={() => toggleService(service.id)} className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isSelected ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                    {isSelected ? <CheckCircle size={18} /> : <Scissors size={18} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm truncate">{service.name}</p>
                                                    <p className="text-xs text-slate-500">{service.duration} min • R$ {service.price.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {activeTab === 'horarios' && (
                        <Card title="Horários de Trabalho">
                            <div className="space-y-4">
                                {(prof.schedule || []).map((slot, index) => (
                                    <div key={index} className={`flex items-center justify-between p-3 rounded-xl border ${slot.active ? 'bg-white border-slate-200' : 'bg-slate-50 opacity-60'}`}>
                                        <div className="flex items-center gap-4 w-32">
                                            <ToggleSwitch on={slot.active} onClick={() => updateSchedule(index, 'active', !slot.active)} />
                                            <span className="font-bold text-slate-700 text-sm">{slot.day}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 justify-center">
                                            <input type="time" value={slot.start} disabled={!slot.active} onChange={(e) => updateSchedule(index, 'start', e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none" />
                                            <span className="text-slate-400 text-xs">até</span>
                                            <input type="time" value={slot.end} disabled={!slot.active} onChange={(e) => updateSchedule(index, 'end', e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {activeTab === 'comissoes' && (
                        <Card title="Comissão Padrão (%)">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number" 
                                    value={prof.commissionRate} 
                                    onChange={e => setProf({...prof, commissionRate: Number(e.target.value)})} 
                                    className="w-32 border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-orange-500 outline-none" 
                                />
                                <span className="text-slate-500 text-sm">por serviço realizado</span>
                            </div>
                        </Card>
                    )}

                    {/* BOTÃO SALVAR (RODAPÉ) */}
                    <div className="flex justify-end pt-6 border-t border-slate-200">
                        <button 
                            onClick={() => handleSubmit()}
                            disabled={loading}
                            className={`px-10 py-3.5 font-bold rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-3 ${
                                loading 
                                ? 'bg-orange-300 cursor-not-allowed text-white/80' 
                                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200'
                            }`}
                        >
                            {loading ? <Loader2 size={22} className="animate-spin" /> : <Save size={22} />}
                            {loading ? 'Salvando Alterações...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalDetail;
