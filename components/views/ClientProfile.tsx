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
import { differenceInYears, parseISO, isValid, format } from 'date-fns';
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

// --- Componente Interno: Assinatura Digital ---
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
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none text-[8px] font-black text-slate-300 uppercase tracking-[0.4em] z-0 text-center w-full">
                    Documento Assinado Digitalmente via BelareStudio
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
    const { user } = useAuth();
    const isNew = !client.id;
    const [isEditing, setIsEditing] = useState(isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'anamnese' | 'fotos' | 'historico'>('geral');
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    
    const photoInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    
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
        service_value: '',
        payment_method: '',
        clinical_notes: '',
        signed_at: null,
        signature_url: null,
        // Novos campos técnicos
        phototype: '',
        pigment_details: '',
        lot_info: '',
        needle_details: '',
        technique_applied: ''
    });
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [photos, setPhotos] = useState<any[]>([]);

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
        if (client) {
            setFormData({
                id: client.id || null,
                nome: client.nome || '',
                apelido: (client as any).apelido || '',
                telefone: client.telefone || client.whatsapp || '',
                email: client.email || '',
                instagram: (client as any).instagram || '',
                nascimento: (client as any).birth_date || client.nascimento || '',
                cpf: (client as any).cpf || '',
                rg: (client as any).rg || '',
                sexo: (client as any).gender || (client as any).sexo || '',
                profissao: (client as any).occupation || (client as any).profissao || '',
                cep: (client as any).cep || '',
                endereco: (client as any).endereco || '',
                numero: (client as any).numero || '',
                complemento: (client as any).complemento || '',
                bairro: (client as any).bairro || '',
                cidade: (client as any).cidade || '',
                estado: (client as any).estado || '',
                photo_url: client.photo_url || null,
                online_booking_enabled: (client as any).online_booking_enabled ?? true,
                origem: (client as any).referral_source || (client as any).origem || 'Instagram',
                observacoes: (client as any).notes || (client as any).observacoes || ''
            });

            if (client.id) {
                fetchAnamnesis();
                fetchPhotos();
                fetchTemplates();
                refreshClientData();
            }
        }
    }, [client]);

    const refreshClientData = async () => {
        if (!client.id) return;
        const { data } = await supabase.from('clients').select('*').eq('id', client.id).single();
        if (data) {
            setFormData({
                id: data.id,
                nome: data.nome || '',
                apelido: data.apelido || '',
                telefone: data.telefone || data.whatsapp || '',
                email: data.email || '',
                instagram: data.instagram || '',
                nascimento: data.birth_date || '',
                cpf: data.cpf || '',
                rg: data.rg || '',
                sexo: data.gender || '',
                profissao: data.occupation || '',
                cep: data.cep || '',
                endereco: data.endereco || '',
                numero: data.numero || '',
                complemento: data.complemento || '',
                bairro: data.bairro || '',
                cidade: data.cidade || '',
                estado: data.estado || '',
                photo_url: data.photo_url || null,
                online_booking_enabled: data.online_booking_enabled ?? true,
                origem: data.referral_source || 'Instagram',
                observacoes: data.notes || ''
            });
        }
    };

    const fetchAnamnesis = async () => {
        const { data } = await supabase.from('client_anamnesis').select('*').eq('client_id', client.id).maybeSingle();
        if (data) setAnamnesis(data);
    };

    const fetchTemplates = async () => {
        const { data } = await supabase.from('anamnesis_templates').select('id, name, content').order('name');
        if (data) setTemplates(data);
    };

    const handleClearAnamnesisText = () => {
        if (!window.confirm("Deseja realmente limpar todo o texto da ficha? Esta ação não pode ser desfeita.")) return;
        setAnamnesis((prev: any) => ({
            ...prev,
            clinical_notes: ""
        }));
        setToast({ message: "Conteúdo removido!", type: 'info' });
    };

    const handleLoadTemplate = async () => {
        if (!selectedTemplateId) return alert("Selecione um modelo!");
        
        const template = templates.find(t => String(t.id) === String(selectedTemplateId));
        if (!template) return;

        // 1. PREPARAÇÃO DE DADOS
        const hoje = new Date();
        const dataCurta = hoje.toLocaleDateString('pt-BR');
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const dataExtensa = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
        
        const nomeProfissional = user?.nome || user?.user_metadata?.full_name || user?.user_metadata?.name || "JACILENE FÉLIX";
        const emailProfissional = user?.email || user?.user_metadata?.email || "E-mail não identificado";

        let textToInsert = "";
        if (typeof template.content === 'string') {
            textToInsert = template.content
                .replace(/^"|"$/g, '') 
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"');
        } else {
            textToInsert = JSON.stringify(template.content, null, 2);
        }

        // 2. SUBSTITUIÇÕES DE TEXTO (MOTOR DE MERGE INTELIGENTE)

        // A) DATA E LOCALIDADE
        textToInsert = textToInsert.replace(/Igarassu - PE,.*?20.*?(\.|_| )+/gi, `Igarassu - PE, ${dataExtensa}.`);

        // B) DADOS CADASTRAIS
        if (formData.nome) {
            textToInsert = textToInsert.replace(/Nome:\s*_+/gi, `Nome: ${formData.nome.toUpperCase()}`);
        }
        textToInsert = textToInsert.replace(/CPF:\s*_+/gi, `CPF: ${formData.cpf || "Não informado"}`);
        textToInsert = textToInsert.replace(/RG:\s*_+/gi, `RG: ${formData.rg || "________"}`);
        textToInsert = textToInsert.replace(/Telefone:\s*_+/gi, `Telefone: ${formData.telefone || "________"}`);
        
        const enderecoCompleto = formData.endereco 
            ? `${formData.endereco}${formData.numero ? `, ${formData.numero}` : ''}${formData.bairro ? ` - ${formData.bairro}` : ''}` 
            : "____________________";
        textToInsert = textToInsert.replace(/Endereço:\s*_+/gi, `Endereço: ${enderecoCompleto}`);

        // C) DECISÃO DE FOTO
        const statusFotoTexto = anamnesis.photo_authorized ? "AUTORIZO" : "NÃO AUTORIZO";
        textToInsert = textToInsert.replace(/\[STATUS_FOTO\]/gi, statusFotoTexto);

        // D) FINANCEIRO
        const displayValue = anamnesis.service_value || "__________";
        const displayMethod = anamnesis.payment_method || "__________";
        
        textToInsert = textToInsert.replace(/(Valor do Serviço|Valor):\s*R\$?\s*[_ ]+/gi, `$1: R$ ${displayValue} `);
        textToInsert = textToInsert.replace(/(Forma de )?Pagamento:\s*[_ ]+/gi, `$1Pagamento: ${displayMethod} `);

        // E) ASSINATURA E TESTEMUNHA (Inclusão de E-mail para Rastreabilidade Digital)
        const assinaturaBloco = /PROFISSIONAL RESPONSÁVEL[\s\S]*?(?=\n\n|CLIENTE|TESTEMUNHA)/gi;
        const timestampFormatado = `${hoje.getHours().toString().padStart(2, '0')}:${hoje.getMinutes().toString().padStart(2, '0')}`;
        
        const novaAssinatura = `PROFISSIONAL RESPONSÁVEL:\n${nomeProfissional.toUpperCase()}\n(ID Digital: ${emailProfissional})\n(Assinatura Digital validada em ${dataCurta} às ${timestampFormatado})\n\n________________________________________________\nTESTEMUNHA (Opcional)\nCPF:\n`;
        
        if (assinaturaBloco.test(textToInsert)) {
            textToInsert = textToInsert.replace(assinaturaBloco, novaAssinatura);
        } else {
            textToInsert += `\n\n${novaAssinatura}`;
        }

        // 3. ATUALIZAÇÃO DO ESTADO
        setAnamnesis((prev: any) => {
            const current = prev.clinical_notes || "";
            const divider = current.trim() ? "\n\n---\n\n" : "";
            return {
                ...prev,
                clinical_notes: current + divider + textToInsert
            };
        });
        
        setSelectedTemplateId('');
        setToast({ message: "Contrato preenchido automaticamente!", type: 'success' });
    };

    const handleGeneratePDF = async () => {
        setIsLoading(true);
        try {
            const doc = new jsPDF();
            const margin = 20;
            let y = 20;
            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. CABEÇALHO
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("Studio Jacilene Félix", pageWidth / 2, y, { align: 'center' });
            y += 10;
            doc.setFontSize(14);
            doc.text("FICHA DE ANAMNESE E CONTRATO", pageWidth / 2, y, { align: 'center' });
            y += 15;

            // 2. DADOS DO CLIENTE
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("DADOS DO CLIENTE", margin, y);
            y += 7;
            doc.setFont("helvetica", "normal");
            doc.text(`Nome: ${formData.nome.toUpperCase()}`, margin, y);
            y += 5;
            doc.text(`CPF: ${formData.cpf || '---'} | Telefone: ${formData.telefone || '---'}`, margin, y);
            y += 12;

            // 3. RESUMO DE SAÚDE
            doc.setFont("helvetica", "bold");
            doc.text("RESUMO DE SAÚDE / ANAMNESE", margin, y);
            y += 7;
            doc.setFont("helvetica", "normal");

            const healthItems = [
                { label: "Gestante/Lactante", value: anamnesis.is_pregnant },
                { label: "Alergias", value: anamnesis.has_allergy, details: anamnesis.allergy_details },
                { label: "Usa Ácidos", value: anamnesis.uses_acids },
                { label: "Usa Roacutan", value: anamnesis.uses_roacutan },
                { label: "Diabetes", value: anamnesis.has_diabetes },
                { label: "Problema Quelóide", value: anamnesis.has_keloid },
                { label: "Histórico Herpes", value: anamnesis.has_herpes },
                { label: "Autorização de Imagem", value: anamnesis.photo_authorized, isSpecial: true }
            ];

            healthItems.forEach(item => {
                if (y > 270) { doc.addPage(); y = 20; }
                const status = item.value ? "SIM" : "NÃO";
                doc.setFont("helvetica", item.isSpecial ? "bold" : "normal");
                let line = `${item.label}: ${status}`;
                if (item.value && item.details) line += ` (${item.details})`;
                doc.text(line, margin, y);
                y += 5;
            });
            y += 8;

            // 4. FICHA TÉCNICA DO PROCEDIMENTO (Novo bloco)
            doc.setFont("helvetica", "bold");
            doc.text("FICHA TÉCNICA DO PROCEDIMENTO", margin, y);
            y += 7;
            doc.setFont("helvetica", "normal");
            const techLine1 = `Fototipo: ${anamnesis.phototype || '---'} | Técnica: ${anamnesis.technique_applied || '---'}`;
            const techLine2 = `Pigmento: ${anamnesis.pigment_details || '---'}`;
            const techLine3 = `Lote/Validade: ${anamnesis.lot_info || '---'} | Agulha: ${anamnesis.needle_details || '---'}`;
            
            doc.text(techLine1, margin, y); y += 5;
            doc.text(techLine2, margin, y); y += 5;
            doc.text(techLine3, margin, y);
            y += 12;

            // 5. CONTRATO (TEXTO LONGO)
            doc.setFont("helvetica", "bold");
            doc.text("TERMOS DO CONTRATO E CIÊNCIA", margin, y);
            y += 7;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            
            const splitText = doc.splitTextToSize(anamnesis.clinical_notes || "Nenhum termo registrado.", pageWidth - (margin * 2));
            splitText.forEach((line: string) => {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(line, margin, y);
                y += 5;
            });

            // 6. ASSINATURA VISUAL
            if (anamnesis.signature_url) {
                try {
                    const base64Sig = await getBase64FromUrl(anamnesis.signature_url);
                    if (y > 230) { doc.addPage(); y = 20; }
                    y += 15;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.text("ASSINATURA DO CLIENTE (VALIDADA DIGITALMENTE):", pageWidth / 2, y, { align: 'center' });
                    y += 5;
                    const imgWidth = 60;
                    const imgHeight = 25;
                    const xCenter = (pageWidth - imgWidth) / 2;
                    doc.addImage(base64Sig, 'PNG', xCenter, y, imgWidth, imgHeight);
                    y += imgHeight + 5;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7);
                    doc.text(`Identificador de Segurança: ${anamnesis.signature_url.split('/').pop()}`, pageWidth / 2, y, { align: 'center' });
                    y += 4;
                    doc.text(`Assinado em ${format(parseISO(anamnesis.signed_at), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });
                } catch (imgErr) {
                    console.error("Falha ao injetar imagem no PDF:", imgErr);
                    if (y > 250) { doc.addPage(); y = 20; }
                    y += 15;
                    doc.text("__________________________________________", pageWidth / 2, y, { align: 'center' });
                    y += 5;
                    doc.setFont("helvetica", "bold");
                    doc.text("ASSINATURA DIGITAL VINCULADA", pageWidth / 2, y, { align: 'center' });
                    y += 5;
                    doc.setFontSize(7);
                    doc.text(`Timestamp: ${format(parseISO(anamnesis.signed_at), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });
                }
            }

            // 7. RODAPÉ
            const now = format(new Date(), "dd/MM/yyyy HH:mm");
            doc.setFontSize(7);
            doc.text(`Gerado eletronicamente via BelareStudio em ${now}`, pageWidth / 2, 290, { align: 'center' });

            const pdfBlob = doc.output('blob');
            const fileName = `Contrato_${formData.nome.replace(/\s+/g, '_')}.pdf`;

            if (navigator.share && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                await navigator.share({
                    files: [file],
                    title: 'Contrato e Anamnese - Jacilene Félix',
                    text: 'Documento assinado eletronicamente.'
                });
            } else {
                doc.save(fileName);
            }

            setToast({ message: "PDF gerado com sucesso!", type: 'success' });
        } catch (e: any) {
            console.error("PDF Error:", e);
            setToast({ message: "Erro ao gerar PDF.", type: 'error' });
        } finally {
            setIsLoading(false);
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
        const payload = { 
            client_id: client.id,
            has_allergy: anamnesis.has_allergy,
            allergy_details: anamnesis.allergy_details,
            is_pregnant: anamnesis.is_pregnant,
            uses_meds: anamnesis.uses_meds,
            meds_details: anamnesis.meds_details,
            uses_acids: anamnesis.uses_acids,
            acids_details: anamnesis.acids_details,
            uses_roacutan: anamnesis.uses_roacutan,
            roacutan_time: anamnesis.roacutan_time,
            has_diabetes: anamnesis.has_diabetes,
            has_keloid: anamnesis.has_keloid,
            has_herpes: anamnesis.has_herpes,
            uses_anticoagulants: anamnesis.uses_anticoagulants,
            recent_botox: anamnesis.recent_botox,
            has_autoimmune: anamnesis.has_autoimmune,
            cancer_treatment: anamnesis.cancer_treatment,
            has_dermatitis: anamnesis.has_dermatitis,
            aspirin_use: anamnesis.aspirin_use,
            photo_authorized: !!anamnesis.photo_authorized,
            service_value: String(anamnesis.service_value || ''),
            payment_method: String(anamnesis.payment_method || ''),
            clinical_notes: anamnesis.clinical_notes,
            signature_url: anamnesis.signature_url,
            signed_at: anamnesis.signed_at,
            // Persistindo novos campos
            phototype: anamnesis.phototype,
            pigment_details: anamnesis.pigment_details,
            lot_info: anamnesis.lot_info,
            needle_details: anamnesis.needle_details,
            technique_applied: anamnesis.technique_applied
        };
        
        const { error } = await supabase.from('client_anamnesis').upsert(payload, { onConflict: 'client_id' });
        setIsSaving(false);
        if (!error) setToast({ message: "Anamnese salva!", type: 'success' });
        else setToast({ message: "Erro na anamnese: " + error.message, type: 'error' });
    };

    const handleSaveSignature = async (dataUrl: string) => {
        if (!client.id) return;
        setIsSaving(true);
        
        try {
            const blob = dataURLtoBlob(dataUrl);
            if (!blob) throw new Error("Falha ao processar imagem da assinatura.");

            const fileName = `sig_${client.id}_${Date.now()}.png`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('signatures')
                .upload(fileName, blob, { 
                    contentType: 'image/png',
                    upsert: true 
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('signatures')
                .getPublicUrl(fileName);

            const timestamp = new Date().toISOString();

            const { error: dbError } = await supabase
                .from('client_anamnesis')
                .upsert({ 
                    client_id: client.id,
                    signature_url: publicUrl, 
                    signed_at: timestamp 
                }, { onConflict: 'client_id' });

            if (dbError) throw dbError;

            setAnamnesis(prev => ({ ...prev, signature_url: publicUrl, signed_at: timestamp }));
            setToast({ message: "Assinatura vinculada com sucesso!", type: 'success' });
        } catch (e: any) {
            console.error("Signature Save Error:", e);
            setToast({ message: `Erro ao salvar assinatura: ${e.message}`, type: 'error' });
        } finally { 
            setIsSaving(false); 
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !formData.id) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar_${formData.id}_${Date.now()}.${fileExt}`;
            const filePath = `${formData.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from('clients')
                .update({ photo_url: publicUrl })
                .eq('id', formData.id);

            if (dbError) throw dbError;

            setFormData((prev: any) => ({ ...prev, photo_url: publicUrl }));
            setToast({ message: "Foto de perfil atualizada!", type: 'success' });

        } catch (err: any) {
            console.error("Avatar Upload Error:", err);
            setToast({ message: `Erro no upload: ${err.message}`, type: 'error' });
        } finally {
            setIsUploading(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    };

    const handleRemoveAvatar = async () => {
        if (!formData.id || !formData.photo_url) return;
        if (!confirm("Deseja realmente remover a foto de perfil?")) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('clients')
                .update({ photo_url: null })
                .eq('id', formData.id);

            if (error) throw error;
            setFormData((prev: any) => ({ ...prev, photo_url: null }));
            setToast({ message: "Foto removida!", type: 'info' });
        } catch (err: any) {
            console.error("Remove Avatar Error:", err);
            setToast({ message: "Erro ao remover foto.", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!formData.nome) {
            setToast({ message: "Nome é obrigatório.", type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                nome: formData.nome,
                apelido: formData.apelido || null,
                telefone: formData.telefone || null,
                whatsapp: formData.telefone || null,
                email: formData.email || null,
                instagram: formData.instagram || null,
                gender: formData.sexo || null,
                referral_source: formData.origem || 'Outros',
                occupation: formData.profissao || null,
                birth_date: (formData.nascimento && formData.nascimento !== "") ? formData.nascimento : null,
                notes: formData.observacoes || null,
                cep: formData.cep || null,
                endereco: formData.endereco || null,
                numero: formData.numero || null,
                complemento: formData.complemento || null,
                bairro: formData.bairro || null,
                cidade: formData.cidade || null,
                estado: formData.estado || null,
                cpf: formData.cpf || null,
                rg: formData.rg || null,
                online_booking_enabled: !!formData.online_booking_enabled,
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
            console.error("DB Update Error:", err);
            setToast({ 
                message: `Erro ao salvar: ${err.message || "Verifique as permissões de banco."}`, 
                type: 'error' 
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col font-sans animate-in slide-in-from-right duration-300 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <input 
                type="file" 
                ref={avatarInputRef} 
                onChange={handlePhotoUpload} 
                className="hidden" 
                accept="image/*" 
            />

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
                        <div className="relative">
                            <div 
                                onClick={() => isEditing && avatarInputRef.current?.click()}
                                className={`w-20 h-20 rounded-[24px] flex items-center justify-center text-2xl font-black border-4 border-white shadow-xl overflow-hidden transition-all relative
                                    ${isEditing ? 'cursor-pointer hover:ring-4 hover:ring-orange-100 group' : ''} 
                                    ${formData.photo_url ? 'bg-white' : 'bg-orange-100 text-orange-600'}
                                    ${isUploading ? 'opacity-50' : 'opacity-100'}
                                `}
                            >
                                {formData.photo_url ? (
                                    <img src={formData.photo_url} className="w-full h-full object-cover" alt="Avatar" />
                                ) : (
                                    formData.nome?.charAt(0) || '?'
                                )}
                                
                                {isEditing && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploading ? <Loader2 className="text-white animate-spin" size={20} /> : <Camera className="text-white" size={20} />}
                                    </div>
                                )}
                            </div>

                            {isEditing && formData.photo_url && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                                    className="absolute -bottom-1 -right-1 p-1.5 bg-white text-rose-500 rounded-lg shadow-lg border border-slate-100 hover:bg-rose-50 transition-all active:scale-90 z-20"
                                    title="Remover foto"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-slate-800 leading-tight">{formData.nome || 'Novo Cliente'}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">{formData.origem}</span>
                            {(anamnesis.has_allergy || anamnesis.is_pregnant || anamnesis.uses_roacutan) && (
                                <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 flex items-center gap-1">
                                    <AlertCircle size={10}/> Atenção Médica
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

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
                                    <EditField label="RG" name="rg" value={formData.rg} onChange={handleInputChange} disabled={!isEditing} placeholder="000.000.000-0" icon={CreditCard} />
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
                        </div>
                    )}

                    {activeTab === 'anamnese' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <Card title="Checklist de Saúde & Consentimento" icon={<HeartPulse size={20} className="text-rose-500" />}>
                                <div className="space-y-8">
                                    {/* SEÇÃO DE PRIVACIDADE E FOTOS */}
                                    <div className="p-5 bg-orange-50 border-2 border-orange-100 rounded-3xl mb-4 flex items-center justify-between group hover:border-orange-300 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-2xl text-orange-500 shadow-sm border border-orange-100">
                                                <ImageIcon size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">Autoriza uso de fotos (Antes/Depois)?</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Para fins de portfólio e marketing digital</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch 
                                            on={anamnesis.photo_authorized} 
                                            onClick={() => setAnamnesis({...anamnesis, photo_authorized: !anamnesis.photo_authorized})} 
                                        />
                                    </div>

                                    {/* FINANCEIRO */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Acordado (R$)</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                                    <DollarSign size={18} />
                                                </div>
                                                <input 
                                                    type="text"
                                                    value={anamnesis.service_value}
                                                    onChange={(e) => setAnamnesis({...anamnesis, service_value: e.target.value})}
                                                    placeholder="Ex: 350,00"
                                                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-black text-slate-700 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
                                                    <CreditCard size={18} />
                                                </div>
                                                <select 
                                                    value={anamnesis.payment_method}
                                                    onChange={(e) => setAnamnesis({...anamnesis, payment_method: e.target.value})}
                                                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none appearance-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-bold text-slate-700 shadow-sm"
                                                >
                                                    <option value="">Selecione...</option>
                                                    <option value="Pix">Pix</option>
                                                    <option value="Dinheiro">Dinheiro</option>
                                                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                                                    <option value="Cartão de Débito">Cartão de Débito</option>
                                                    <option value="Parcelado">Parcelado</option>
                                                    <option value="Transferência">Transferência</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* NOVA SEÇÃO: AVALIAÇÃO TÉCNICA (PROFISSIONAL) */}
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ClipboardCheck className="text-orange-500" size={18} />
                                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Avaliação Técnica (Profissional)</h4>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fototipo</label>
                                                <select 
                                                    value={anamnesis.phototype} 
                                                    onChange={(e) => setAnamnesis({...anamnesis, phototype: e.target.value})}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50"
                                                >
                                                    <option value="">Selecione</option>
                                                    <option value="1">Fototipo 1 (Muito Clara)</option>
                                                    <option value="2">Fototipo 2 (Clara)</option>
                                                    <option value="3">Fototipo 3 (Morena Clara)</option>
                                                    <option value="4">Fototipo 4 (Morena Moderada)</option>
                                                    <option value="5">Fototipo 5 (Morena Escura)</option>
                                                    <option value="6">Fototipo 6 (Negra)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Técnica Aplicada</label>
                                                <select 
                                                    value={anamnesis.technique_applied} 
                                                    onChange={(e) => setAnamnesis({...anamnesis, technique_applied: e.target.value})}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50"
                                                >
                                                    <option value="">Selecione</option>
                                                    <option value="Fio a Fio">Fio a Fio</option>
                                                    <option value="Shadow">Shadow</option>
                                                    <option value="Híbrida">Híbrida</option>
                                                    <option value="Labial Full">Labial Full</option>
                                                    <option value="Neutralização">Neutralização</option>
                                                    <option value="Outra">Outra</option>
                                                </select>
                                            </div>

                                            <EditField label="Cor / Pigmento" name="pigment_details" value={anamnesis.pigment_details} onChange={(e: any) => setAnamnesis({...anamnesis, pigment_details: e.target.value})} placeholder="Ex: RB Kollors - Jambo" />
                                            <EditField label="Lote / Validade" name="lot_info" value={anamnesis.lot_info} onChange={(e: any) => setAnamnesis({...anamnesis, lot_info: e.target.value})} placeholder="Ex: Lote 123 - Val 2027" />
                                            <EditField label="Agulha / Lâmina" name="needle_details" value={anamnesis.needle_details} onChange={(e: any) => setAnamnesis({...anamnesis, needle_details: e.target.value})} placeholder="Ex: 1 Ponta - 0.30mm" span="md:col-span-2" />
                                        </div>
                                    </div>

                                    {/* CHECKLIST MÉDICO */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                        {[
                                            { key: 'is_pregnant', label: 'Gestante ou Lactante?', hasDetails: false },
                                            { key: 'has_allergy', label: 'Possui Alguma Alergia?', hasDetails: true, detailKey: 'allergy_details', placeholder: 'Cite substâncias (ex: pigmentos, anestésicos, iodo)...' },
                                            { key: 'uses_acids', label: 'Usa Ácidos no Rosto?', hasDetails: true, detailKey: 'acids_details', placeholder: 'Quais ácidos e com qual frequência?' },
                                            { key: 'uses_roacutan', label: 'Usa ou usou Roacutan?', hasDetails: true, detailKey: 'roacutan_time', placeholder: 'Há quanto tempo usa ou parou de usar?' },
                                            { key: 'has_diabetes', label: 'Diabetes?', hasDetails: false },
                                            { key: 'has_keloid', label: 'Problema de Quelóide?', hasDetails: false },
                                            { key: 'has_herpes', label: 'Histórico de Herpes Labial?', hasDetails: false },
                                            { key: 'uses_anticoagulants', label: 'Usa Anticoagulantes?', hasDetails: false },
                                            { key: 'recent_botox', label: 'Fez Botox recentemente (6 meses)?', hasDetails: false },
                                            { key: 'has_autoimmune', label: 'Doenças Autoimunes?', hasDetails: false },
                                            { key: 'cancer_treatment', label: 'Em Tratamento Oncológico (Câncer)?', hasDetails: false },
                                            { key: 'has_dermatitis', label: 'Possui Dermatite ou Lesão no local?', hasDetails: false },
                                            { key: 'aspirin_use', label: 'Tomou Aspirina nos últimos 5 dias?', hasDetails: false }
                                        ].map(q => (
                                            <div key={q.key} className="space-y-3 pb-4 border-b border-slate-50 last:border-0 md:border-b-0">
                                                <div className="flex items-center justify-between gap-4">
                                                    <p className="font-bold text-slate-700 text-sm">{q.label}</p>
                                                    <ToggleSwitch on={anamnesis[q.key]} onClick={() => setAnamnesis({...anamnesis, [q.key]: !anamnesis[q.key]})} />
                                                </div>
                                                {q.hasDetails && anamnesis[q.key] && (
                                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                                        <textarea 
                                                            value={anamnesis[q.detailKey]}
                                                            onChange={(e) => setAnamnesis({...anamnesis, [q.detailKey]: e.target.value})}
                                                            placeholder={q.placeholder}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 shadow-inner"
                                                            rows={1}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* TEMPLATES E NOTAS */}
                                    <div className="pt-4 space-y-4">
                                        <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                            <div className="flex-1 w-full space-y-1.5">
                                                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1">Carregar Modelo de Ficha ou Contrato</label>
                                                <div className="relative">
                                                    <select 
                                                        value={selectedTemplateId}
                                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                                        className="w-full bg-white border border-orange-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none appearance-none focus:ring-2 focus:ring-orange-200"
                                                    >
                                                        <option value="">Selecione um roteiro ou contrato...</option>
                                                        {templates.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" size={16} />
                                                </div>
                                            </div>
                                            <div className="flex w-full sm:w-auto gap-2">
                                                <button onClick={handleLoadTemplate} disabled={!selectedTemplateId} className="flex-1 sm:flex-none px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm">
                                                    <FilePlus size={16} /> Inserir Modelo
                                                </button>
                                                <button onClick={handleClearAnamnesisText} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 rounded-xl text-xs flex items-center justify-center transition-all shadow-sm active:scale-95" title="Limpar tudo">
                                                    <Eraser size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Observações Clínicas / Termos Adicionais</label>
                                            <button 
                                                onClick={handleGeneratePDF}
                                                disabled={isLoading}
                                                className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2 px-3 py-1 bg-white border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                                            >
                                                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                                                Compartilhar Contrato (PDF)
                                            </button>
                                        </div>
                                        <textarea 
                                            value={anamnesis.clinical_notes}
                                            onChange={(e) => setAnamnesis({...anamnesis, clinical_notes: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-orange-100"
                                            rows={12}
                                            placeholder="Anotações internas, corpo do contrato ou recomendações técnicas..."
                                        />
                                    </div>

                                    {/* ASSINATURA */}
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
                                            <div className="relative group bg-slate-50 rounded-3xl border-2 border-slate-100 p-4 h-56 flex items-center justify-center overflow-hidden shadow-inner">
                                                <img src={anamnesis.signature_url} className="max-h-full max-w-full object-contain mix-blend-multiply" alt="Assinatura" />
                                                <button onClick={() => setAnamnesis({...anamnesis, signature_url: null, signed_at: null})} className="absolute top-4 right-4 p-2 bg-white text-rose-500 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] font-bold uppercase border border-rose-50"><Trash2 size={14} /> Refazer</button>
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
                                <button 
                                    onClick={() => photoInputRef.current?.click()} 
                                    disabled={isUploading}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-orange-600 flex items-center gap-2 shadow-sm hover:bg-orange-50 transition-all disabled:opacity-50"
                                >
                                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} 
                                    {isUploading ? 'Enviando...' : 'Adicionar Foto'}
                                </button>
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