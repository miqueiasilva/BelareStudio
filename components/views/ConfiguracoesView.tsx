
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Settings, Store, Scissors, Clock, Wallet, Bell, Save, 
    Plus, Trash2, Loader2, Phone, CreditCard, Banknote, 
    Smartphone, DollarSign, X, RefreshCw, AlertCircle
} from 'lucide-react';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { LegacyService } from '../../types';

const ConfiguracoesView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('studio');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // --- State: Data ---
    const [studioData, setStudioData] = useState({ id: null, studio_name: '', address: '', phone: '', general_notice: '', work_schedule: {} });
    const [services, setServices] = useState<LegacyService[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [isAddingPM, setIsAddingPM] = useState(false);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    }, []);

    const fetchTabContent = useCallback(async (tab: string) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setErrorMsg(null);
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            if (tab === 'studio' || tab === 'notices') {
                const { data, error } = await supabase.from('studio_settings').select('*').maybeSingle().abortSignal(controller.signal);
                if (error) throw error;
                if (data) setStudioData(data);
            } else if (tab === 'services') {
                const { data, error } = await supabase.from('services').select('*').order('nome').abortSignal(controller.signal);
                if (error) throw error;
                setServices(data || []);
            } else if (tab === 'finance') {
                const { data, error } = await supabase.from('payment_methods').select('*').order('id').abortSignal(controller.signal);
                if (error) throw error;
                setPaymentMethods(data || []);
            }
        } catch (e: any) {
            if (e.name === 'AbortError' || e.message?.includes('aborted')) {
                // Requisição cancelada propositalmente, ignoramos
            } else {
                setErrorMsg(e.message || "Falha ao carregar configurações.");
            }
        } finally {
            clearTimeout(timeoutId);
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchTabContent(activeTab);
        return () => abortControllerRef.current?.abort();
    }, [activeTab, fetchTabContent]);

    const handleSaveStudio = async () => {
        setIsSaving(true);
        try {
            const payload = { studio_name: studioData.studio_name, address: studioData.address, phone: studioData.phone, general_notice: studioData.general_notice };
            const { error } = studioData.id 
                ? await supabase.from('studio_settings').update(payload).eq('id', studioData.id)
                : await supabase.from('studio_settings').insert([payload]);
            if (error) throw error;
            showToast("Alterações salvas!");
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'studio', label: 'Estúdio', icon: Store },
        { id: 'services', label: 'Serviços', icon: Scissors },
        { id: 'finance', label: 'Financeiro', icon: Wallet },
        { id: 'notices', label: 'Avisos', icon: Bell },
    ];

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 z-10">
                <div className="p-6 border-b border-slate-100 h-20 flex items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings size={24} className="text-slate-400" /> Configurações</h2>
                </div>
                <nav className="p-4 space-y-1">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-orange-50 text-orange-600 shadow-sm border border-orange-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-medium">Carregando {tabs.find(t => t.id === activeTab)?.label}...</p>
                        </div>
                    ) : errorMsg ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                            <AlertCircle className="mx-auto mb-4 text-orange-400" size={40} />
                            <h3 className="font-bold text-slate-700">{errorMsg}</h3>
                            <button onClick={() => fetchTabContent(activeTab)} className="mt-4 text-orange-600 font-bold hover:underline">Recarregar</button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-300">
                            {activeTab === 'studio' && (
                                <div className="space-y-6">
                                    <Card title="Perfil do Estúdio" icon={<Store size={20} />}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Fantasia</label>
                                                <input value={studioData.studio_name} onChange={e => setStudioData({...studioData, studio_name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</label>
                                                <input value={studioData.phone} onChange={e => setStudioData({...studioData, phone: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" />
                                            </div>
                                        </div>
                                    </Card>
                                    <div className="flex justify-end">
                                        <button onClick={handleSaveStudio} disabled={isSaving} className="bg-orange-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
                                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Salvar Configurações
                                        </button>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'services' && (
                                <Card title="Catálogo de Serviços" icon={<Scissors size={20} />}>
                                    <div className="divide-y divide-slate-100">
                                        {services.map(s => (
                                            <div key={s.id} className="py-3 flex justify-between items-center">
                                                <span className="font-bold text-slate-700">{s.nome}</span>
                                                <span className="font-black text-orange-600">R$ {s.preco.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                            {activeTab === 'finance' && (
                                <Card title="Meios de Pagamento" icon={<Wallet size={20} />}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {paymentMethods.map(pm => (
                                            <div key={pm.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between">
                                                <span className="font-bold text-slate-700">{pm.name}</span>
                                                <span className="text-xs text-slate-400">{pm.fee_percentage}% taxa</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ConfiguracoesView;
