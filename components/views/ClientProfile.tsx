
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    X, User, Phone, Mail, Calendar, Edit2, Save, 
    ArrowLeft, Globe, ShoppingBag, History, MoreVertical,
    Plus, CheckCircle, MapPin, Tag, Smartphone, MessageCircle,
    CreditCard, Briefcase, Home, Map, Hash, Info, Settings, 
    Camera, Loader2, FileText, Activity, AlertCircle, Maximize2,
    Trash2, PenTool, Eraser, Check, Image as ImageIcon, Instagram,
    Navigation, Smile, FilePlus, ChevronDown
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { Client } from '../../types';
import { differenceInYears, parseISO, isValid, format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import Toast, { ToastType } from '../shared/Toast';

interface ClientProfileProps {
    client: Client;
    onClose: () => void;
    onSave: (client: any) => Promise<void>;
}

// --- Componente Interno: Assinatura Digital ---
const SignaturePad = ({ onSave, isSaving }: { onSave: (blob: Blob) => void, isSaving: boolean }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#000080'; 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 0.8; 
    }, []);

    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: any) => {
        const pos = getPos(e);
        lastPos.current = pos;
        setIsDrawing(true);
        setIsEmpty(false);
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
        const dist = Math.sqrt(Math.pow(pos.x - lastPos.current.x, 2) + Math.pow(pos.y - lastPos.current.y, 2));
        const targetWidth = Math.max(0.5, Math.min(1.8, 4 / (dist + 1)));
        const velocityFilterWeight = 0.85;
        ctx.lineWidth = (ctx.lineWidth * velocityFilterWeight) + (targetWidth * (1 - velocityFilterWeight));
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const handleConfirm = () => {
        if (isEmpty) {
            alert("Por favor, assine antes de confirmar.");
            return;
        }
        canvasRef.current?.toBlob((blob) => {
            if (blob) onSave(blob);
        }, 'image/png');
    };

    return (
        <div className="space-y-3">
            <div className="relative border-2 border-slate-200 rounded-3xl bg-white overflow-hidden h-56 touch-none shadow-inner group">
                <div className="absolute bottom-14 left-10 right-10 h-px bg-slate-100 pointer-events-none"></div>
                <canvas 
                    ref={canvasRef}
                    className="w-full h-full cursor-crosshair relative z-10"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={() => setIsDrawing(false)}
                    onMouseLeave={() => setIsDrawing(false)}
                    onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                    onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                    onTouchEnd={() => setIsDrawing(false)}
                />
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none text-[8px] font-black text-slate-300 uppercase tracking-[0.4em] z-0">
                    Documento Assinado Digitalmente via BelaFlow
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={clear} disabled={isSaving} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors disabled:opacity-50"><Eraser size={14}/> Limpar</button>
                <button onClick={handleConfirm} disabled={isSaving || isEmpty} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14}/>}
                    {isSaving ? 'Salvando...' : 'Confirmar Assinatura'}
                </button>
            </div>
        </div>
    );
};

const EditField = ({ label, name, value, onChange, type = "text", placeholder, span = "col-span-1", icon: Icon, disabled }: any) => (
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
                disabled={disabled}
                placeholder={placeholder}
                className={`w-full bg-white border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all shadow-sm ${Icon ? 'pl-11 pr-4' : 'px-4'} disabled:opacity-60 disabled:bg-slate-50`}
            />
        </div>
    </div>
);

const ClientProfile: React.FC<ClientProfileProps> = ({ client, onClose, onSave }) => {
    const isNew = !client.id;
    const [isEditing, setIsEditing] = useState(isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'anamnese' | 'fotos' | 'historico'>('geral');
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    
    // States: Anamnese
    const [anamnesis, setAnamnesis] = useState<any>({
        has_allergy: false,
        allergy_details: '',
        is_pregnant: false,
        uses_meds: false,
        meds_details: '',
        clinical_notes: '',
        signed_at: null,
        signature_url: null
    });
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [photos, setPhotos] = useState<any[]>([]);

    // --- Modelo de Estado Sincronizado com as Colunas do Banco (Português) ---
    const [formData, setFormData] = useState<any>({
        id: null,
        nome: '',
        apelido: '',
        telefone: '',
        email: '',
        instagram: '',
        nascimento: '',
        cpf: '',
        rg: '',
        sexo: '',
        profissao: '',
        cep: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        photo_url: null,
        online_booking_enabled: true,
        origem: 'Instagram',
        observacoes: ''
    });

    useEffect(() => {
        if (client.id) {
            refreshClientData();
            fetchAnamnesis();
            fetchPhotos();
            fetchTemplates();
        } else {
            setFormData(prev => ({ ...prev, nome: client.nome || '' }));
        }
    }, [client.id]);

    const refreshClientData = async () => {
        if (!client.id) return;
        const { data, error } = await supabase.from('clients').select('*').eq('id', client.id).single();
        if (data) {
            setFormData({
                id: data.id,
                nome: data.nome || data.full_name || '',
                apelido: data.apelido || data.nickname || '',
                telefone: data.telefone || data.whatsapp || data.phone || '',
                email: data.email || '',
                instagram: data.instagram || '',
                nascimento: data.nascimento || data.birth_date || '',
                cpf: data.cpf || '',
                rg: data.rg || '',
                sexo: data.sexo || data.gender || '',
                profissao: data.profissao || data.profession || '',
                cep: data.cep || data.postal_code || '',
                endereco: data.endereco || data.address || '',
                numero: data.numero || data.number || '',
                complemento: data.complemento || data.complement || '',
                bairro: data.bairro || data.neighborhood || '',
                cidade: data.cidade || data.city || '',
                estado: data.estado || data.state || '',
                photo_url: data.photo_url || null,
                online_booking_enabled: data.online_booking_enabled ?? true,
                origem: data.origem || data.how_found || 'Instagram',
                observacoes: data.observacoes || data.notes || ''
            });
        }
    };

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
                } catch (e) { console.error("Erro CEP"); }
            }
        };
        fetchAddress();
    }, [formData.cep]);

    const fetchAnamnesis = async () => {
        const { data } = await supabase.from('client_anamnesis').select('*').eq('client_id', client.id).maybeSingle();
        if (data) setAnamnesis(data);
    };

    const fetchTemplates = async () => {
        const { data } = await supabase.from('anamnesis_templates').select('id, name, content').order('name');
        if (data) setTemplates(data);
    };

    const handleLoadTemplate = () => {
        if (!selectedTemplateId) return;
        const template = templates.find(t => t.id === Number(selectedTemplateId));
        if (template) {
            const currentNotes = anamnesis.clinical_notes || '';
            const divider = currentNotes.trim() ? '\n\n---\n\n' : '';
            setAnamnesis({
                ...anamnesis,
                clinical_notes: currentNotes + divider + template.content
            });
            setSelectedTemplateId('');
        }
    };

    const fetchPhotos = async () => {
        const { data } = await supabase.from('client_photos').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
        if (data) setPhotos(data);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSaveAnamnesis = async () => {
        setIsSaving(true);
        const payload = { ...anamnesis, client_id: client.id };
        const { error } = await supabase.from('client_anamnesis').upsert(payload);
        setIsSaving(false);
        if (!error) setToast({ message: "Anamnese salva!", type: 'success' });
        else setToast({ message: "Erro na anamnese.", type: 'error' });
    };

    const handleSaveSignature = async (blob: Blob) => {
        if (!client.id) return;
        setIsSaving(true);
        try {
            const fileName = `sig_${client.id}_${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage.from('signatures').upload(fileName, blob, { contentType: 'image/png' });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('signatures').getPublicUrl(fileName);
            const timestamp = new Date().toISOString();
            await supabase.from('client_anamnesis').update({ signature_url: publicUrl, signed_at: timestamp }).eq('client_id', client.id);
            setAnamnesis(prev => ({ ...prev, signature_url: publicUrl, signed_at: timestamp }));
            setToast({ message: "Assinatura vinculada!", type: 'success' });
        } catch (e: any) {
            setToast({ message: "Erro na assinatura.", type: 'error' });
        } finally { setIsSaving(false); }
    };

    const handleSave = async () => {
        if (!formData.nome) {
            setToast({ message: "Nome é obrigatório.", type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            // --- Mapeamento Frontend -> Banco de Dados (Schema Exato em Português) ---
            const payload = {
                nome: formData.nome,
                apelido: formData.apelido || null,
                telefone: formData.telefone || null,
                email: formData.email || null,
                instagram: formData.instagram || null,
                nascimento: formData.nascimento || null,
                cpf: formData.cpf || null,
                rg: formData.rg || null,
                sexo: formData.sexo || null,
                profissao: formData.profissao || null,
                cep: formData.cep || null,
                endereco: formData.endereco || null,
                numero: formData.numero || null,
                complemento: formData.complemento || null,
                bairro: formData.bairro || null,
                cidade: formData.cidade || null,
                estado: formData.estado || null,
                origem: formData.origem || 'Outros',
                observacoes: formData.observacoes || null,
                online_booking_enabled: formData.online_booking_enabled,
                photo_url: formData.photo_url
            };

            const { error } = await supabase
                .from('clients')
                .update(payload)
                .eq('id', formData.id);

            if (error) throw error;
            
            setToast({ message: "Perfil atualizado! ✅", type: 'success' });
            setIsEditing(false);
            await refreshClientData();
            
        } catch (err: any) {
            console.error("DB Save Error:", err);
            // Debug detalhado conforme solicitado para identificar colunas faltantes ou tipos inválidos
            setToast({ 
                message: `Erro ao persistir: ${err.message || "Erro desconhecido"}. Detalhes: ${err.details || err.hint || "Verifique restrições de banco."}`, 
                type: 'error' 
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col font-sans animate-in slide-in-from-right duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
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
                                <button 
                                    type="button" 
                                    onClick={handleSave} 
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-70"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    {isSaving ? 'Gravando...' : (isNew ? 'Criar Cliente' : 'Confirmar Dados')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <div className="relative group">
                        <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center text-2xl font-black border-4 border-white shadow-xl overflow-hidden transition-all ${isEditing ? 'cursor-pointer ring-2 ring-orange-100' : ''} ${formData.photo_url ? 'bg-white' : 'bg-orange-100 text-orange-600'}`}>
                            {formData.photo_url ? <img src={formData.photo_url} className="w-full h-full object-cover" alt="Avatar" /> : formData.nome?.charAt(0) || '?'}
                        </div>
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
            </nav>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                <div className="max-w-5xl mx-auto space-y-6 pb-24">
                    
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                             
                             <Card title="Contato e Redes Sociais" icon={<Smartphone size={18} />}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <EditField label="WhatsApp / Celular" name="telefone" value={formData.telefone} onChange={handleInputChange} disabled={!isEditing} placeholder="(00) 00000-0000" icon={Phone} />
                                    <EditField label="E-mail Principal" name="email" value={formData.email} onChange={handleInputChange} disabled={!isEditing} placeholder="cliente@email.com" icon={Mail} />
                                    <EditField label="Instagram" name="instagram" value={formData.instagram} onChange={handleInputChange} disabled={!isEditing} placeholder="@usuario" icon={Instagram} />
                                </div>
                             </Card>

                             <Card title="Endereço e Localização" icon={<MapPin size={18} />}>
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                                    <EditField label="CEP" name="cep" value={formData.cep} onChange={handleInputChange} disabled={!isEditing} placeholder="00000-000" icon={Hash} span="col-span-2" />
                                    <EditField label="Logradouro" name="endereco" value={formData.endereco} onChange={handleInputChange} disabled={!isEditing} placeholder="Rua, Av..." icon={Navigation} span="col-span-3" />
                                    <EditField label="Número" name="numero" value={formData.numero} onChange={handleInputChange} disabled={!isEditing} placeholder="123" span="col-span-1" />
                                    <EditField label="Complemento" name="complemento" value={formData.complemento} onChange={handleInputChange} disabled={!isEditing} placeholder="Apto, Bloco..." span="col-span-2" />
                                    <EditField label="Bairro" name="bairro" value={formData.bairro} onChange={handleInputChange} disabled={!isEditing} placeholder="Bairro" span="col-span-2" />
                                    <EditField label="Cidade" name="cidade" value={formData.cidade} onChange={handleInputChange} disabled={!isEditing} placeholder="Cidade" span="col-span-2" />
                                    <EditField label="Estado" name="estado" value={formData.estado} onChange={handleInputChange} disabled={!isEditing} placeholder="UF" span="col-span-2" />
                                </div>
                             </Card>

                             <Card title="Perfil do Cliente" icon={<User size={18} />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <EditField label="Nome Completo" name="nome" value={formData.nome} onChange={handleInputChange} disabled={!isEditing} icon={User} span="md:col-span-2" />
                                    <EditField label="Apelido" name="apelido" value={formData.apelido} onChange={handleInputChange} disabled={!isEditing} icon={Smile} />
                                    <EditField label="CPF" name="cpf" value={formData.cpf} onChange={handleInputChange} disabled={!isEditing} placeholder="000.000.000-00" icon={CreditCard} />
                                    <EditField label="Data de Nascimento" name="nascimento" type="date" value={formData.nascimento} onChange={handleInputChange} disabled={!isEditing} icon={Calendar} />
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Sexo</label>
                                        <select 
                                            name="sexo" 
                                            value={formData.sexo} 
                                            onChange={(e) => setFormData({ ...formData, sexo: e.target.value })} 
                                            disabled={!isEditing} 
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 disabled:opacity-60"
                                        >
                                            <option value="">Selecione</option>
                                            <option value="Feminino">Feminino</option>
                                            <option value="Masculino">Masculino</option>
                                            <option value="Outro">Outro</option>
                                            <option value="Não informado">Não informar</option>
                                        </select>
                                    </div>
                                    <EditField label="Profissão" name="profissao" value={formData.profissao} onChange={handleInputChange} disabled={!isEditing} icon={Briefcase} />
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Como nos conheceu?</label>
                                        <select 
                                            name="origem" 
                                            value={formData.origem} 
                                            onChange={(e) => setFormData({ ...formData, origem: e.target.value })} 
                                            disabled={!isEditing} 
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 disabled:opacity-60"
                                        >
                                            <option value="Instagram">Instagram</option>
                                            <option value="Indicação">Indicação</option>
                                            <option value="Passagem">Passagem</option>
                                            <option value="Google">Google / Maps</option>
                                            <option value="Facebook">Facebook</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </div>
                                </div>
                             </Card>

                             <Card title="Observações Gerais" icon={<FileText size={18} />}>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Anotações Internas</label>
                                    <textarea 
                                        name="observacoes"
                                        value={formData.observacoes}
                                        onChange={handleInputChange}
                                        disabled={!isEditing}
                                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 min-h-[120px] outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-medium text-slate-600 resize-none shadow-sm disabled:opacity-60"
                                        placeholder="Ex: Prefere tons pastéis, tem sensibilidade nos cílios..."
                                    />
                                </div>
                             </Card>

                             {isEditing && (
                                <div className="flex justify-end pt-4">
                                    <button 
                                        onClick={handleSave} 
                                        disabled={isSaving}
                                        className="px-10 py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 shadow-xl transition-all active:scale-95 disabled:opacity-70 flex items-center gap-3"
                                    >
                                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                        {isSaving ? 'Sincronizando...' : 'Salvar Alterações'}
                                    </button>
                                </div>
                             )}
                        </div>
                    )}

                    {activeTab === 'anamnese' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <Card title="Ficha de Saúde Estética" icon={<Activity size={18} />}>
                                <div className="space-y-8">
                                    {[
                                        { key: 'has_allergy', label: 'Possui Alguma Alergia?', hasDetails: true, detailKey: 'allergy_details', placeholder: 'Cite substâncias...' },
                                        { key: 'is_pregnant', label: 'Está Gestante ou Lactante?', hasDetails: false },
                                        { key: 'uses_meds', label: 'Usa Medicamentos Contínuos?', hasDetails: true, detailKey: 'meds_details', placeholder: 'Quais?' }
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

                                    <div className="pt-4 space-y-4">
                                        <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                            <div className="flex-1 w-full space-y-1.5">
                                                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">Carregar Modelo de Ficha</label>
                                                <div className="relative">
                                                    <select 
                                                        value={selectedTemplateId}
                                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                                        className="w-full bg-white border border-orange-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none appearance-none focus:ring-2 focus:ring-orange-200"
                                                    >
                                                        <option value="">Selecione um roteiro...</option>
                                                        {templates.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" size={16} />
                                                </div>
                                            </div>
                                            <button onClick={handleLoadTemplate} disabled={!selectedTemplateId} className="w-full sm:w-auto px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                                                <FilePlus size={16} /> Inserir Modelo
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Observações Clínicas</label>
                                            <textarea 
                                                value={anamnesis.clinical_notes}
                                                onChange={(e) => setAnamnesis({...anamnesis, clinical_notes: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-orange-100"
                                                rows={8}
                                                placeholder="Anotações internas..."
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-100">
                                        <div className="flex justify-between items-end mb-4">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <PenTool size={14}/> Assinatura do Termo de Ciência
                                            </h4>
                                            {anamnesis.signed_at && (
                                                <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg font-black uppercase border border-emerald-100">
                                                    Assinado em {format(parseISO(anamnesis.signed_at), 'dd/MM/yy HH:mm')}
                                                </span>
                                            )}
                                        </div>

                                        {anamnesis.signature_url ? (
                                            <div className="relative group bg-slate-50 rounded-3xl border-2 border-slate-100 p-4 h-56 flex items-center justify-center overflow-hidden">
                                                <img src={anamnesis.signature_url} className="max-h-full max-w-full object-contain mix-blend-multiply" alt="Assinatura" />
                                                <button onClick={() => setAnamnesis({...anamnesis, signature_url: null, signed_at: null})} className="absolute top-4 right-4 p-2 bg-white text-rose-500 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] font-bold uppercase"><Trash2 size={14} /> Refazer</button>
                                            </div>
                                        ) : (
                                            <SignaturePad onSave={handleSaveSignature} isSaving={isSaving} />
                                        )}
                                    </div>
                                    
                                    <button onClick={handleSaveAnamnesis} disabled={isSaving} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Salvar Ficha de Anamnese
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <header className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Galeria de Evolução</h3>
                                <button onClick={() => photoInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-orange-600 flex items-center gap-2 shadow-sm hover:bg-orange-50 transition-all"><Plus size={16} /> Adicionar Foto</button>
                                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !formData.id) return;
                                    setIsUploading(true);
                                    try {
                                        const fileName = `evo_${formData.id}_${Date.now()}.jpg`;
                                        await supabase.storage.from('client-evolution').upload(fileName, file);
                                        const { data: { publicUrl } } = supabase.storage.from('client-evolution').getPublicUrl(fileName);
                                        await supabase.from('client_photos').insert([{ client_id: formData.id, url: publicUrl, type: 'depois' }]);
                                        fetchPhotos();
                                        setToast({ message: "Foto adicionada!", type: 'success' });
                                    } finally { setIsUploading(false); }
                                }} />
                            </header>

                            {photos.length === 0 ? (
                                <div className="bg-white rounded-[32px] p-20 text-center border-2 border-dashed border-slate-100">
                                    <ImageIcon size={48} className="mx-auto text-slate-100 mb-4" />
                                    <p className="text-slate-400 font-bold text-sm">Sem fotos registradas.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {photos.map(photo => (
                                        <div key={photo.id} className="relative aspect-square rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-sm">
                                            <img src={photo.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Evolução" />
                                            <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur rounded-lg text-[9px] font-black text-slate-800 uppercase shadow-sm">{format(parseISO(photo.created_at), 'dd MMM yy')}</div>
                                            <div className="absolute bottom-3 right-3 flex gap-2 translate-y-10 group-hover:translate-y-0 transition-transform duration-300">
                                                <button onClick={() => setZoomImage(photo.url)} className="p-2 bg-white text-slate-600 rounded-xl shadow-lg hover:text-orange-500"><Maximize2 size={14}/></button>
                                                <button onClick={async () => {
                                                    if(confirm("Remover foto?")) {
                                                        await supabase.from('client_photos').delete().eq('id', photo.id);
                                                        fetchPhotos();
                                                    }
                                                }} className="p-2 bg-white text-rose-500 rounded-xl shadow-lg hover:bg-rose-50"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

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
