
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Globe, Copy, ExternalLink, Save, Loader2, CheckCircle2, 
    Smartphone, Megaphone, Palette, Info, AlertCircle, RefreshCw
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const AgendaOnlineView: React.FC = () => {
    // --- Estados de Dados ---
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        id: null,
        studio_name: '',
        general_notice: '', // Usado como Bio da página
        online_booking_enabled: false,
        logo_url: ''
    });

    // --- Estados de UI ---
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Helpers ---
    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    }, []);

    const publicLink = window.location.origin + window.location.pathname + '#/agendar';

    // --- Busca de Dados ---
    const fetchSettings = useCallback(async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('studio_settings')
                .select('*')
                .maybeSingle()
                .abortSignal(controller.signal);

            if (error) throw error;

            if (data) {
                setSettings({
                    id: data.id,
                    studio_name: data.studio_name || '',
                    general_notice: data.general_notice || '',
                    online_booking_enabled: !!data.online_booking_enabled,
                    logo_url: data.logo_url || ''
                });
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Erro ao carregar configurações:", err);
                showToast("Não foi possível carregar as configurações.", "error");
            }
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchSettings();
        return () => abortControllerRef.current?.abort();
    }, [fetchSettings]);

    // --- Ações ---
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                studio_name: settings.studio_name,
                general_notice: settings.general_notice,
                online_booking_enabled: settings.online_booking_enabled,
                logo_url: settings.logo_url
            };

            const { error } = settings.id 
                ? await supabase.from('studio_settings').update(payload).eq('id', settings.id)
                : await supabase.from('studio_settings').insert([payload]);

            if (error) throw error;
            showToast("Configurações atualizadas com sucesso!");
        } catch (err: any) {
            console.error("Erro ao salvar:", err);
            showToast("Erro ao salvar alterações.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(publicLink);
        showToast("Link copiado para a área de transferência!");
    };

    const handleToggleBooking = () => {
        setSettings(prev => ({ ...prev, online_booking_enabled: !prev.online_booking_enabled }));
    };

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                <Loader2 className="animate-spin text-orange-500" size={40} />
                <p className="font-black text-[10px] uppercase tracking-widest">Sincronizando configurações...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Top Header */}
            <header className="bg-white border-b border-slate-200 px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0 z-20 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Globe size={24} /></div>
                        Configurar Agenda Online
                    </h1>
                    <p className="text-slate-400 text-sm font-medium mt-0.5">Gerencie seu link público e regras de agendamento automático.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchSettings} 
                        className="p-2.5 text-slate-400 hover:text-orange-500 bg-white border border-slate-100 rounded-xl transition-all"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} 
                        Salvar Alterações
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* CARD 1: STATUS & LINK */}
                    <Card title="Status & Link de Compartilhamento" icon={<Smartphone size={20} />}>
                        <div className="space-y-8">
                            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[28px] border border-slate-100">
                                <div className="space-y-1">
                                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Aceitar Agendamentos Online</h4>
                                    <p className="text-xs text-slate-500">Quando ativado, os clientes podem reservar horários pelo seu link.</p>
                                </div>
                                <ToggleSwitch on={settings.online_booking_enabled} onClick={handleToggleBooking} />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu Link Público</label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 bg-white border border-slate-200 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-inner">
                                        <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg"><Globe size={14} /></div>
                                        <input 
                                            readOnly 
                                            value={publicLink}
                                            className="bg-transparent border-none outline-none text-sm font-bold text-slate-600 w-full"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleCopyLink}
                                            className="p-3.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-2xl transition-all shadow-sm active:scale-95"
                                            title="Copiar Link"
                                        >
                                            <Copy size={20} />
                                        </button>
                                        <a 
                                            href={publicLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="p-3.5 bg-white border border-slate-200 text-slate-600 hover:text-orange-500 hover:border-orange-200 rounded-2xl transition-all shadow-sm active:scale-95"
                                            title="Visualizar Página"
                                        >
                                            <ExternalLink size={20} />
                                        </a>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-slate-50/50 p-2 px-3 rounded-lg w-fit">
                                    <Info size={12} /> DICA: Coloque este link na bio do seu Instagram.
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* CARD 2: APARÊNCIA */}
                    <Card title="Aparência da Página Pública" icon={<Palette size={20} />}>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título da Página</label>
                                    <input 
                                        placeholder="Ex: Espaço da Beleza - Agendamento"
                                        value={settings.studio_name}
                                        onChange={e => setSettings({...settings, studio_name: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 font-bold text-slate-700 transition-all"
                                    />
                                </div>
                                <div className="space-y-2 text-center md:text-left">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo do Estúdio</label>
                                     <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                                            {settings.logo_url ? <img src={settings.logo_url} className="w-full h-full object-cover" /> : <Globe className="text-slate-300" />}
                                        </div>
                                        <button className="text-xs font-black text-blue-600 hover:underline uppercase tracking-widest">Alterar Imagem</button>
                                     </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Biografia / Descrição Curta</label>
                                    <span className="text-[9px] font-black text-slate-300 uppercase">{settings.general_notice.length}/200</span>
                                </div>
                                <textarea 
                                    maxLength={200}
                                    placeholder="Conte um pouco sobre o estúdio para seus clientes..."
                                    value={settings.general_notice}
                                    onChange={e => setSettings({...settings, general_notice: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-[28px] px-5 py-4 outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-600 min-h-[100px] resize-none transition-all"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* AVISO DE CONFIGURAÇÃO */}
                    <div className="p-6 bg-orange-50 border border-orange-100 rounded-[32px] flex items-start gap-4">
                        <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-200">
                            <Megaphone size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-orange-900 text-sm uppercase tracking-tight">Regras de Negócio</h4>
                            <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                                A agenda online respeita automaticamente os <b>Horários de Atendimento</b> configurados no perfil de cada profissional e o <b>Catálogo de Serviços</b> ativos. Certifique-se de que sua equipe e serviços estejam atualizados.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AgendaOnlineView;
