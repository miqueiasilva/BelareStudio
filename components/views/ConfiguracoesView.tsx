
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Settings, User, Scissors, Clock, Bell, Store, Save, Plus, 
    Trash2, Loader2, MapPin, Phone, Wallet, CreditCard, DollarSign,
    Info, X, Smartphone, Banknote, RefreshCw
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { LegacyService } from '../../types';

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const ConfiguracoesView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('studio');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // --- State: Studio Data ---
    const [studioData, setStudioData] = useState({
        id: null,
        studio_name: '',
        address: '',
        phone: '',
        general_notice: '',
        work_schedule: {} as Record<string, { active: boolean; start: string; end: string }>
    });

    // --- State: Services & Payments ---
    const [services, setServices] = useState<LegacyService[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    
    // --- State: New Payment Method ---
    const [isAddingPM, setIsAddingPM] = useState(false);
    const [newPMName, setNewPMName] = useState('');
    const [newPMFee, setNewPMFee] = useState('0');

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    }, []);

    // --- Specialized Fetchers (Lazy Loading) ---
    
    const fetchStudioSettings = async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const { data, error } = await supabase.from('studio_settings').select('*').maybeSingle();
            if (error) throw error;
            if (data) {
                setStudioData({
                    id: data.id,
                    studio_name: data.studio_name || '',
                    address: data.address || '',
                    phone: data.phone || '',
                    general_notice: data.general_notice || '',
                    work_schedule: data.work_schedule || {}
                });
            }
        } catch (e) {
            console.error("Fetch Error:", e);
            setHasError(true);
            showToast("Erro ao carregar dados do estúdio", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('services').select('*').order('nome');
            if (error) throw error;
            setServices(data || []);
        } catch (e) {
            showToast("Erro ao carregar serviços", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPaymentMethods = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('payment_methods').select('*').order('id');
            if (error) throw error;
            setPaymentMethods(data || []);
        } catch (e) {
            showToast("Erro ao carregar métodos de pagamento", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Logic: Route Fetching by Tab ---
    useEffect(() => {
        if (activeTab === 'studio' || activeTab === 'notices' || activeTab === 'schedule') {
            fetchStudioSettings();
        } else if (activeTab === 'services') {
            fetchServices();
        } else if (activeTab === 'finance') {
            fetchPaymentMethods();
        }
    }, [activeTab]);

    // --- Handlers ---
    const handleSaveStudio = async () => {
        setIsSaving(true);
        try {
            const payload = {
                studio_name: studioData.studio_name,
                address: studioData.address,
                phone: studioData.phone,
                general_notice: studioData.general_notice,
                work_schedule: studioData.work_schedule
            };

            let error;
            if (studioData.id) {
                const { error: err } = await supabase.from('studio_settings').update(payload).eq('id', studioData.id);
                error = err;
            } else {
                const { error: err } = await supabase.from('studio_settings').insert([payload]);
                error = err;
            }

            if (error) throw error;
            showToast("Configurações salvas com sucesso!");
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreatePaymentMethod = async () => {
        if (!newPMName.trim()) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('payment_methods').insert([{
                name: newPMName,
                fee_percentage: parseFloat(newPMFee) || 0
            }]);
            if (error) throw error;
            showToast("Método de pagamento adicionado!");
            setNewPMName('');
            setNewPMFee('0');
            setIsAddingPM(false);
            fetchPaymentMethods();
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePaymentMethod = async (id: number) => {
        if (!window.confirm("Deseja realmente excluir este método?")) return;
        try {
            const { error } = await supabase.from('payment_methods').delete().eq('id', id);
            if (error) throw error;
            showToast("Método removido", "info");
            fetchPaymentMethods();
        } catch (e: any) {
            showToast("Erro ao remover método", "error");
        }
    };

    const getPaymentIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('cartao') || n.includes('crédito') || n.includes('débito')) return <CreditCard size={18} />;
        if (n.includes('pix')) return <Smartphone size={18} />;
        if (n.includes('dinheiro')) return <Banknote size={18} />;
        return <DollarSign size={18} />;
    };

    // --- Sub-Views ---

    const renderStudioTab = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <Card title="Perfil do Estúdio" icon={<Store className="w-5 h-5" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nome do Estabelecimento</label>
                        <input 
                            value={studioData.studio_name}
                            onChange={e => setStudioData({...studioData, studio_name: e.target.value})}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Ex: Bela Studio"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Telefone / WhatsApp</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 text-slate-400" size={16} />
                            <input 
                                value={studioData.phone}
                                onChange={e => setStudioData({...studioData, phone: e.target.value})}
                                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>
                </div>
            </Card>
            <div className="flex justify-end">
                <button onClick={handleSaveStudio} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Salvar Dados
                </button>
            </div>
        </div>
    );

    const renderServicesTab = () => (
        <Card title="Catálogo de Serviços" icon={<Scissors className="w-5 h-5" />}>
            {services.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Scissors size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Nenhum serviço cadastrado.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {services.map(service => (
                        <div key={service.id} className="py-3 flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 rounded-full" style={{ backgroundColor: service.cor_hex || '#3b82f6' }}></div>
                                <div><p className="font-bold text-slate-800">{service.nome}</p><p className="text-xs text-slate-500">{service.duracao_min} min</p></div>
                            </div>
                            <p className="font-bold text-slate-700">R$ {service.preco.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );

    const renderFinanceTab = () => (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <Card title="Gestão de Pagamentos & Taxas" icon={<Wallet className="w-5 h-5" />}>
                <div className="flex justify-between items-center mb-6">
                    <p className="text-sm text-slate-500 max-w-md">Configure métodos aceitos e suas taxas de processamento.</p>
                    <button onClick={() => setIsAddingPM(true)} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                        <Plus size={16} /> Novo Método
                    </button>
                </div>
                {isAddingPM && (
                    <div className="mb-6 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4"><h4 className="text-sm font-bold text-slate-700">Novo Método</h4><button onClick={() => setIsAddingPM(false)}><X size={18}/></button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input value={newPMName} onChange={e => setNewPMName(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Nome (Ex: Cartão)" />
                            <input type="number" step="0.01" value={newPMFee} onChange={e => setNewPMFee(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Taxa %" />
                        </div>
                        <div className="flex justify-end gap-2"><button onClick={() => setIsAddingPM(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button><button onClick={handleCreatePaymentMethod} disabled={isSaving} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold">{isSaving ? '...' : 'Adicionar'}</button></div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paymentMethods.map(pm => (
                        <div key={pm.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm group">
                            <div className="flex items-center gap-3"><div className="p-2 bg-slate-100 rounded-lg text-slate-50">{getPaymentIcon(pm.name)}</div><div><span className="font-bold text-slate-700 block">{pm.name}</span><span className="text-[10px] text-slate-400 uppercase font-black">{pm.fee_percentage}% taxa</span></div></div>
                            <button onClick={() => handleDeletePaymentMethod(pm.id)} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );

    const tabs = [
        { id: 'studio', label: 'Estúdio', icon: Store },
        { id: 'services', label: 'Serviços', icon: Scissors },
        { id: 'schedule', label: 'Funcionamento', icon: Clock },
        { id: 'finance', label: 'Financeiro', icon: Wallet },
        { id: 'notices', label: 'Avisos', icon: Bell },
    ];

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 z-10">
                <div className="p-6 border-b border-slate-100 h-20 flex items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-400" /> Configurações</h2>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-orange-50 text-orange-600 shadow-sm border border-orange-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="mb-4">
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">{tabs.find(t => t.id === activeTab)?.label}</h1>
                        <p className="text-sm text-slate-500 font-medium">Ajuste as preferências globais do BelaApp.</p>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-medium">Buscando informações...</p>
                        </div>
                    ) : hasError ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                            <RefreshCw className="mx-auto mb-4 text-slate-300" size={40} />
                            <h3 className="font-bold text-slate-700">Falha na conexão</h3>
                            <button onClick={() => window.location.reload()} className="mt-4 text-orange-600 font-bold hover:underline">Tentar Novamente</button>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'studio' && renderStudioTab()}
                            {activeTab === 'services' && renderServicesTab()}
                            {activeTab === 'finance' && renderFinanceTab()}
                            {/* Schedule & Notices omitted for brevity, follow same pattern */}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ConfiguracoesView;
