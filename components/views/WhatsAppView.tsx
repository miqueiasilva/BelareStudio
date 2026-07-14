import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, MoreVertical, Paperclip, Send, Smile, Check, CheckCheck, 
    MessageSquare, Bell, Calendar, Heart, Star, Clock, Zap, 
    Link as LinkIcon, Smartphone, Wifi, WifiOff, LogOut, ChevronLeft, 
    ArrowLeft, CheckCircle2, User, Camera, Shield, Signal, Battery,
    QrCode, RefreshCw, Info, Settings, ShieldCheck, KeyRound, Globe, Phone,
    Megaphone, Copy, Sparkles, Users, AlertTriangle, HelpCircle
} from 'lucide-react';
import { mockConversations } from '../../data/mockData';
import { ChatConversation, ChatMessage } from '../../types';
import { format, addHours, addDays } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';

// --- Componente de Simulador de Smartphone ---
const PhonePreview = ({ type, time, active }: { type: string, time: string, active: boolean }) => {
    const getMessageText = () => {
        const clientName = "*Maria Silva*";
        const studioName = "*BelareStudio*";
        
        switch (type) {
            case 'confirmation':
                return `Olá, ${clientName}! 👋 Aqui é do ${studioName}. Passando para confirmar seu agendamento de amanhã às 14:00. Podemos confirmar?`;
            case 'reminder':
                return `Oi, ${clientName}! 🌸 Só lembrando que seu horário conosco é daqui a ${time} ${Number(time) > 1 ? 'horas' : 'hora'}. Até logo!`;
            case 'feedback':
                return `Oi, ${clientName}! ✨ Adoramos te atender hoje. Poderia nos contar o que achou do serviço? Leva apenas 30 segundos: [link-da-pesquisa]`;
            case 'birthday':
                return `Parabéns, ${clientName}! 🎉 O ${studioName} te deseja um dia maravilhoso. Como presente, você tem 15% de desconto em qualquer serviço este mês! 🎁`;
            default:
                return "Selecione uma automação para visualizar.";
        }
    };

    return (
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            {/* Chassi do Celular */}
            <div className="relative w-[280px] h-[560px] bg-slate-900 rounded-[3rem] border-[8px] border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-20"></div>
                
                {/* Status Bar */}
                <div className="h-10 bg-white flex items-end justify-between px-6 pb-1 text-[10px] font-black text-slate-800">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                        <Signal size={10} />
                        <Wifi size={10} />
                        <Battery size={10} />
                    </div>
                </div>

                {/* WhatsApp Header Mockup */}
                <div className="bg-[#075e54] text-white p-3 pt-4 flex items-center gap-2 shadow-md">
                    <ArrowLeft size={16} />
                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-white/20">
                        <img src="https://i.pravatar.cc/100?u=studio" className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">BelareStudio Prime</p>
                        <p className="text-[8px] opacity-80">online</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                    </div>
                </div>

                {/* Chat Background */}
                <div className="absolute inset-0 top-[88px] bg-[#e5ddd5] z-0 opacity-100" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: '200px' }}></div>

                {/* Messages Container */}
                <div className="relative z-10 p-4 space-y-4 flex flex-col pt-6">
                    <div className="self-center bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm mb-2">Hoje</div>
                    
                    {!active ? (
                        <div className="self-center bg-white/80 backdrop-blur-sm p-4 rounded-2xl text-center border border-slate-200/50">
                            <Zap size={20} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-[10px] text-slate-400 font-bold leading-tight uppercase tracking-tighter">Ative esta automação<br/>para simular o envio</p>
                        </div>
                    ) : (
                        <div className="bg-[#dcf8c6] p-3 rounded-2xl rounded-tr-none shadow-sm relative animate-in slide-in-from-right-4 duration-300 ml-auto max-w-[90%]">
                            <p className="text-[11px] text-slate-800 leading-relaxed">
                                {getMessageText()}
                            </p>
                            <div className="flex justify-end items-center gap-1 mt-1">
                                <span className="text-[8px] text-slate-400 font-bold">09:41</span>
                                <CheckCheck size={10} className="text-blue-500" />
                            </div>
                            {/* Tail */}
                            <div className="absolute -right-1.5 top-0 w-4 h-4 bg-[#dcf8c6]" style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 0)' }}></div>
                        </div>
                    )}
                </div>

                {/* Footer Bar Mockup */}
                <div className="absolute bottom-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md flex items-center px-4 gap-2 border-t border-slate-200">
                    <div className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 font-bold text-xs">+</div>
                    <div className="flex-1 bg-slate-100 h-8 rounded-full border border-slate-200"></div>
                    <Camera size={18} className="text-slate-400" />
                    <User size={18} className="text-slate-400" />
                </div>
            </div>
            <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-200/50 px-4 py-2 rounded-full">Simulador em Tempo Real</p>
        </div>
    );
};

// --- Subcomponente de Card de Automação ---
const AutomationCard = ({ 
    icon: Icon, title, description, active, onToggle, 
    timeValue, onTimeChange, hasTimeSelect = false, onPreview, isSelected 
}: any) => (
    <div 
        onClick={onPreview}
        className={`p-5 rounded-[32px] border-2 transition-all duration-300 cursor-pointer ${
            isSelected 
            ? 'bg-white border-orange-500 shadow-xl shadow-orange-100 translate-x-1' 
            : active 
                ? 'bg-white border-slate-100 hover:border-orange-200 shadow-sm' 
                : 'bg-slate-50 border-slate-100 opacity-60'
        }`}
    >
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl flex-shrink-0 transition-all ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-slate-200 text-slate-400'}`}>
                    <Icon size={20} />
                </div>
                <div className="space-y-1">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                        {title}
                        {hasTimeSelect && active && (
                            <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                                <select 
                                    value={timeValue}
                                    onChange={(e) => onTimeChange(e.target.value)}
                                    className="appearance-none bg-orange-50 border border-orange-100 text-orange-600 px-2 py-0.5 pr-6 rounded-lg text-[10px] font-black uppercase tracking-tighter focus:ring-2 focus:ring-orange-200 outline-none cursor-pointer hover:bg-orange-100 transition-colors"
                                >
                                    <option value="1">1h</option>
                                    <option value="2">2h</option>
                                    <option value="4">4h</option>
                                    <option value="24">24h</option>
                                    <option value="48">48h</option>
                                </select>
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none">
                                    <ChevronDown size={10} strokeWidth={3} />
                                </div>
                            </div>
                        )}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{description}</p>
                </div>
            </div>
            <div className="flex-shrink-0 pt-1" onClick={e => e.stopPropagation()}>
                <ToggleSwitch on={active} onClick={onToggle} />
            </div>
        </div>
    </div>
);

const ChevronDown = ({ size, strokeWidth, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth || 3} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m6 9 6 6 6-6"/>
    </svg>
);

const WhatsAppView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const [activeTab, setActiveTab] = useState<'chats' | 'automations' | 'campaigns' | 'connection'>('chats');
    const [conversations, setConversations] = useState<ChatConversation[]>(mockConversations);
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [activePreview, setActivePreview] = useState<'confirmation' | 'reminder' | 'feedback' | 'birthday'>('confirmation');

    // --- State: Campanhas & Modelos ---
    const [campaignSubTab, setCampaignSubTab] = useState<'templates' | 'disparo'>('templates');
    const [allClientsForCampaign, setAllClientsForCampaign] = useState<any[]>([]);
    const [loadingCampaignClients, setLoadingCampaignClients] = useState(false);
    const [campaignAppointments, setCampaignAppointments] = useState<any[]>([]);
    const [promoDiscount, setPromoDiscount] = useState('15% de Desconto');
    const [promoLink, setPromoLink] = useState('');
    const [selectedSegment, setSelectedSegment] = useState<'all' | 'ativo' | 'ausente' | 'esquecido' | 'sem_atendimento'>('all');
    
    // For bulk broadcasting progress
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [broadcastProgress, setBroadcastProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
    const [broadcastLogs, setBroadcastLogs] = useState<any[]>([]);

    const activeChat = conversations.find(c => c.id === selectedChatId);

    // --- State: Automações ---
    const [automations, setAutomations] = useState({
        confirmation: { active: true, time: "24" },
        reminder: { active: true, time: "2" },
        feedback: { active: true },
        birthday: { active: false }
    });

    const updateAutomation = (key: keyof typeof automations, field: 'active' | 'time', value: any) => {
        setAutomations(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
        if (field === 'active') {
            showToast(`Automação ${value ? 'ativada' : 'pausada'}.`, 'info');
        }
    };

    // --- Connection State ---
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'qr_ready' | 'connected'>('connected');

    // --- Meta WhatsApp API Configuration State ---
    const [metaSettings, setMetaSettings] = useState({
        connectionType: 'mock' as 'mock' | 'meta_api',
        meta_whatsapp_token: '',
        meta_whatsapp_phone_number_id: '',
        meta_whatsapp_business_account_id: '',
        meta_whatsapp_template_name: '',
        meta_whatsapp_language: 'pt_BR',
        meta_whatsapp_active: false,
        meta_whatsapp_template_params: 'Cliente de Teste, Manicure & Pedicure, Profissional de Teste, Amanhã, 14:00, Link de Confirmação'
    });
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [metaTemplateError, setMetaTemplateError] = useState<{ code?: number; message: string; templateName: string; language: string; variablesCount: number } | null>(null);

    useEffect(() => {
        if (!activeStudioId) return;
        const loadSettings = async () => {
            setIsLoadingSettings(true);
            try {
                // 1. Tenta carregar do Supabase
                const { data, error } = await supabase
                    .from('business_settings')
                    .select('*')
                    .eq('studio_id', activeStudioId)
                    .maybeSingle();

                // 2. Tenta carregar do local storage fallback (se houver dados salvos lá)
                let localData: any = {};
                try {
                    const localStr = window.safeLocalStorage?.getItem(`meta_whatsapp_settings_${activeStudioId}`);
                    if (localStr) {
                        localData = JSON.parse(localStr);
                    }
                } catch (localErr) {
                    console.warn("Erro ao carregar configurações locais de WhatsApp:", localErr);
                }

                // Mescla os dados do banco com os locais (dando preferência ao banco se os dados existirem lá, senão usa os locais)
                const mergedData = { ...localData, ...data };

                setMetaSettings({
                    connectionType: mergedData.meta_whatsapp_active ? 'meta_api' : 'mock',
                    meta_whatsapp_token: mergedData.meta_whatsapp_token || '',
                    meta_whatsapp_phone_number_id: mergedData.meta_whatsapp_phone_number_id || '',
                    meta_whatsapp_business_account_id: mergedData.meta_whatsapp_business_account_id || '',
                    meta_whatsapp_template_name: mergedData.meta_whatsapp_template_name || '',
                    meta_whatsapp_language: mergedData.meta_whatsapp_language || 'pt_BR',
                    meta_whatsapp_active: !!mergedData.meta_whatsapp_active,
                    meta_whatsapp_template_params: mergedData.meta_whatsapp_template_params || 'Cliente de Teste, Manicure & Pedicure, Profissional de Teste, Amanhã, 14:00, Link de Confirmação'
                });
            } catch (err) {
                console.error("Erro ao carregar configurações de WhatsApp:", err);
            } finally {
                setIsLoadingSettings(false);
            }
        };
        loadSettings();
    }, [activeStudioId]);

    // --- Fetch Campaign Clients and Appointments ---
    useEffect(() => {
        if (!activeStudioId) return;
        const fetchClientsAndAppointments = async () => {
            setLoadingCampaignClients(true);
            try {
                const { data: clientsData, error: clientsErr } = await supabase
                    .from('clients')
                    .select('id, nome, whatsapp, telefone')
                    .eq('studio_id', activeStudioId);
                if (clientsErr) throw clientsErr;
                setAllClientsForCampaign(clientsData || []);

                const { data: appData, error: appErr } = await supabase
                    .from('appointments')
                    .select('client_id, date, status')
                    .eq('studio_id', activeStudioId)
                    .neq('status', 'cancelado');
                if (!appErr && appData) {
                    setCampaignAppointments(appData);
                }
            } catch (err) {
                console.error("Erro ao carregar dados de campanha:", err);
            } finally {
                setLoadingCampaignClients(false);
            }
        };
        fetchClientsAndAppointments();
    }, [activeStudioId, activeTab]); // Reload when tab changes too

    const campaignClientsWithStatus = useMemo(() => {
        const visitMap: Record<number, string> = {};
        campaignAppointments.forEach(app => {
            if (!app.client_id) return;
            const isRealVisit = ['concluido', 'chegou', 'confirmado', 'confirmado_whatsapp', 'em_atendimento'].includes(app.status);
            if (!isRealVisit) return;
            const existing = visitMap[app.client_id];
            if (!existing || new Date(app.date) > new Date(existing)) {
                visitMap[app.client_id] = app.date;
            }
        });

        return allClientsForCampaign.map(c => {
            const lastVisit = visitMap[c.id];
            if (!lastVisit) {
                return { ...c, status: 'sem_atendimento', days: null };
            }
            const diffTime = Math.abs(new Date().getTime() - new Date(lastVisit).getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 20) {
                return { ...c, status: 'ativo', days: diffDays };
            } else if (diffDays >= 20 && diffDays <= 30) {
                return { ...c, status: 'ausente', days: diffDays };
            } else {
                return { ...c, status: 'esquecido', days: diffDays };
            }
        });
    }, [allClientsForCampaign, campaignAppointments]);

    const filteredCampaignClients = useMemo(() => {
        return campaignClientsWithStatus.filter(c => {
            if (selectedSegment === 'all') return true;
            return c.status === selectedSegment;
        });
    }, [campaignClientsWithStatus, selectedSegment]);

    const handleAutoConfigureTemplate = async (templateName: string, isMarketing = false) => {
        const paramsValue = isMarketing 
            ? 'Nome do Cliente, Cupom/Desconto, Link de Agendamento' 
            : 'Nome do Cliente, Procedimento, Profissional, Data, Hora, Link de Confirmação';
        
        const updated = {
            ...metaSettings,
            meta_whatsapp_template_name: templateName,
            meta_whatsapp_template_params: paramsValue
        };
        
        setMetaSettings(updated);
        
        if (!activeStudioId) return;
        setIsSavingSettings(true);
        try {
            const localPayload = {
                meta_whatsapp_token: updated.meta_whatsapp_token.trim(),
                meta_whatsapp_phone_number_id: updated.meta_whatsapp_phone_number_id.trim(),
                meta_whatsapp_business_account_id: updated.meta_whatsapp_business_account_id.trim(),
                meta_whatsapp_template_name: templateName,
                meta_whatsapp_language: updated.meta_whatsapp_language,
                meta_whatsapp_active: updated.connectionType === 'meta_api',
                meta_whatsapp_template_params: paramsValue,
            };

            window.safeLocalStorage?.setItem(
                `meta_whatsapp_settings_${activeStudioId}`,
                JSON.stringify(localPayload)
            );

            const fullPayload = {
                id: activeStudioId,
                studio_id: activeStudioId,
                ...localPayload,
                updated_at: new Date().toISOString()
            };

            await supabase
                .from('business_settings')
                .upsert(fullPayload, { onConflict: 'studio_id' });

            showToast(`Modelo '${templateName}' configurado e ativado como padrão!`, "success");
        } catch (err: any) {
            console.error("Erro ao salvar configuração automática:", err);
            showToast(`Erro ao salvar: ${err.message}`, "error");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleStartCampaignBroadcast = async () => {
        if (filteredCampaignClients.length === 0) {
            showToast("Nenhum cliente elegível encontrado para este segmento.", "info");
            return;
        }

        const isMetaActive = metaSettings.connectionType === 'meta_api' && !!metaSettings.meta_whatsapp_token && !!metaSettings.meta_whatsapp_phone_number_id;

        setIsBroadcasting(true);
        setBroadcastProgress({
            total: filteredCampaignClients.length,
            current: 0,
            success: 0,
            failed: 0
        });
        setBroadcastLogs([]);

        for (let i = 0; i < filteredCampaignClients.length; i++) {
            const client = filteredCampaignClients[i];
            const clientName = client.nome;
            const phone = client.whatsapp || client.telefone || '';
            const cleanPhone = phone.replace(/\D/g, '');

            const logId = Date.now() + '-' + i;
            setBroadcastLogs(prev => [
                { id: logId, clientName, phone: phone || 'Sem número', status: 'sending' },
                ...prev
            ]);

            let success = false;
            let errorMsg = '';

            if (isMetaActive && cleanPhone) {
                try {
                    let recipientPhone = cleanPhone;
                    if (recipientPhone.length === 10 || recipientPhone.length === 11) {
                        recipientPhone = '55' + recipientPhone;
                    }

                    const url = `https://graph.facebook.com/v21.0/${metaSettings.meta_whatsapp_phone_number_id.trim()}/messages`;
                    const fallbackLink = `${window.location.origin}/#/public-preview?sid=${activeStudioId}`;
                    
                    const body = {
                        messaging_product: "whatsapp",
                        to: recipientPhone,
                        type: "template",
                        template: {
                            name: metaSettings.meta_whatsapp_template_name || 'promocao_especial',
                            language: {
                                code: metaSettings.meta_whatsapp_language || 'pt_BR'
                            },
                            components: [
                                {
                                    type: "body",
                                    parameters: [
                                        { type: "text", text: clientName },
                                        { type: "text", text: promoDiscount },
                                        { type: "text", text: promoLink || fallbackLink }
                                    ]
                                }
                            ]
                        }
                    };

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${metaSettings.meta_whatsapp_token.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    });

                    const resData = await response.json();
                    if (response.ok) {
                        success = true;
                    } else {
                        errorMsg = resData?.error?.message || "Erro na API da Meta.";
                    }
                } catch (err: any) {
                    errorMsg = err.message || "Erro de rede.";
                }
            } else {
                // Simulation mode
                await new Promise(resolve => setTimeout(resolve, 800));
                if (!cleanPhone) {
                    errorMsg = "Sem telefone de contato.";
                } else {
                    success = true;
                }
            }

            setBroadcastProgress(prev => ({
                ...prev,
                current: i + 1,
                success: prev.success + (success ? 1 : 0),
                failed: prev.failed + (success ? 0 : 1)
            }));

            setBroadcastLogs(prev => prev.map(log => {
                if (log.id === logId) {
                    return {
                        ...log,
                        status: success ? 'success' : 'failed',
                        error: errorMsg
                    };
                }
                return log;
            }));

            if (success && activeStudioId) {
                try {
                    await supabase.from('whatsapp_reminders_log').insert([{
                        studio_id: activeStudioId,
                        client_name: clientName,
                        phone: cleanPhone,
                        sender: isMetaActive ? 'API Oficial Meta - Campanha' : 'Campanha Simulada'
                    }]);
                } catch (logErr) {
                    console.error("Erro ao gravar log da campanha:", logErr);
                }
            }
        }

        setIsBroadcasting(false);
        showToast("Disparo em massa de campanha finalizado!", "success");
    };

    const handleSaveSettings = async () => {
        if (!activeStudioId) {
            showToast("Erro: Nenhum estúdio ativo encontrado.", "error");
            return;
        }
        setIsSavingSettings(true);
        try {
            // 1. Primeiro salvamos tudo localmente no safeLocalStorage
            const localPayload = {
                meta_whatsapp_token: metaSettings.meta_whatsapp_token.trim(),
                meta_whatsapp_phone_number_id: metaSettings.meta_whatsapp_phone_number_id.trim(),
                meta_whatsapp_business_account_id: metaSettings.meta_whatsapp_business_account_id.trim(),
                meta_whatsapp_template_name: metaSettings.meta_whatsapp_template_name.trim(),
                meta_whatsapp_language: metaSettings.meta_whatsapp_language,
                meta_whatsapp_active: metaSettings.connectionType === 'meta_api',
                meta_whatsapp_template_params: metaSettings.meta_whatsapp_template_params,
            };

            try {
                window.safeLocalStorage?.setItem(
                    `meta_whatsapp_settings_${activeStudioId}`,
                    JSON.stringify(localPayload)
                );
            } catch (localErr) {
                console.warn("Erro ao salvar localmente no safeLocalStorage:", localErr);
            }

            // 2. Tenta fazer o upsert no Supabase, mas FILTRANDO as colunas de forma segura!
            // Para isso, fazemos uma requisição segura. Se a tabela/colunas não existirem ou retornar erro 400 por falta de coluna,
            // tentamos salvar apenas com as colunas conhecidas que existem (id, studio_id, updated_at).
            
            const fullPayload = {
                id: activeStudioId,
                studio_id: activeStudioId,
                ...localPayload,
                updated_at: new Date().toISOString()
            };

            // Primeiro tenta salvar o payload completo
            const { error: upsertError } = await supabase
                .from('business_settings')
                .upsert(fullPayload, { onConflict: 'studio_id' });

            if (upsertError) {
                console.warn("Falha ao salvar payload completo no Supabase (colunas ausentes). Tentando salvamento seguro...", upsertError);
                
                // Se falhou por erro de colunas (ex: PGRST204 ou bad request 400), tentamos salvar apenas os campos básicos que garantidamente existem
                const safePayload = {
                    id: activeStudioId,
                    studio_id: activeStudioId,
                    updated_at: new Date().toISOString()
                };

                const { error: safeUpsertError } = await supabase
                    .from('business_settings')
                    .upsert(safePayload, { onConflict: 'studio_id' });

                if (safeUpsertError) {
                    throw safeUpsertError;
                }
                
                console.log("Configurações básicas salvas no Supabase. Campos do WhatsApp salvos com sucesso no safeLocalStorage!");
            }

            showToast("Configurações salvas com sucesso!", "success");
        } catch (err: any) {
            console.error("Erro ao salvar configurações:", err);
            showToast(`Erro ao salvar: ${err.message}`, "error");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleSendTestMessage = async () => {
        if (!testPhone.trim()) {
            showToast("Digite um número de telefone de teste.", "info");
            return;
        }

        const tokenClean = metaSettings.meta_whatsapp_token.trim();
        const phoneIdClean = metaSettings.meta_whatsapp_phone_number_id.trim();
        const templateNameClean = metaSettings.meta_whatsapp_template_name.trim();

        if (!tokenClean || !phoneIdClean) {
            showToast("Preencha o Token e o ID do Número antes de testar.", "error");
            return;
        }

        setIsSendingTest(true);
        try {
            let cleanPhone = testPhone.replace(/\D/g, '');
            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                cleanPhone = '55' + cleanPhone;
            }

            const url = `https://graph.facebook.com/v21.0/${phoneIdClean}/messages`;

            const hasTemplate = !!templateNameClean;

            const parameterList = metaSettings.meta_whatsapp_template_params
                ? metaSettings.meta_whatsapp_template_params.split(',').map(item => item.trim()).filter(Boolean)
                : [];

            const body = hasTemplate ? {
                messaging_product: "whatsapp",
                to: cleanPhone,
                type: "template",
                template: {
                    name: templateNameClean,
                    language: {
                        code: metaSettings.meta_whatsapp_language || 'pt_BR'
                    },
                    components: parameterList.length > 0 ? [
                        {
                            type: "body",
                            parameters: parameterList.map(text => ({ type: "text", text }))
                        }
                    ] : []
                }
            } : {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanPhone,
                type: "text",
                text: {
                    preview_url: false,
                    body: "Olá! Este é um teste do sistema de lembretes automáticos do Belare Studio via API Oficial da Meta. Funcionou perfeitamente! 🚀"
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenClean}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const resData = await response.json();
            if (!response.ok) {
                let errMsg = resData?.error?.message || "Erro desconhecido na API da Meta.";
                if (resData?.error?.code === 132001 || errMsg.includes("132001") || errMsg.includes("does not exist in the translation")) {
                    setMetaTemplateError({
                        code: 132001,
                        message: resData?.error?.message || errMsg,
                        templateName: templateNameClean,
                        language: metaSettings.meta_whatsapp_language,
                        variablesCount: parameterList.length
                    });
                    errMsg = `Erro (#132001): O modelo '${templateNameClean}' não existe, não está aprovado ou o idioma '${metaSettings.meta_whatsapp_language}' não corresponde ao cadastrado no painel da Meta. Verifique se o nome do modelo está idêntico e tente idiomas como 'pt' ou 'pt_BR'. Além disso, certifique-se de que o número de variáveis enviadas (${parameterList.length}) corresponde ao seu modelo no Facebook. (Retorno original da Meta: ${resData?.error?.message || errMsg})`;
                } else {
                    setMetaTemplateError({
                        message: resData?.error?.message || errMsg,
                        templateName: templateNameClean,
                        language: metaSettings.meta_whatsapp_language,
                        variablesCount: parameterList.length
                    });
                }
                throw new Error(errMsg);
            }

            setMetaTemplateError(null);
            showToast("Mensagem de teste enviada com sucesso!", "success");

            try {
                await supabase.from('whatsapp_reminders_log').insert([{
                    studio_id: activeStudioId,
                    client_name: 'Cliente de Teste',
                    phone: cleanPhone,
                    sender: 'API Oficial Meta'
                }]);
            } catch (logErr) {
                console.error("Erro ao registrar log de teste:", logErr);
            }

        } catch (err: any) {
            console.error("Erro ao enviar mensagem de teste:", err);
            showToast(`Falha no envio: ${err.message}`, "error");
        } finally {
            setIsSendingTest(false);
        }
    };

    // --- Handlers ---
    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const copyToClipboard = (text: string) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showToast("Texto do modelo copiado com sucesso!", "success");
                })
                .catch(err => {
                    console.error("Erro ao copiar texto:", err);
                    showToast("Erro ao copiar texto. Por favor, selecione e copie manualmente.", "error");
                });
        } else {
            // Fallback for older browsers or iframe constraints
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";  // avoid scrolling to bottom
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    showToast("Texto do modelo copiado com sucesso!", "success");
                } else {
                    showToast("Erro ao copiar texto. Por favor, selecione e copie manualmente.", "error");
                }
            } catch (err) {
                console.error("Fallback: Erro ao copiar texto:", err);
                showToast("Erro ao copiar texto. Por favor, selecione e copie manualmente.", "error");
            }
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!messageInput.trim() || !selectedChatId) return;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: messageInput,
            timestamp: new Date(),
            status: 'sent'
        };

        setConversations(prev => prev.map(c => {
            if (c.id === selectedChatId) {
                return {
                    ...c,
                    messages: [...c.messages, newMessage],
                    lastMessage: newMessage.text,
                    lastMessageTime: newMessage.timestamp
                };
            }
            return c;
        }));

        setMessageInput('');
    };

    return (
        <div className="flex h-full bg-slate-100 overflow-hidden relative font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* SIDEBAR (Lista de Contatos / Menu) */}
            <div className={`
                ${selectedChatId !== null ? 'hidden md:flex' : 'flex w-full md:w-80'} 
                bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20
            `}>
                <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-sm shadow-green-100">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <h2 className="font-black text-slate-700 tracking-tight">WhatsApp</h2>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => setActiveTab('chats')} className={`p-2 rounded-lg transition-all ${activeTab === 'chats' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`} title="Conversas"><MessageSquare size={18} /></button>
                        <button onClick={() => setActiveTab('automations')} className={`p-2 rounded-lg transition-all ${activeTab === 'automations' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`} title="Automações"><Zap size={18} /></button>
                        <button onClick={() => setActiveTab('campaigns')} className={`p-2 rounded-lg transition-all ${activeTab === 'campaigns' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`} title="Campanhas"><Megaphone size={18} /></button>
                        <button onClick={() => setActiveTab('connection')} className={`p-2 rounded-lg transition-all ${activeTab === 'connection' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`} title="Conexão"><LinkIcon size={18} /></button>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                    {activeTab === 'chats' && (
                        <>
                            <div className="p-4 bg-white border-b border-slate-100 sticky top-0 z-10">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Pesquisar..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-green-100 border-transparent focus:border-green-200 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 bg-white">
                                {conversations
                                    .filter(c => c.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(chat => (
                                    <button
                                        key={chat.id}
                                        onClick={() => setSelectedChatId(chat.id)}
                                        className={`w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-all border-b border-transparent active:bg-green-50 ${selectedChatId === chat.id ? 'bg-green-50/50 border-l-4 border-l-green-500' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-500 font-black overflow-hidden border-2 border-white shadow-sm">
                                            {chat.clientAvatar ? <img src={chat.clientAvatar} className="w-full h-full object-cover" alt="" /> : chat.clientName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <h3 className="font-bold text-slate-800 truncate text-sm">{chat.clientName}</h3>
                                                <span className="text-[9px] font-black text-slate-400 uppercase">
                                                    {format(new Date(chat.lastMessageTime), 'HH:mm')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate leading-tight">{chat.lastMessage}</p>
                                        </div>
                                        {chat.unreadCount > 0 && (
                                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white font-black flex-shrink-0">
                                                {chat.unreadCount}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    
                    {activeTab === 'automations' && (
                        <div className="p-4 space-y-4">
                            <header className="mb-4">
                                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Mensagens Automáticas</h2>
                                <p className="text-[10px] text-slate-500 mt-1 ml-1">Selecione uma regra para visualizar no simulador.</p>
                            </header>

                            <AutomationCard 
                                icon={Calendar}
                                title="Confirmação de Agenda"
                                description="Pergunta se o cliente comparecerá."
                                active={automations.confirmation.active}
                                isSelected={activePreview === 'confirmation'}
                                onPreview={() => setActivePreview('confirmation')}
                                onToggle={() => updateAutomation('confirmation', 'active', !automations.confirmation.active)}
                                hasTimeSelect
                                timeValue={automations.confirmation.time}
                                onTimeChange={(val: any) => updateAutomation('confirmation', 'time', val)}
                            />

                            <AutomationCard 
                                icon={Clock}
                                title="Lembrete Antecipado"
                                description="Aviso cordial de horário próximo."
                                active={automations.reminder.active}
                                isSelected={activePreview === 'reminder'}
                                onPreview={() => setActivePreview('reminder')}
                                onToggle={() => updateAutomation('reminder', 'active', !automations.reminder.active)}
                                hasTimeSelect
                                timeValue={automations.reminder.time}
                                onTimeChange={(val: any) => updateAutomation('reminder', 'time', val)}
                            />

                            <AutomationCard 
                                icon={Star}
                                title="Pesquisa de Satisfação"
                                description="Envia link após o serviço."
                                active={automations.feedback.active}
                                isSelected={activePreview === 'feedback'}
                                onPreview={() => setActivePreview('feedback')}
                                onToggle={() => updateAutomation('feedback', 'active', !automations.feedback.active)}
                            />

                            <AutomationCard 
                                icon={Heart}
                                title="Parabéns / Aniversário"
                                description="Mensagem com cupom de desconto."
                                active={automations.birthday.active}
                                isSelected={activePreview === 'birthday'}
                                onPreview={() => setActivePreview('birthday')}
                                onToggle={() => updateAutomation('birthday', 'active', !automations.birthday.active)}
                            />
                        </div>
                    )}

                    {activeTab === 'campaigns' && (
                        <div className="p-4 space-y-4">
                            <header className="mb-4">
                                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Campanhas</h2>
                                <p className="text-[10px] text-slate-500 mt-1 ml-1">Homologue modelos e realize disparos em massa.</p>
                            </header>

                            <div className="space-y-3">
                                {/* Subtab 1: Modelos Prontos */}
                                <button 
                                    onClick={() => setCampaignSubTab('templates')}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                                        campaignSubTab === 'templates'
                                            ? 'bg-white border-orange-500 shadow-md shadow-orange-100'
                                            : 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${campaignSubTab === 'templates' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Modelos de Mensagem</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Cadastro & Homologação</p>
                                        </div>
                                    </div>
                                </button>

                                {/* Subtab 2: Disparo em Massa */}
                                <button 
                                    onClick={() => setCampaignSubTab('disparo')}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                                        campaignSubTab === 'disparo'
                                            ? 'bg-white border-orange-500 shadow-md shadow-orange-100'
                                            : 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${campaignSubTab === 'disparo' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            <Megaphone size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Disparo em Massa</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Ação Promocional</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'connection' && (
                        <div className="p-4 space-y-4">
                            <header className="mb-4">
                                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Método de Conexão</h2>
                                <p className="text-[10px] text-slate-500 mt-1 ml-1">Escolha como disparar as notificações.</p>
                            </header>

                            <div className="space-y-3">
                                {/* Opção 1: Simulador / QR Code */}
                                <button 
                                    onClick={() => setMetaSettings(prev => ({ ...prev, connectionType: 'mock' }))}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                                        metaSettings.connectionType === 'mock'
                                            ? 'bg-white border-orange-500 shadow-md shadow-orange-100'
                                            : 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${metaSettings.connectionType === 'mock' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            <QrCode size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800">Simulador / App Web</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">QR Code Local (Mock)</p>
                                        </div>
                                    </div>
                                </button>

                                {/* Opção 2: API Oficial da Meta */}
                                <button 
                                    onClick={() => setMetaSettings(prev => ({ ...prev, connectionType: 'meta_api' }))}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                                        metaSettings.connectionType === 'meta_api'
                                            ? 'bg-white border-orange-500 shadow-md shadow-orange-100'
                                            : 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${metaSettings.connectionType === 'meta_api' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            <Globe size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800">API Oficial da Meta</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Cloud API de Produção</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Status Resumido */}
                            <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-100">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Status do Canal</span>
                                {metaSettings.connectionType === 'mock' ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-xs font-bold text-slate-700">Conectado (WhatsApp Web Simulado)</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${metaSettings.meta_whatsapp_active && metaSettings.meta_whatsapp_token ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                        <span className="text-xs font-bold text-slate-700">
                                            {metaSettings.meta_whatsapp_active && metaSettings.meta_whatsapp_token ? 'Canal Oficial Ativo' : 'Aguardando Credenciais'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className={`
                flex-1 flex flex-col bg-slate-100 relative 
                ${selectedChatId === null && activeTab === 'chats' ? 'hidden md:flex' : 'flex w-full md:w-auto'}
            `}>
                
                {/* Visualização de Chats */}
                {activeTab === 'chats' && selectedChatId && activeChat && (
                    <div className="flex-1 flex flex-col bg-[#f0f2f5]">
                        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-10 shadow-sm">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <button onClick={() => setSelectedChatId(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-600 font-black border border-slate-100">
                                    {activeChat.clientAvatar ? <img src={activeChat.clientAvatar} className="w-full h-full object-cover rounded-full" alt="" /> : activeChat.clientName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 truncate text-sm">{activeChat.clientName}</h3>
                                    <p className="text-[10px] text-green-600 font-black uppercase tracking-widest leading-none mt-0.5 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Online agora
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><Search size={20} /></button>
                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><MoreVertical size={20} /></button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay' }}>
                            {activeChat.messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'user' || msg.sender === 'system' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-sm relative ${
                                        msg.sender === 'user' ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none border-t border-green-100 shadow-[0_2px_4px_rgba(0,0,0,0.05)]' : 
                                        msg.sender === 'system' ? 'bg-white/80 backdrop-blur-sm text-slate-700 border border-slate-200 text-xs italic w-full max-w-full my-6 rounded-2xl shadow-sm text-center' :
                                        'bg-white text-slate-800 rounded-tl-none border-t border-white shadow-[0_2px_4px_rgba(0,0,0,0.05)]'
                                    }`}>
                                        {msg.sender === 'system' && (
                                            <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-100 pb-2">
                                                <Zap size={14} className="text-orange-500" />
                                                <span className="font-black uppercase tracking-widest text-[9px]">Automação BelareStudio</span>
                                            </div>
                                        )}
                                        <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
                                        <div className="flex justify-end items-center gap-1 mt-1">
                                            <span className="text-[9px] font-bold text-slate-400 opacity-70">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                                            {msg.sender === 'user' && (
                                                <span className={msg.status === 'read' ? 'text-blue-500' : 'text-slate-400'}>
                                                    {msg.status === 'read' ? <CheckCheck size={14} strokeWidth={3}/> : <Check size={14} strokeWidth={3}/>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white p-3 md:p-4 flex items-end gap-2 border-t border-slate-200">
                            <div className="flex-1 bg-slate-100 rounded-[24px] border border-slate-200 flex flex-col overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-green-100 transition-all duration-300">
                                <textarea value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Mensagem..." className="w-full p-3 md:p-4 max-h-32 bg-transparent focus:outline-none resize-none text-sm font-bold text-slate-700" rows={1} />
                            </div>
                            <button onClick={() => handleSendMessage()} className="w-14 h-14 bg-green-600 text-white rounded-full hover:bg-green-700 shadow-lg flex items-center justify-center transition-all active:scale-90"><Send className="w-6 h-6 ml-1" /></button>
                        </div>
                    </div>
                )}

                {/* Visualização de Automações (Live Preview) */}
                {activeTab === 'automations' && (
                    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-8 bg-slate-50/50 overflow-y-auto">
                        <div className="flex flex-col items-center gap-6">
                            <div className="text-center mb-4">
                                <h2 className="text-2xl font-black text-slate-800">Simulador de Envio</h2>
                                <p className="text-sm text-slate-500 font-medium">Veja exatamente como o seu cliente recebe a mensagem.</p>
                            </div>
                            <PhonePreview 
                                type={activePreview} 
                                time={activePreview === 'confirmation' ? automations.confirmation.time : automations.reminder.time} 
                                active={activePreview === 'confirmation' ? automations.confirmation.active : activePreview === 'reminder' ? automations.reminder.active : activePreview === 'feedback' ? automations.feedback.active : automations.birthday.active}
                            />
                        </div>
                    </div>
                )}

                {/* State: Campanhas & Modelos */}
                {activeTab === 'campaigns' && (
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 text-left">
                        {campaignSubTab === 'templates' ? (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200/60 shadow-xl shadow-slate-100/50">
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                                        <div className="p-3 bg-orange-500 text-white rounded-2xl">
                                            <Sparkles size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 leading-none">Modelos Recomendados para Aprovação na Meta</h3>
                                            <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-wide">Copie o texto exato abaixo e cole na sua conta da Meta (Facebook Business) para aprovação instantânea.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Modelo 1: Lembrete de Agendamento */}
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Lembrete de Agendamento</span>
                                                    <span className="text-[10px] font-bold text-slate-400">Categoria: UTILITY</span>
                                                </div>
                                                <h4 className="text-sm font-black text-slate-800 mb-2">Nome do Modelo: <code className="bg-white px-2 py-0.5 rounded border text-orange-600">lembrete_agendamento</code></h4>
                                                
                                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-4 mb-2">Texto para Cadastro:</p>
                                                <div className="bg-white p-4 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium leading-relaxed select-all">
                                                    Olá, {'{{1}}'}! Passando para lembrar do seu agendamento de {'{{2}}'} com o profissional {'{{3}}'} no dia {'{{4}}'} às {'{{5}}'}. Confirme clicando em: {'{{6}}'}
                                                </div>
                                                
                                                <div className="mt-4 space-y-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Variáveis do Sistema:</p>
                                                    <ul className="text-[10px] text-slate-500 space-y-1 font-medium list-disc list-inside">
                                                        <li><b>{'{1}'}</b>: Nome do Cliente</li>
                                                        <li><b>{'{2}'}</b>: Serviço / Procedimento</li>
                                                        <li><b>{'{3}'}</b>: Nome do Profissional</li>
                                                        <li><b>{'{4}'}</b>: Data Agendada</li>
                                                        <li><b>{'{5}'}</b>: Horário do Agendamento</li>
                                                        <li><b>{'{6}'}</b>: Link de Confirmação do Cliente</li>
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-slate-200/50 flex flex-col gap-2">
                                                <button 
                                                    onClick={() => copyToClipboard("Olá, {{1}}! Passando para lembrar do seu agendamento de {{2}} com o profissional {{3}} no dia {{4}} às {{5}}. Confirme clicando em: {{6}}")}
                                                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-black py-2.5 px-4 rounded-xl border border-slate-200 transition-all active:scale-[0.98]"
                                                >
                                                    <Copy size={14} /> Copiar Corpo do Modelo
                                                </button>
                                                <button 
                                                    onClick={() => handleAutoConfigureTemplate("lembrete_agendamento", false)}
                                                    className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-all active:scale-[0.98] shadow-md shadow-orange-100"
                                                >
                                                    <Zap size={14} /> Ativar no BelareStudio
                                                </button>
                                            </div>
                                        </div>

                                        {/* Modelo 2: Campanha / Disparo em Massa */}
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">Disparo em Massa</span>
                                                    <span className="text-[10px] font-bold text-slate-400">Categoria: MARKETING</span>
                                                </div>
                                                <h4 className="text-sm font-black text-slate-800 mb-2">Nome do Modelo: <code className="bg-white px-2 py-0.5 rounded border text-orange-600">promocao_especial</code></h4>
                                                
                                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-4 mb-2">Texto para Cadastro:</p>
                                                <div className="bg-white p-4 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium leading-relaxed select-all">
                                                    Olá, {'{{1}}'}! Temos uma novidade incrível para você no Belare Studio. Aproveite nosso desconto especial de {'{{2}}'} em sua próxima visita! Digite "Quero" ou agende pelo link: {'{{3}}'}
                                                </div>
                                                
                                                <div className="mt-4 space-y-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Variáveis do Sistema:</p>
                                                    <ul className="text-[10px] text-slate-500 space-y-1 font-medium list-disc list-inside">
                                                        <li><b>{'{1}'}</b>: Nome do Cliente</li>
                                                        <li><b>{'{2}'}</b>: Valor ou Cupom de Desconto (Ex: 15% OFF)</li>
                                                        <li><b>{'{3}'}</b>: Link Direto para Agendamento</li>
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-slate-200/50 flex flex-col gap-2">
                                                <button 
                                                    onClick={() => copyToClipboard("Olá, {{1}}! Temos uma novidade incrível para você no Belare Studio. Aproveite nosso desconto especial de {{2}} em sua próxima visita! Digite \"Quero\" ou agende pelo link: {{3}}")}
                                                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-black py-2.5 px-4 rounded-xl border border-slate-200 transition-all active:scale-[0.98]"
                                                >
                                                    <Copy size={14} /> Copiar Corpo do Modelo
                                                </button>
                                                <button 
                                                    onClick={() => handleAutoConfigureTemplate("promocao_especial", true)}
                                                    className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-all active:scale-[0.98] shadow-md shadow-orange-100"
                                                >
                                                    <Megaphone size={14} /> Ativar no BelareStudio
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex gap-3">
                                    <Info className="text-blue-600 flex-shrink-0" size={20} />
                                    <div className="text-xs text-blue-800 leading-relaxed">
                                        <p className="font-bold">Como funciona a aprovação na Meta?</p>
                                        <p className="mt-1">Ao cadastrar esses modelos no painel do Facebook Business, o robô da Meta analisa a estrutura de variáveis. Geralmente a aprovação ocorre de forma imediata (em menos de 2 minutos). Certifique-se de configurar o idioma como <b>Português (Brasil) / pt_BR</b> no momento do cadastro.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200/60 shadow-xl shadow-slate-100/50">
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                                        <div className="p-3 bg-orange-500 text-white rounded-2xl">
                                            <Megaphone size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 leading-none">Motor de Disparo em Massa (Marketing)</h3>
                                            <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-wide">Crie campanhas segmentadas e envie notificações para os seus clientes com alta precisão.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Inputs de Configuração da Campanha */}
                                        <div className="md:col-span-2 space-y-4 text-xs font-bold text-slate-500">
                                            <div>
                                                <label className="block text-slate-700 mb-1.5 font-bold">1. Segmento de Clientes Alvo</label>
                                                <select 
                                                    value={selectedSegment} 
                                                    onChange={(e) => setSelectedSegment(e.target.value as any)}
                                                    className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-slate-800 focus:bg-white focus:border-orange-500 outline-none transition-all font-medium"
                                                >
                                                    <option value="all">Todos os Clientes ({campaignClientsWithStatus.length})</option>
                                                    <option value="ativo">Clientes Ativos (Frequência &lt; 20 dias - {campaignClientsWithStatus.filter(c => c.status === 'ativo').length})</option>
                                                    <option value="ausente">Clientes Ausentes (Entre 20 e 30 dias - {campaignClientsWithStatus.filter(c => c.status === 'ausente').length})</option>
                                                    <option value="esquecido">Clientes Esquecidos (&gt; 30 dias - {campaignClientsWithStatus.filter(c => c.status === 'esquecido').length})</option>
                                                    <option value="sem_atendimento">Sem Atendimento Cadastrado ({campaignClientsWithStatus.filter(c => c.status === 'sem_atendimento').length})</option>
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-slate-700 mb-1.5 font-bold">2. Cupom ou Desconto {'{{2}}'}</label>
                                                    <input 
                                                        type="text" 
                                                        value={promoDiscount} 
                                                        onChange={(e) => setPromoDiscount(e.target.value)}
                                                        placeholder="Ex: 15% de Desconto" 
                                                        className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-slate-800 focus:bg-white focus:border-orange-500 outline-none transition-all font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-slate-700 mb-1.5 font-bold">3. Link de Agendamento {'{{3}}'}</label>
                                                    <input 
                                                        type="text" 
                                                        value={promoLink} 
                                                        onChange={(e) => setPromoLink(e.target.value)}
                                                        placeholder="Opcional (Usa agendamento do estúdio por padrão)" 
                                                        className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-slate-800 focus:bg-white focus:border-orange-500 outline-none transition-all font-medium text-[11px]"
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Pré-visualização da Mensagem Selecionada:</p>
                                                <div className="bg-white p-3.5 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium leading-relaxed">
                                                    Olá, <span className="text-orange-600 font-bold">{'[Nome do Cliente]'}</span>! Temos uma novidade incrível para você no Belare Studio. Aproveite nosso desconto especial de <span className="text-orange-600 font-bold">{promoDiscount || "..."}</span> em sua próxima visita! Digite "Quero" ou agende pelo link: <span className="text-orange-600 font-bold text-[10px]">{promoLink || `${window.location.origin}/#/public-preview?sid=${activeStudioId}`}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status / Ação do Disparo */}
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Resumo do Público</h4>
                                                <div className="space-y-2 mb-4">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 font-bold">Público Alvo:</span>
                                                        <span className="font-black text-slate-800">{filteredCampaignClients.length} Clientes</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 font-bold">Método de Envio:</span>
                                                        <span className="font-black text-orange-600 uppercase text-[10px]">
                                                            {metaSettings.connectionType === 'meta_api' && metaSettings.meta_whatsapp_token ? 'API Oficial da Meta' : 'Modo Simulação / Teste'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {isBroadcasting && (
                                                    <div className="space-y-2.5 my-4">
                                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-500">
                                                            <span>PROGRESSO: {Math.round((broadcastProgress.current / (broadcastProgress.total || 1)) * 100)}%</span>
                                                            <span>{broadcastProgress.current}/{broadcastProgress.total}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                            <div 
                                                                className="bg-orange-500 h-full transition-all duration-300" 
                                                                style={{ width: `${(broadcastProgress.current / (broadcastProgress.total || 1)) * 100}%` }}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-center mt-2">
                                                            <div className="bg-green-50 text-green-700 p-1.5 rounded-lg border border-green-100">
                                                                {broadcastProgress.success} Sucesso
                                                            </div>
                                                            <div className="bg-red-50 text-red-700 p-1.5 rounded-lg border border-red-100">
                                                                {broadcastProgress.failed} Falhas
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <button 
                                                onClick={handleStartCampaignBroadcast}
                                                disabled={isBroadcasting || loadingCampaignClients}
                                                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-white text-xs transition-all active:scale-[0.98] ${
                                                    isBroadcasting 
                                                        ? 'bg-slate-400 cursor-not-allowed' 
                                                        : 'bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-100'
                                                }`}
                                            >
                                                {isBroadcasting ? (
                                                    <>
                                                        <RefreshCw className="animate-spin" size={14} /> Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Megaphone size={14} /> Iniciar Disparo em Massa
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Feed de Logs do Disparo */}
                                {(broadcastLogs.length > 0 || isBroadcasting) && (
                                    <div className="bg-white p-6 rounded-[32px] border border-slate-200/60 shadow-xl shadow-slate-100/50">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Histórico de Disparos em Tempo Real</h4>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Lista de Contatos Recentes</span>
                                        </div>

                                        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 text-xs">
                                            {broadcastLogs.map((log) => (
                                                <div key={log.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className="flex items-center gap-2.5">
                                                        <Users size={14} className="text-slate-400" />
                                                        <div>
                                                            <span className="font-black text-slate-800">{log.clientName}</span>
                                                            <span className="text-[10px] text-slate-400 ml-2 font-medium">({log.phone})</span>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        {log.status === 'sending' && (
                                                            <span className="text-[10px] font-black uppercase text-blue-600 animate-pulse bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">Enviando...</span>
                                                        )}
                                                        {log.status === 'success' && (
                                                            <span className="text-[10px] font-black uppercase text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-100 flex items-center gap-1">
                                                                <Check size={12} /> Enviado
                                                            </span>
                                                        )}
                                                        {log.status === 'failed' && (
                                                            <span className="text-[10px] font-black uppercase text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-100" title={log.error}>
                                                                Falha: {log.error || 'Erro'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* State: Empty Chats */}
                {activeTab === 'chats' && !selectedChatId && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white/50 backdrop-blur-sm">
                        <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center shadow-2xl border border-slate-100 mb-6">
                            <MessageSquare className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight">Canal WhatsApp BelareStudio</h3>
                        <p className="text-xs font-bold text-slate-400 max-w-xs mt-3 uppercase tracking-widest leading-relaxed">Suas conversas sincronizadas e automatizadas em um único lugar.</p>
                    </div>
                )}
                
                {/* State: Connection Placeholder / Meta API Settings Form */}
                {activeTab === 'connection' && (
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 text-left">
                        {metaSettings.connectionType === 'mock' ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="max-w-md w-full bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 text-center">
                                    <QrCode size={180} className="mx-auto text-slate-800 mb-8 animate-pulse" />
                                    <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Parear WhatsApp</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed mb-8">
                                        1. Abra o WhatsApp no seu celular<br/>
                                        2. Toque em <b>Aparelhos Conectados</b><br/>
                                        3. Toque em <b>Conectar um Aparelho</b> e aponte para a tela
                                    </p>
                                    <button onClick={() => showToast("Código gerado com sucesso!")} className="flex items-center justify-center gap-3 w-full bg-slate-100 p-4 rounded-2xl font-black text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all group">
                                        <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" /> Gerar Novo Código
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200/60 shadow-xl shadow-slate-100/50">
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                                        <div className="p-3 bg-blue-500 text-white rounded-2xl">
                                            <Settings size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 leading-none">Credenciais da Cloud API Oficial da Meta</h3>
                                            <p className="text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-wide">Integração oficial de alta velocidade, homologada e sem bloqueios</p>
                                        </div>
                                    </div>

                                    {isLoadingSettings ? (
                                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                                            <RefreshCw className="animate-spin text-orange-500" size={32} />
                                            <span className="text-xs font-black uppercase tracking-widest">Carregando credenciais...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {/* Token de Acesso */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1">
                                                    <KeyRound size={12} className="text-slate-400" /> Token de Acesso Permanente (Bearer)
                                                </label>
                                                <input 
                                                    type="password" 
                                                    value={metaSettings.meta_whatsapp_token} 
                                                    onChange={e => setMetaSettings(prev => ({ ...prev, meta_whatsapp_token: e.target.value }))}
                                                    placeholder="EAABw..." 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono outline-none focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* ID do Número de Telefone */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1">
                                                        <Phone size={12} className="text-slate-400" /> ID do Número de Telefone
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        value={metaSettings.meta_whatsapp_phone_number_id} 
                                                        onChange={e => setMetaSettings(prev => ({ ...prev, meta_whatsapp_phone_number_id: e.target.value }))}
                                                        placeholder="Ex: 105943283234563" 
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all"
                                                    />
                                                </div>

                                                {/* ID da Conta Comercial */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1">
                                                        <User size={12} className="text-slate-400" /> ID da Conta Comercial (WABA)
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        value={metaSettings.meta_whatsapp_business_account_id} 
                                                        onChange={e => setMetaSettings(prev => ({ ...prev, meta_whatsapp_business_account_id: e.target.value }))}
                                                        placeholder="Ex: 230985472394783" 
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Nome do Modelo */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1">
                                                        <Zap size={12} className="text-slate-400" /> Nome do Modelo (Template Name)
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        value={metaSettings.meta_whatsapp_template_name} 
                                                        onChange={e => setMetaSettings(prev => ({ ...prev, meta_whatsapp_template_name: e.target.value }))}
                                                        placeholder="Ex: lembrete_agendamento" 
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all"
                                                    />
                                                </div>

                                                {/* Idioma */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1">
                                                        <Globe size={12} className="text-slate-400" /> Idioma do Modelo
                                                    </label>
                                                    <select 
                                                        value={metaSettings.meta_whatsapp_language} 
                                                        onChange={e => setMetaSettings(prev => ({ ...prev, meta_whatsapp_language: e.target.value }))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="pt_BR">Português (Brasil) [pt_BR]</option>
                                                        <option value="pt">Português (Geral) [pt]</option>
                                                        <option value="pt_PT">Português (Portugal) [pt_PT]</option>
                                                        <option value="en">Inglês [en]</option>
                                                        <option value="en_US">Inglês (EUA) [en_US]</option>
                                                        <option value="es">Espanhol [es]</option>
                                                        <option value="es_ES">Espanhol (Espanha) [es_ES]</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Salvar Button */}
                                            <div className="pt-4">
                                                <button 
                                                    onClick={handleSaveSettings}
                                                    disabled={isSavingSettings}
                                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-wider text-xs p-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-100 disabled:opacity-50"
                                                >
                                                    {isSavingSettings ? (
                                                        <>
                                                            <RefreshCw className="animate-spin" size={16} /> Salvando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldCheck size={16} /> Salvar Credenciais & Ativar Canal Oficial
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sandbox Testing Card */}
                                <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200/60 shadow-xl shadow-slate-100/50">
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                                        <div className="p-3 bg-orange-500 text-white rounded-2xl">
                                            <Smartphone size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 leading-none">Sandbox de Testes da Meta Cloud API</h3>
                                            <p className="text-xs text-slate-400 mt-1.5 font-bold">Teste os disparos reais da Meta Cloud API para o seu celular imediatamente</p>
                                        </div>
                                    </div>

                                        <div className="space-y-4">
                                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-xs text-blue-700 leading-relaxed font-medium">
                                                <p className="font-black flex items-center gap-1.5 mb-1 text-blue-800"><Info size={14} /> Dica de Sandbox:</p>
                                                <p>As variáveis que o Belare Studio passará automaticamente para o seu template da Meta no corpo da mensagem são, em ordem:</p>
                                                <ol className="list-decimal list-inside space-y-0.5 mt-2 font-mono">
                                                    <li>Nome do Cliente (Ex: Maria)</li>
                                                    <li>Nome do Serviço (Ex: Cabelo + Escova)</li>
                                                    <li>Nome do Profissional (Ex: Jacilene Félix)</li>
                                                    <li>Data Formatada (Ex: Segunda, 12/07)</li>
                                                    <li>Horário (Ex: 14:00)</li>
                                                    <li>Link de Confirmação (Gerado dinamicamente para o cliente clicar)</li>
                                                </ol>
                                            </div>

                                            {/* Variáveis Customizadas */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest block">
                                                    Variáveis do Template (Separadas por vírgula)
                                                </label>
                                                <input 
                                                    type="text" 
                                                    value={metaSettings.meta_whatsapp_template_params || ''} 
                                                    onChange={e => setMetaSettings(prev => ({ ...prev, meta_whatsapp_template_params: e.target.value }))}
                                                    placeholder="Cliente de Teste, Manicure & Pedicure, Profissional de Teste, Amanhã, 14:00" 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all"
                                                />
                                                <p className="text-[10px] text-slate-400 font-medium ml-1">
                                                    Ajuste as variáveis acima se o seu modelo aprovado no Facebook tiver menos parâmetros ou for estático (vazio).
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                                <div className="space-y-1.5 md:col-span-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest block">Telefone de Teste (Com DDD)</label>
                                                    <input 
                                                        type="text" 
                                                        value={testPhone} 
                                                        onChange={e => setTestPhone(e.target.value)}
                                                        placeholder="Ex: 81999999999" 
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all"
                                                    />
                                                </div>
                                            <button 
                                                onClick={handleSendTestMessage}
                                                disabled={isSendingTest}
                                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-wider text-xs p-4 h-[54px] rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                            >
                                                {isSendingTest ? (
                                                    <>
                                                        <RefreshCw className="animate-spin" size={16} /> Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={14} /> Disparar Teste
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {metaTemplateError && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-[32px] p-6 space-y-4 animate-in fade-in duration-300">
                                        <div className="flex gap-3">
                                            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={24} />
                                            <div>
                                                <h4 className="text-sm font-black text-amber-900 leading-tight">
                                                    Diagnóstico de Erro da Meta (#132001 - Modelo Inexistente)
                                                </h4>
                                                <p className="text-xs text-amber-700 mt-1.5 font-bold leading-relaxed">
                                                    A API oficial da Meta retornou que o modelo <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-bold font-mono">'{metaTemplateError.templateName}'</code> com idioma <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-bold font-mono">'{metaTemplateError.language}'</code> não foi encontrado ou ainda não está aprovado na sua conta do Facebook Business.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl p-5 border border-amber-100 text-xs space-y-4 text-left">
                                            <p className="font-bold text-slate-800">Siga estes passos simples para corrigir imediatamente:</p>
                                            
                                            <div className="space-y-4">
                                                <div className="flex gap-2 items-start">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-black text-[10px] mt-0.5 flex-shrink-0">1</span>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-800">Incompatibilidade de Idioma (Erro mais comum!)</p>
                                                        <p className="text-slate-500 mt-0.5 leading-relaxed">Muitas vezes você cadastrou o modelo no Facebook como <b className="text-slate-700">Português (Geral) - código "pt"</b>, mas o sistema está tentando enviar como <b className="text-slate-700">Português (Brasil) - código "pt_BR"</b>.</p>
                                                        
                                                        <button
                                                            onClick={async () => {
                                                                const currentLang = metaSettings.meta_whatsapp_language;
                                                                const nextLang = currentLang === 'pt_BR' ? 'pt' : 'pt_BR';
                                                                
                                                                const updated = {
                                                                    ...metaSettings,
                                                                    meta_whatsapp_language: nextLang
                                                                };
                                                                setMetaSettings(updated);
                                                                
                                                                if (activeStudioId) {
                                                                    try {
                                                                        const localPayload = {
                                                                            meta_whatsapp_token: updated.meta_whatsapp_token.trim(),
                                                                            meta_whatsapp_phone_number_id: updated.meta_whatsapp_phone_number_id.trim(),
                                                                            meta_whatsapp_business_account_id: updated.meta_whatsapp_business_account_id.trim(),
                                                                            meta_whatsapp_template_name: updated.meta_whatsapp_template_name.trim(),
                                                                            meta_whatsapp_language: nextLang,
                                                                            meta_whatsapp_active: updated.connectionType === 'meta_api',
                                                                            meta_whatsapp_template_params: updated.meta_whatsapp_template_params,
                                                                        };

                                                                        window.safeLocalStorage?.setItem(
                                                                            `meta_whatsapp_settings_${activeStudioId}`,
                                                                            JSON.stringify(localPayload)
                                                                        );

                                                                        await supabase
                                                                            .from('business_settings')
                                                                            .upsert({
                                                                                id: activeStudioId,
                                                                                studio_id: activeStudioId,
                                                                                ...localPayload,
                                                                                updated_at: new Date().toISOString()
                                                                            }, { onConflict: 'studio_id' });
                                                                            
                                                                        showToast(`Idioma alterado com sucesso para '${nextLang}'! Tentando enviar novamente...`, "success");
                                                                        
                                                                        setTimeout(() => {
                                                                            handleSendTestMessage();
                                                                        }, 1000);
                                                                    } catch (err) {
                                                                        console.error("Erro ao reconfigurar idioma:", err);
                                                                    }
                                                                }
                                                            }}
                                                            className="mt-2.5 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-wider py-2 px-3 rounded-xl transition-all shadow-md shadow-amber-200"
                                                        >
                                                            <Globe size={11} /> Corrigir: Mudar Idioma para "{metaSettings.meta_whatsapp_language === 'pt_BR' ? 'pt' : 'pt_BR'}" e Reenviar
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 items-start pt-3 border-t border-slate-100">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-black text-[10px] mt-0.5 flex-shrink-0">2</span>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-800">Diferença de Nome Exato</p>
                                                        <p className="text-slate-500 mt-0.5 leading-relaxed">O nome do modelo no painel da Meta deve ser exatamente minúsculo com sublinha: <code className="bg-slate-100 px-1 rounded text-orange-600 font-bold font-mono">lembrete_agendamento</code>. Se estiver escrito com traço (<code className="bg-slate-100 px-1 rounded text-slate-600 font-mono">lembrete-agendamento</code>) ou letras maiúsculas, dê um duplo clique no campo "Nome do Modelo" e ajuste aqui.</p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 items-start pt-3 border-t border-slate-100">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-black text-[10px] mt-0.5 flex-shrink-0">3</span>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-800">Número de Variáveis Incompatível</p>
                                                        <p className="text-slate-500 mt-0.5 leading-relaxed">O Belare Studio envia <b className="text-slate-700">{metaTemplateError.variablesCount} parâmetros</b>. No seu painel da Meta, o seu modelo deve ter exatamente a quantidade de placeholders configurada (Ex: de <code className="bg-slate-100 px-1 rounded text-slate-600 font-mono">{"{{1}}"}</code> até <code className="bg-slate-100 px-1 rounded text-slate-600 font-mono">{"{{6}}"}</code>). Se o seu modelo possuir menos, ajuste o campo "Variáveis do Template" acima.</p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 items-start pt-3 border-t border-slate-100">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-black text-[10px] mt-0.5 flex-shrink-0">4</span>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-800">Aprovação Pendente no Facebook</p>
                                                        <p className="text-slate-500 mt-0.5 leading-relaxed">Certifique-se de que o modelo foi aprovado no Facebook (tem uma bolinha verde no painel da Meta). Se estiver reprovado ou em análise, aguarde ou cadastre outro modelo com nome diferente.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppView;