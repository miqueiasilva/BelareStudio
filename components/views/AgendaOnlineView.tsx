
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Globe, Copy, ExternalLink, Save, Loader2, 
    Smartphone, Palette, Info, RefreshCw, Check, Share2
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const AgendaOnlineView: React.FC = () => {
    // --- Estados de Controle ---
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // --- Estados dos Dados ---
    const [settings, setSettings] = useState({
        id: null as number | null,
        studio_name: '',
        online_booking_enabled: false,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    }, []);

    const publicLink = `${window.location.origin}/#/agendar`;

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
                    online_booking_enabled: !!data.online_booking_enabled,
                });
            } else {
                // Caso não exista, cria o registro padrão
                const { data: newData, error: insertError } = await supabase
                    .from('studio_settings')
                    .insert([{ 
                        studio_name: 'Meu Estúdio', 
                        online_booking_enabled: false 
                    }])
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                if (newData) {
                    setSettings({
                        id: newData.id,
                        studio_name: newData.studio_name,
                        online_booking_enabled: !!newData.online_booking_enabled,
                    });
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Erro ao carregar configurações:", err);
                showToast("Erro ao conectar com o banco de dados.", "error");
            }
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchSettings();
        return () => abortControllerRef.current?.abort();
    }, [fetchSettings]);

    // --- Atualização Automática ao Mudar o Switch ---
    const handleToggleEnabled = async () => {
        if (!settings.id) return;
        
        const newValue = !settings.online_booking_enabled;
        
        // Update local state for instant feedback
        setSettings(prev => ({ ...prev, online_booking_enabled: newValue }));

        try {
            const { error } = await supabase
                .from('studio_settings')
                .update({ online_booking_enabled: newValue })
                .eq('id', settings.id);

            if (error) throw error;

            showToast(newValue ? "Agendamento online ATIVADO!" : "Agendamento online desativado.");
        } catch (err: any) {
            console.error("Erro ao atualizar status:", err);
            showToast("Falha ao atualizar status no servidor.", "error");
            // Revert local state on error
            setSettings(prev => ({ ...prev, online_booking_enabled: !newValue }));
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(publicLink);
        showToast("Link copiado para a área de transferência!");
    };

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
                <Loader2 className="animate-spin text-orange-500" size={42} />
                <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Carregando Módulo...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header Administrativo */}
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0 z-20">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Globe size={24} /></div>
                        Módulo de Agenda Online
                    </h1>
                    <p className="text-slate-400 text-sm font-medium mt-0.5">Gerencie seu canal de agendamento público.</p>
                </div>
                
                <button 
                    onClick={fetchSettings} 
                    className="p-3 text-slate-400 hover:text-orange-500 bg-white border border-slate-100 rounded-2xl transition-all active:scale-95"
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* CARD DE STATUS */}
                    <Card title="Status da Agenda Pública" icon={<Smartphone size={20} />}>
                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[28px] border border-slate-100">
                            <div className="space-y-1">
                                <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Aceitar Agendamentos Online</h4>
                                <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                                    Ao ativar, seus clientes poderão agendar horários sozinhos através do link público.
                                </p>
                            </div>
                            <ToggleSwitch 
                                on={settings.online_booking_enabled} 
                                onClick={handleToggleEnabled} 
                            />
                        </div>
                    </Card>

                    {/* CARD DE COMPARTILHAMENTO */}
                    <Card title="Link de Compartilhamento" icon={<Share2 size={20} />}>
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500 ml-1">Divulgue este link no seu Instagram, WhatsApp e redes sociais.</p>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 bg-white border border-slate-200 px-5 py-3.5 rounded-2xl flex items-center gap-3 shadow-inner overflow-hidden">
                                    <Globe size={16} className="text-slate-400 shrink-0" />
                                    <span className="text-sm font-bold text-slate-600 truncate select-all">{publicLink}</span>
                                </div>
                                
                                <div className="flex gap-2 shrink-0">
                                    <button 
                                        onClick={handleCopyLink}
                                        className="flex-1 sm:flex-none p-4 bg-orange-500 text-white hover:bg-orange-600 rounded-2xl transition-all shadow-lg shadow-orange-100 active:scale-95 flex items-center justify-center gap-2"
                                        title="Copiar Link"
                                    >
                                        <Copy size={20} />
                                        <span className="text-xs font-black uppercase tracking-widest sm:hidden">Copiar</span>
                                    </button>
                                    
                                    <a 
                                        href={publicLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 sm:flex-none p-4 bg-slate-900 text-white hover:bg-black rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                        title="Visualizar Página Pública"
                                    >
                                        <ExternalLink size={20} />
                                        <span className="text-xs font-black uppercase tracking-widest sm:hidden">Ver</span>
                                    </a>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                                <Info size={18} className="text-blue-500 mt-0.5" />
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    <b>Dica de Ouro:</b> Adicione este link ao seu "Link na Bio" do Instagram. Estudos mostram que clientes agendam 3x mais quando não precisam falar com ninguém.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* CARD IDENTIDADE (SÓ DISPLAY NESTE MÓDULO) */}
                    <Card title="Prévia da Vitrine" icon={<Palette size={20} />}>
                        <div className="p-6 bg-slate-100 rounded-[28px] border border-dashed border-slate-300 text-center">
                            <p className="text-xs text-slate-400 font-medium">
                                As configurações de cores, logo e serviços são gerenciadas no módulo de <br/>
                                <span className="font-bold text-orange-500">Configurações do Estúdio</span>.
                            </p>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default AgendaOnlineView;
