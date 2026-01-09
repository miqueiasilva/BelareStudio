
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    X, User, Phone, Mail, Calendar, Edit2, Save, 
    ArrowLeft, Globe, ShoppingBag, History, MoreVertical,
    Plus, CheckCircle, MapPin, Tag, Smartphone, MessageCircle,
    CreditCard, Briefcase, Home, Map, Hash, Info, Settings, 
    Camera, Loader2, FileText, Activity, AlertCircle, Maximize2,
    Trash2, PenTool, Eraser, Check, Image as ImageIcon, Instagram,
    Navigation, Smile, FilePlus, ChevronDown, HeartPulse, ShieldCheck,
    DollarSign, Share2, ClipboardCheck
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { Client } from '../../types';
import { differenceInYears, isValid, format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Toast, { ToastType } from '../shared/Toast';
import { jsPDF } from 'jspdf';

// --- Funções Auxiliares Obrigatórias ---
const dataURLtoBlob = (dataURL: string) => {
  const arr = dataURL.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) return null;
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

const getBase64FromUrl = async (url: string): Promise<string> => {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data as string);
    };
  });
};

interface ClientProfileProps {
    client: Client;
    onClose: () => void;
    onSave: (client: any) => Promise<void>;
}

const SignaturePad = ({ onSave, isSaving }: { onSave: (dataUrl: string) => void, isSaving: boolean }) => {
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
        if (isEmpty || !canvasRef.current) {
            alert("Por favor, assine antes de confirmar.");
            return;
        }
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="space-y-3">
            <div className="relative border-2 border-slate-200 rounded-3xl bg-white overflow-hidden h-56 touch-none shadow-inner group">
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
            </div>
            <div className="flex gap-2">
                <button onClick={clear} disabled={isSaving} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors disabled:opacity-50"><Eraser size={14}/> Limpar</button>
                <button onClick={handleConfirm} disabled={isSaving || isEmpty} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14}/>}
                    Confirmar Assinatura
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
    const { user } = useAuth();
    const isNew = !client.id;
    const [isEditing, setIsEditing] = useState(isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'anamnese' | 'fotos' | 'historico'>('geral');
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const [anamnesis, setAnamnesis] = useState<any>({
        has_allergy: false,
        allergy_details: '',
        is_pregnant: false,
        uses_meds: false,
        meds_details: '',
        uses_acids: false,
        acids_details: '',
        uses_roacutan: false,
        roacutan_time: '',
        has_diabetes: false,
        has_keloid: false,
        has_herpes: false,
        uses_anticoagulants: false,
        recent_botox: false,
        has_autoimmune: false,
        cancer_treatment: false,
        has_dermatitis: false,
        aspirin_use: false,
        photo_authorized: true,
        clinical_notes: '',
        signed_at: null,
        signature_url: null
    });

    const [formData, setFormData] = useState<any>({
        id: client.id || null,
        nome: client.nome || '',
        telefone: client.telefone || client.whatsapp || '',
        email: client.email || '',
        nascimento: client.nascimento || '',
        photo_url: client.photo_url || null,
        notes: (client as any).notes || ''
    });

    useEffect(() => {
        if (client.id) {
            fetchAnamnesis();
        }
    }, [client.id]);

    const fetchAnamnesis = async () => {
        const { data, error } = await supabase.from('client_anamnesis').select('*').eq('client_id', client.id).maybeSingle();
        if (data) setAnamnesis(data);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await onSave(formData);
            setToast({ message: "Perfil atualizado!", type: 'success' });
            setIsEditing(false);
        } catch (e) {
            setToast({ message: "Erro ao salvar.", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAnamnesis = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.from('client_anamnesis').upsert({
                client_id: client.id,
                ...anamnesis
            });
            if (error) throw error;
            setToast({ message: "Anamnese salva!", type: 'success' });
        } catch (e) {
            setToast({ message: "Erro ao salvar anamnese.", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                            <User size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{formData.nome || 'Novo Cliente'}</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Painel de Gestão de Cliente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                        <X size={24} />
                    </button>
                </header>

                <div className="flex bg-white border-b border-slate-100">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'geral' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-400 hover:text-slate-600'}`}>Geral</button>
                    <button onClick={() => setActiveTab('anamnese')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'anamnese' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-400 hover:text-slate-600'}`}>Anamnese</button>
                    <button onClick={() => setActiveTab('fotos')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'fotos' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-400 hover:text-slate-600'}`}>Fotos</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
                    {activeTab === 'geral' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <EditField label="Nome Completo" name="nome" value={formData.nome} onChange={handleInputChange} icon={User} />
                                <EditField label="WhatsApp" name="telefone" value={formData.telefone} onChange={handleInputChange} icon={Phone} />
                                <EditField label="E-mail" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} />
                                <EditField label="Nascimento" name="nascimento" type="date" value={formData.nascimento} onChange={handleInputChange} icon={Calendar} />
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button onClick={handleSaveProfile} disabled={isSaving} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50">
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'anamnese' && (
                        <div className="space-y-8">
                             <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                        <span className="text-xs font-bold text-slate-600">Possui Alergias?</span>
                                        <ToggleSwitch on={anamnesis.has_allergy} onClick={() => setAnamnesis({...anamnesis, has_allergy: !anamnesis.has_allergy})} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                        <span className="text-xs font-bold text-slate-600">Está Gestante?</span>
                                        <ToggleSwitch on={anamnesis.is_pregnant} onClick={() => setAnamnesis({...anamnesis, is_pregnant: !anamnesis.is_pregnant})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações Clínicas</label>
                                    <textarea 
                                        value={anamnesis.clinical_notes} 
                                        onChange={(e) => setAnamnesis({...anamnesis, clinical_notes: e.target.value})}
                                        className="w-full h-40 mt-1 p-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-orange-100 transition-all text-sm font-medium text-slate-700"
                                        placeholder="Descreva tratamentos, medicações ou cuidados especiais..."
                                    />
                                </div>
                             </div>
                             <div className="flex justify-end">
                                <button onClick={handleSaveAnamnesis} disabled={isSaving} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50">
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    Salvar Anamnese
                                </button>
                             </div>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="text-center py-20">
                            <ImageIcon size={48} className="text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold">Galeria de acompanhamento em breve.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientProfile;
