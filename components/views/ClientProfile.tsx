import React, { useState, useMemo, useRef } from 'react';
import { 
    X, User, Phone, Mail, Calendar, Edit2, Save, 
    ArrowLeft, Globe, ShoppingBag, History, MoreVertical,
    Plus, CheckCircle, MapPin, Tag, Smartphone, MessageCircle,
    CreditCard, Briefcase, Home, Map, Hash, Info, Settings, Camera, Loader2
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { Client } from '../../types';
import { differenceInYears, parseISO, isValid } from 'date-fns';
import { supabase } from '../../services/supabaseClient';

interface ClientProfileProps {
    client: Client;
    onClose: () => void;
    onSave: (client: any) => Promise<void>;
}

const ReadField = ({ label, value, icon: Icon, span = "col-span-1" }: any) => (
    <div className={`flex items-start gap-3 py-3 border-b border-slate-50 last:border-0 group ${span}`}>
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors flex-shrink-0 mt-1">
            <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-sm font-bold text-slate-700 truncate">{value || '---'}</p>
        </div>
    </div>
);

const EditField = ({ label, name, value, onChange, type = "text", placeholder, span = "col-span-1" }: any) => (
    <div className={`space-y-1 ${span}`}>
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">{label}</label>
        <input 
            type={type}
            name={name}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
        />
    </div>
);

const ClientProfile: React.FC<ClientProfileProps> = ({ client, onClose, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'consumo' | 'atividades'>('geral');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [formData, setFormData] = useState<any>({
        ...client,
        apelido: (client as any).apelido || '',
        cpf: (client as any).cpf || '',
        rg: (client as any).rg || '',
        sexo: (client as any).sexo || '',
        profissao: (client as any).profissao || '',
        cep: (client as any).cep || '',
        endereco: (client as any).endereco || '',
        numero: (client as any).numero || '',
        bairro: (client as any).bairro || '',
        cidade: (client as any).cidade || '',
        estado: (client as any).estado || '',
        photo_url: (client as any).photo_url || null,
        online_booking_enabled: (client as any).online_booking_enabled ?? true,
        origem: (client as any).origem || 'Instagram'
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    // CORREÇÃO DO UPLOAD (Prevenção de Loop Infinito)
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar_${client.id || 'new'}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setFormData((prev: any) => ({ ...prev, photo_url: publicUrl }));
            console.log("Upload concluído com sucesso. URL gerada:", publicUrl);
            
        } catch (error: any) {
            console.error("Falha no upload do avatar:", error);
            alert(`Erro no upload: ${error.message}`);
        } finally {
            // ESSENCIAL: Garante que o loading pare independente do resultado
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // CORREÇÃO DO SALVAMENTO (Debug e Persistência)
    const handleSave = async () => {
        console.log("Botão 'Salvar' acionado. Iniciando persistência...");
        console.log("Payload para o banco:", formData);
        
        try {
            // A prop onSave chama o upsert no ClientesView.tsx
            await onSave(formData);
            setIsEditing(false);
            console.log("Dados salvos com sucesso.");
        } catch (error: any) {
            console.error("Erro crítico ao persistir dados do cliente:", error);
            alert(`Erro ao salvar: ${error.message}`);
        }
    };

    const clientAge = useMemo(() => {
        if (!formData.nascimento) return null;
        try {
            const date = parseISO(formData.nascimento);
            if (!isValid(date)) return null;
            return differenceInYears(new Date(), date);
        } catch { return null; }
    }, [formData.nascimento]);

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col font-sans animate-in slide-in-from-right duration-300">
            {/* HEADER DINÂMICO */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-6 shadow-sm z-10">
                <div className="flex items-center justify-between">
                    <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-orange-50 hover:text-orange-600 transition-all border border-slate-100 shadow-sm">
                                <Edit2 size={20} />
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2.5 text-slate-500 font-bold text-sm">Cancelar</button>
                                {/* CORREÇÃO: Mudança de submit para button para evitar bloqueios invisíveis de abas ocultas */}
                                <button 
                                    type="button" 
                                    onClick={handleSave} 
                                    className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                                >
                                    <Save size={18} /> Salvar Alterações
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <div className="relative group">
                        <div 
                            onClick={() => isEditing && fileInputRef.current?.click()}
                            className={`w-20 h-20 rounded-[24px] flex items-center justify-center text-2xl font-black border-4 border-white shadow-xl overflow-hidden transition-all ${isEditing ? 'cursor-pointer hover:brightness-90 ring-2 ring-orange-100' : ''} ${formData.photo_url ? 'bg-white' : 'bg-orange-100 text-orange-600'}`}
                        >
                            {isUploading ? (
                                <Loader2 className="animate-spin text-orange-500" />
                            ) : formData.photo_url ? (
                                <img src={formData.photo_url} className="w-full h-full object-cover" alt="Avatar" />
                            ) : (
                                formData.nome?.charAt(0) || '?'
                            )}

                            {isEditing && (
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="text-white" size={24} />
                                </div>
                            )}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                        
                        {formData.online_booking_enabled && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white shadow-sm" title="Agendamento Online Habilitado">
                                <Globe size={12} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-slate-800 leading-tight">{formData.nome}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                {formData.origem}
                            </span>
                            {formData.apelido && (
                                <span className="text-xs text-orange-500 font-black italic">"{formData.apelido}"</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="text-center p-3 bg-slate-50/50 rounded-2xl border border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Atendimentos</p>
                        <p className="text-lg font-black text-slate-700">12</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50/50 rounded-2xl border border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ticket Médio</p>
                        <p className="text-lg font-black text-slate-700">R$ 85</p>
                    </div>
                    <div className="text-center p-3 bg-rose-50 rounded-2xl border border-rose-100">
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">Saldo</p>
                        <p className="text-lg font-black text-rose-600">R$ 0</p>
                    </div>
                </div>
            </header>

            {/* ABAS */}
            <nav className="bg-white border-b border-slate-200 flex px-6 flex-shrink-0 overflow-x-auto scrollbar-hide">
                <button onClick={() => setActiveTab('geral')} className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === 'geral' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Geral</button>
                <button onClick={() => setActiveTab('consumo')} className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === 'consumo' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Serviços</button>
                <button onClick={() => setActiveTab('atividades')} className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === 'atividades' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Log</button>
            </nav>

            {/* CONTEÚDO */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* SEÇÃO 1: DADOS PESSOAIS */}
                            <Card title="Informações Pessoais" icon={<User size={18} />}>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                                    {!isEditing ? (
                                        <>
                                            <ReadField label="Nome Completo" value={formData.nome} icon={User} span="col-span-full md:col-span-2" />
                                            <ReadField label="Apelido" value={formData.apelido} icon={MessageCircle} />
                                            <ReadField label="CPF" value={formData.cpf} icon={CreditCard} />
                                            <ReadField label="RG" value={formData.rg} icon={Hash} />
                                            <ReadField label="Nascimento" value={formData.nascimento ? `${formData.nascimento} (${clientAge} anos)` : null} icon={Calendar} />
                                            <ReadField label="Sexo" value={formData.sexo} icon={User} />
                                            <ReadField label="Profissão" value={formData.profissao} icon={Briefcase} span="md:col-span-2" />
                                        </>
                                    ) : (
                                        <>
                                            <EditField label="Nome Completo" name="nome" value={formData.nome} onChange={handleInputChange} span="col-span-full md:col-span-2" />
                                            <EditField label="Apelido" name="apelido" value={formData.apelido} onChange={handleInputChange} placeholder="Ex: Gabi" />
                                            <EditField label="CPF" name="cpf" value={formData.cpf} onChange={handleInputChange} placeholder="000.000.000-00" />
                                            <EditField label="RG" name="rg" value={formData.rg} onChange={handleInputChange} placeholder="00.000.000-0" />
                                            <EditField label="Data Nascimento" name="nascimento" type="date" value={formData.nascimento} onChange={handleInputChange} />
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Sexo</label>
                                                <select name="sexo" value={formData.sexo} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
                                                    <option value="">Selecione</option>
                                                    <option value="Feminino">Feminino</option>
                                                    <option value="Masculino">Masculino</option>
                                                    <option value="Outro">Outro</option>
                                                </select>
                                            </div>
                                            <EditField label="Profissão" name="profissao" value={formData.profissao} onChange={handleInputChange} placeholder="Ex: Professora" span="md:col-span-2" />
                                        </>
                                    )}
                                </div>
                            </Card>

                            {/* SEÇÃO 2: CONTATO */}
                            <Card title="Canais de Contato" icon={<Phone size={18} />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                    {!isEditing ? (
                                        <>
                                            <ReadField label="WhatsApp / Celular" value={formData.whatsapp} icon={Smartphone} />
                                            <ReadField label="E-mail Principal" value={formData.email} icon={Mail} />
                                        </>
                                    ) : (
                                        <>
                                            <EditField label="WhatsApp" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} placeholder="(00) 00000-0000" />
                                            <EditField label="E-mail" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="cliente@email.com" />
                                        </>
                                    )}
                                </div>
                            </Card>

                            {/* SEÇÃO 3: ENDEREÇO COMPLETO */}
                            <Card title="Endereço e Localização" icon={<Home size={18} />}>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                                    {!isEditing ? (
                                        <>
                                            <ReadField label="CEP" value={formData.cep} icon={MapPin} />
                                            <ReadField label="Logradouro" value={formData.endereco} icon={Map} span="col-span-full md:col-span-3" />
                                            <ReadField label="Número" value={formData.numero} icon={Hash} />
                                            <ReadField label="Bairro" value={formData.bairro} icon={Map} />
                                            <ReadField label="Cidade" value={formData.cidade} icon={Map} />
                                            <ReadField label="Estado" value={formData.estado} icon={Map} />
                                        </>
                                    ) : (
                                        <>
                                            <EditField label="CEP" name="cep" value={formData.cep} onChange={handleInputChange} placeholder="00000-000" />
                                            <EditField label="Logradouro" name="endereco" value={formData.endereco} onChange={handleInputChange} span="col-span-full md:col-span-3" />
                                            <EditField label="Número" name="numero" value={formData.numero} onChange={handleInputChange} />
                                            <EditField label="Bairro" name="bairro" value={formData.bairro} onChange={handleInputChange} />
                                            <EditField label="Cidade" name="cidade" value={formData.cidade} onChange={handleInputChange} />
                                            <EditField label="Estado" name="estado" value={formData.estado} onChange={handleInputChange} placeholder="UF" />
                                        </>
                                    )}
                                </div>
                            </Card>

                            {/* SEÇÃO 4: CONFIGURAÇÕES */}
                            <Card title="Configurações e Origem" icon={<Settings size={18} />}>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Globe size={20}/></div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">Agendamento Online</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Permitir via link público</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch 
                                            on={formData.online_booking_enabled} 
                                            onClick={() => setFormData((prev: any) => ({...prev, online_booking_enabled: !prev.online_booking_enabled}))} 
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Como Conheceu? (Origem)</label>
                                        <select 
                                            name="origem"
                                            disabled={!isEditing}
                                            value={formData.origem}
                                            onChange={handleInputChange}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400 transition-all appearance-none"
                                        >
                                            <option value="Instagram">Instagram</option>
                                            <option value="Indicação">Indicação</option>
                                            <option value="Google / Maps">Google / Maps</option>
                                            <option value="Facebook">Facebook</option>
                                            <option value="Passagem">Passagem</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ClientProfile;