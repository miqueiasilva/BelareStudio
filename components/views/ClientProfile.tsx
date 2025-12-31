
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    X, User, Phone, Mail, Calendar, Edit2, Save, 
    ArrowLeft, Globe, ShoppingBag, History, MoreVertical,
    Plus, CheckCircle, MapPin, Tag, Smartphone, MessageCircle,
    CreditCard, Briefcase, Home, Map, Hash, Info, Settings, 
    Camera, Loader2, FileText, Activity, AlertCircle, Maximize2,
    Trash2, PenTool, Eraser, Check, Image as ImageIcon, Instagram,
    Navigation, Smile
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { Client } from '../../types';
import { differenceInYears, parseISO, isValid, format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';

interface ClientProfileProps {
    client: Client;
    onClose: () => void;
    onSave: (client: any) => Promise<void>;
}

// --- Componente Interno: Assinatura Digital Refinada ---
const SignaturePad = ({ onSave }: { onSave: (blob: Blob) => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Configurações de "Caneta Esferográfica"
        ctx.strokeStyle = '#000080'; // Azul Marinho Profissional
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.2; // Espessura base refinada
    }, []);

    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: any) => {
        const pos = getPos(e);
        lastPos.current = pos;
        setIsDrawing(true);
        
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const pos = getPos(e);
        
        // Cálculo de velocidade para variar espessura (Simulação de Pressão)
        const dist = Math.sqrt(Math.pow(pos.x - lastPos.current.x, 2) + Math.pow(pos.y - lastPos.current.y, 2));
        const newWidth = Math.max(0.5, Math.min(2.5, 5 / (dist + 1)));
        
        // Suavização do traço
        ctx.lineWidth = (ctx.lineWidth * 0.3) + (newWidth * 0.7); // Filtro de velocidade (Smoothing)
        
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        
        lastPos.current = pos;
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleConfirm = () => {
        canvasRef.current?.toBlob((blob) => {
            if (blob) onSave(blob);
        }, 'image/png');
    };

    return (
        <div className="space-y-3">
            <div className="relative border-2 border-slate-200 rounded-3xl bg-white overflow-hidden h-48 touch-none shadow-inner">
                {/* Linha Guia Estilo Papel */}
                <div className="absolute bottom-12 left-8 right-8 h-px bg-slate-100 pointer-events-none"></div>
                
                <canvas 
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full h-full cursor-crosshair relative z-10"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={() => setIsDrawing(false)}
                    onMouseLeave={() => setIsDrawing(false)}
                    onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                    onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                    onTouchEnd={() => setIsDrawing(false)}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] z-0">Assinatura Digital BelaFlow</div>
            </div>
            <div className="flex gap-2">
                <button onClick={clear} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"><Eraser size={14}/> Limpar</button>
                <button onClick={handleConfirm} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all active:scale-95"><Check size={14}/> Confirmar Assinatura</button>
            </div>
        </div>
    );
};

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

const EditField = ({ label, name, value, onChange, type = "text", placeholder, span = "col-span-1", icon: Icon }: any) => (
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
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full bg-white border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all shadow-sm ${Icon ? 'pl-11 pr-4' : 'px-4'}`}
            />
        </div>
    </div>
);

const ClientProfile: React.FC<ClientProfileProps> = ({ client, onClose, onSave }) => {
    const isNew = !client.id;
    const [isEditing, setIsEditing] = useState(isNew);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'anamnese' | 'fotos' | 'historico'>('geral');
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    
    const [anamnesis, setAnamnesis] = useState<any>({
        has_allergy: false,
        allergy_details: '',
        is_pregnant: false,
        uses_meds: false,
        meds_details: '',
        clinical_notes: '',
        signed_at: null
    });

    const [photos, setPhotos] = useState<any[]>([]);

    const [formData, setFormData] = useState<any>({
        nome: client.nome || '',
        apelido: (client as any).apelido || '',
        whatsapp: client.whatsapp || '',
        email: client.email || '',
        instagram: (client as any).instagram || '',
        nascimento: client.nascimento || '',
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
        origem: (client as any).origem || 'Instagram',
        notas_gerais: (client as any).notas_gerais || '',
        id: client.id || null
    });

    useEffect(() => {
        if (client.id) {
            fetchAnamnesis();
            fetchPhotos();
        }
    }, [client.id]);

    // Busca automática de CEP
    useEffect(() => {
        const fetchAddress = async () => {
            const cleanCep = formData.cep?.replace(/\D/g, '');
            if (cleanCep?.length === 8) {
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                    const data = await res.json();
                    if (!data.erro) {
                        setFormData((prev: any) => ({
                            ...prev,
                            endereco: data.logradouro,
                            bairro: data.bairro,
                            cidade: data.localidade,
                            estado: data.uf
                        }));
                    }
                } catch (e) { console.error("Erro ao buscar CEP"); }
            }
        };
        fetchAddress();
    }, [formData.cep]);

    const fetchAnamnesis = async () => {
        const { data } = await supabase.from('client_anamnesis').select('*').eq('client_id', client.id).maybeSingle();
        if (data) setAnamnesis(data);
    };

    const fetchPhotos = async () => {
        const { data } = await supabase.from('client_photos').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
        if (data) setPhotos(data);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSaveAnamnesis = async () => {
        const payload = { ...anamnesis, client_id: client.id };
        const { error } = await supabase.from('client_anamnesis').upsert(payload);
        if (!error) alert("Ficha de anamnese salva!");
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !client.id) return;
        setIsUploading(true);
        try {
            const fileName = `evolution_${client.id}_${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('client-evolution').upload(fileName, file);
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage.from('client-evolution').getPublicUrl(fileName);
            await supabase.from('client_photos').insert([{ client_id: client.id, url: publicUrl, type: 'depois' }]);
            fetchPhotos();
        } finally {
            setIsUploading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const fileName = `avatar_${formData.id || 'new'}_${Date.now()}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            setFormData((prev: any) => ({ ...prev, photo_url: publicUrl }));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        const payload = { ...formData };
        if (isNew) delete payload.id;
        await onSave(payload);
        setIsEditing(false);
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
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-6 shadow-sm z-10">
                <div className="flex items-center justify-between">
                    <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
                                <Edit2 size={18} /> Editar Perfil
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => !isNew ? setIsEditing(false) : onClose()} className="px-4 py-2.5 text-slate-500 font-bold text-sm">Cancelar</button>
                                <button type="button" onClick={handleSave} className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95">
                                    <Save size={18} /> {isNew ? 'Criar Cliente' : 'Salvar Alterações'}
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
                            {isUploading ? <Loader2 className="animate-spin text-orange-500" /> : formData.photo_url ? <img src={formData.photo_url} className="w-full h-full object-cover" alt="Avatar" /> : formData.nome?.charAt(0) || '?'}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                        
                        {anamnesis.has_allergy && (
                            <div className="absolute -top-1 -right-1 bg-rose-500 text-white p-1 rounded-full border-2 border-white shadow-sm animate-pulse">
                                <AlertCircle size={14} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-slate-800 leading-tight">{formData.nome || 'Novo Cliente'}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">{formData.origem}</span>
                            {anamnesis.has_allergy && <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">⚠️ Alérgica</span>}
                        </div>
                    </div>
                </div>
            </header>

            {/* NAVIGATION */}
            <nav className="bg-white border-b border-slate-200 flex px-6 flex-shrink-0 overflow-x-auto scrollbar-hide">
                <button onClick={() => setActiveTab('geral')} className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === 'geral' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Dados</button>
                <button onClick={() => setActiveTab('anamnese')} className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === 'anamnese' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Anamnese</button>
                <button onClick={() => setActiveTab('fotos')} className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === 'fotos' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Galeria</button>
                <button onClick={() => setActiveTab('historico')} className={`py-4 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === 'historico' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Histórico</button>
            </nav>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                <div className="max-w-5xl mx-auto space-y-6 pb-24">
                    
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                             
                             {/* SEÇÃO: CONTATO */}
                             <Card title="Contato e Redes Sociais" icon={<Smartphone size={18} />}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <EditField label="WhatsApp / Celular" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} placeholder="(00) 00000-0000" icon={Phone} />
                                    <EditField label="E-mail Principal" name="email" value={formData.email} onChange={handleInputChange} placeholder="cliente@email.com" icon={Mail} />
                                    <EditField label="Instagram" name="instagram" value={formData.instagram} onChange={handleInputChange} placeholder="@usuario" icon={Instagram} />
                                </div>
                             </Card>

                             {/* SEÇÃO: ENDEREÇO COMPLETO */}
                             <Card title="Endereço e Localização" icon={<MapPin size={18} />}>
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                                    <EditField label="CEP" name="cep" value={formData.cep} onChange={handleInputChange} placeholder="00000-000" icon={Hash} span="col-span-2" />
                                    <EditField label="Logradouro" name="endereco" value={formData.endereco} onChange={handleInputChange} placeholder="Rua, Av..." icon={Navigation} span="col-span-3" />
                                    <EditField label="Número" name="numero" value={formData.numero} onChange={handleInputChange} placeholder="123" span="col-span-1" />
                                    <EditField label="Bairro" name="bairro" value={formData.bairro} onChange={handleInputChange} placeholder="Bairro" span="col-span-2" />
                                    <EditField label="Cidade" name="cidade" value={formData.cidade} onChange={handleInputChange} placeholder="Cidade" span="col-span-2" />
                                    <EditField label="Estado" name="estado" value={formData.estado} onChange={handleInputChange} placeholder="UF" span="col-span-2" />
                                </div>
                             </Card>

                             {/* SEÇÃO: DADOS PESSOAIS */}
                             <Card title="Perfil do Cliente" icon={<User size={18} />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <EditField label="Nome Completo" name="nome" value={formData.nome} onChange={handleInputChange} icon={User} span="md:col-span-2" />
                                    <EditField label="Como Gosta de ser Chamada" name="apelido" value={formData.apelido} onChange={handleInputChange} icon={Smile} />
                                    <EditField label="CPF" name="cpf" value={formData.cpf} onChange={handleInputChange} placeholder="000.000.000-00" icon={CreditCard} />
                                    <EditField label="Data de Nascimento" name="nascimento" type="date" value={formData.nascimento} onChange={handleInputChange} icon={Calendar} />
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Sexo</label>
                                        <select name="sexo" value={formData.sexo} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50">
                                            <option value="">Selecione</option>
                                            <option value="Feminino">Feminino</option>
                                            <option value="Masculino">Masculino</option>
                                            <option value="Não informado">Não informar</option>
                                        </select>
                                    </div>
                                    <EditField label="Profissão" name="profissao" value={formData.profissao} onChange={handleInputChange} icon={Briefcase} />
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Como nos conheceu?</label>
                                        <select name="origem" value={formData.origem} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50">
                                            <option value="Instagram">Instagram</option>
                                            <option value="Indicação">Indicação</option>
                                            <option value="Passagem">Passagem</option>
                                            <option value="Google">Google / Maps</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </div>
                                </div>
                             </Card>

                             {/* SEÇÃO: ANOTAÇÕES */}
                             <Card title="Observações Gerais" icon={<FileText size={18} />}>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Anotações Internas Estratégicas</label>
                                    <textarea 
                                        name="notas_gerais"
                                        value={formData.notas_gerais}
                                        onChange={handleInputChange}
                                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 min-h-[120px] outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-medium text-slate-600 resize-none shadow-sm"
                                        placeholder="Ex: Prefere tons pastéis, tem sensibilidade nos cílios, gosta de conversar sobre viagens..."
                                    />
                                </div>
                             </Card>

                             {/* BOTÃO DE SALVAR NO RODAPÉ DA ABA */}
                             <div className="flex justify-end pt-4">
                                <button onClick={handleSave} className="px-10 py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 shadow-xl transition-all active:scale-95 flex items-center gap-3">
                                    <Save size={20} /> Salvar Todos os Dados
                                </button>
                             </div>
                        </div>
                    )}

                    {activeTab === 'anamnese' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <Card title="Ficha de Saúde Estética" icon={<Activity size={18} />}>
                                <div className="space-y-8">
                                    {[
                                        { key: 'has_allergy', label: 'Possui Alguma Alergia?', hasDetails: true, detailKey: 'allergy_details', placeholder: 'Cite substâncias (ex: Glúten, Henna, Ácidos)...' },
                                        { key: 'is_pregnant', label: 'Está Gestante ou Lactante?', hasDetails: false },
                                        { key: 'uses_meds', label: 'Usa Medicamentos Contínuos?', hasDetails: true, detailKey: 'meds_details', placeholder: 'Quais medicamentos?' }
                                    ].map(q => (
                                        <div key={q.key} className="space-y-4 border-b border-slate-50 pb-6 last:border-0">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-slate-700">{q.label}</p>
                                                <ToggleSwitch on={anamnesis[q.key]} onClick={() => setAnamnesis({...anamnesis, [q.key]: !anamnesis[q.key]})} />
                                            </div>
                                            {q.hasDetails && anamnesis[q.key] && (
                                                <div className="animate-in slide-in-from-left-2 duration-300">
                                                    <textarea 
                                                        value={anamnesis[q.detailKey]}
                                                        onChange={(e) => setAnamnesis({...anamnesis, [q.detailKey]: e.target.value})}
                                                        placeholder={q.placeholder}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                                                        rows={2}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Observações Clínicas / Histórico</label>
                                        <textarea 
                                            value={anamnesis.clinical_notes}
                                            onChange={(e) => setAnamnesis({...anamnesis, clinical_notes: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-orange-100"
                                            rows={4}
                                            placeholder="Anotações internas sobre a pele ou reações anteriores..."
                                        />
                                    </div>

                                    <div className="pt-6 border-t border-slate-100">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><PenTool size={14}/> Assinatura do Termo de Ciência</h4>
                                        <SignaturePad onSave={(blob) => alert("Assinatura capturada! Clique em Salvar Ficha para finalizar.")} />
                                    </div>
                                    
                                    <button onClick={handleSaveAnamnesis} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                        <Save size={18} /> Salvar Ficha de Anamnese
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <header className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Timeline de Evolução</h3>
                                <button 
                                    onClick={() => photoInputRef.current?.click()}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-orange-600 flex items-center gap-2 shadow-sm hover:bg-orange-50 transition-all"
                                >
                                    <Plus size={16} /> Adicionar Foto
                                </button>
                                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                            </header>

                            {photos.length === 0 ? (
                                <div className="bg-white rounded-[32px] p-20 text-center border-2 border-dashed border-slate-100">
                                    <ImageIcon size={48} className="mx-auto text-slate-100 mb-4" />
                                    <p className="text-slate-400 font-bold text-sm">Nenhuma foto registrada para este cliente.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {photos.map(photo => (
                                        <div key={photo.id} className="relative aspect-square rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-sm">
                                            <img src={photo.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Evolução" />
                                            <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur rounded-lg text-[9px] font-black text-slate-800 uppercase shadow-sm">{format(parseISO(photo.created_at), 'dd MMM yy')}</div>
                                            <div className="absolute bottom-3 right-3 flex gap-2 translate-y-10 group-hover:translate-y-0 transition-transform duration-300">
                                                <button onClick={() => setZoomImage(photo.url)} className="p-2 bg-white text-slate-600 rounded-xl shadow-lg hover:text-orange-500"><Maximize2 size={14}/></button>
                                                <button className="p-2 bg-white text-rose-500 rounded-xl shadow-lg hover:bg-rose-50"><Trash2 size={14}/></button>
                                            </div>
                                            <div className="absolute top-3 right-3">
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${photo.type === 'antes' ? 'bg-slate-800 text-white' : 'bg-emerald-50 text-white'}`}>
                                                    {photo.type}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* LIGHTBOX ZOOM */}
            {zoomImage && (
                <div className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <button onClick={() => setZoomImage(null)} className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20"><X size={32}/></button>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-[40px] shadow-2xl object-contain animate-in zoom-in-95 duration-500" alt="Zoom" />
                </div>
            )}
        </div>
    );
};

export default ClientProfile;
