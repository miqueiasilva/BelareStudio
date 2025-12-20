
import React, { useState, useEffect } from 'react';
import { 
    Settings, User, Scissors, Clock, Bell, Store, Save, Plus, 
    Trash2, Edit2, Search, ChevronLeft, Menu, ChevronRight, 
    Loader2, MapPin, Phone, Wallet, CreditCard, DollarSign,
    CheckCircle, Info, Calendar, X, Smartphone, Banknote
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
    const [isLoading, setIsLoading] = useState(true);

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

    const showToast = (message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    };

    // --- Data Fetching ---
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Studio Settings
            const { data: studio, error: studioErr } = await supabase
                .from('studio_settings')
                .select('*')
                .maybeSingle();
            
            if (studio) {
                setStudioData({
                    id: studio.id,
                    studio_name: studio.studio_name || '',
                    address: studio.address || '',
                    phone: studio.phone || '',
                    general_notice: studio.general_notice || '',
                    work_schedule: studio.work_schedule || {}
                });
            }

            // 2. Services
            const { data: svcs } = await supabase.from('services').select('*').order('nome');
            if (svcs) setServices(svcs);

            // 3. Payment Methods
            const { data: payments } = await supabase.from('payment_methods').select('*').order('id');
            if (payments) setPaymentMethods(payments);

        } catch (e) {
            console.error(e);
            showToast("Erro ao carregar configurações", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
            fetchData();
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdatePaymentFee = async (id: number, fee: number) => {
        try {
            const { error } = await supabase.from('payment_methods').update({ fee_percentage: fee }).eq('id', id);
            if (error) throw error;
            setPaymentMethods(prev => prev.map(p => p.id === id ? { ...p, fee_percentage: fee } : p));
            showToast("Taxa atualizada");
        } catch (e) {
            showToast("Erro ao atualizar taxa", "error");
        }
    };

    const handleCreatePaymentMethod = async () => {
        if (!newPMName.trim()) return;
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
            fetchData();
        } catch (e: any) {
            showToast(e.message, "error");
        }
    };

    const handleDeletePaymentMethod = async (id: number) => {
        if (!window.confirm("Deseja realmente excluir este método de pagamento?")) return;
        try {
            const { error } = await supabase.from('payment_methods').delete().eq('id', id);
            if (error) throw error;
            showToast("Método removido", "info");
            fetchData();
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
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Endereço Completo</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                            <input 
                                value={studioData.address}
                                onChange={e => setStudioData({...studioData, address: e.target.value})}
                                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                placeholder="Rua, Número, Bairro, Cidade - UF"
                            />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end">
                <button 
                    onClick={handleSaveStudio}
                    disabled={isSaving}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-200 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Salvar Dados do Estúdio
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
                                <div className="w-2 h-8 rounded-full" style={{ backgroundColor: service.color }}></div>
                                <div>
                                    <p className="font-bold text-slate-800">{service.name}</p>
                                    <p className="text-xs text-slate-500">{service.duration} min</p>
                                </div>
                            </div>
                            <p className="font-bold text-slate-700">R$ {service.price.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );

    const renderScheduleTab = () => (
        <Card title="Horários de Funcionamento" icon={<Clock className="w-5 h-5" />}>
            <div className="space-y-3">
                {DAYS_OF_WEEK.map(day => {
                    const config = studioData.work_schedule[day.key] || { active: true, start: '09:00', end: '18:00' };
                    const updateDay = (field: string, value: any) => {
                        setStudioData({
                            ...studioData,
                            work_schedule: {
                                ...studioData.work_schedule,
                                [day.key]: { ...config, [field]: value }
                            }
                        });
                    };

                    return (
                        <div key={day.key} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${config.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-transparent opacity-50'}`}>
                            <div className="flex items-center gap-4">
                                <ToggleSwitch on={config.active} onClick={() => updateDay('active', !config.active)} />
                                <span className="font-bold text-slate-700 min-w-[120px]">{day.label}</span>
                            </div>
                            {config.active && (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="time" 
                                        value={config.start} 
                                        onChange={e => updateDay('start', e.target.value)}
                                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold focus:ring-1 focus:ring-orange-500 outline-none"
                                    />
                                    <span className="text-slate-300">até</span>
                                    <input 
                                        type="time" 
                                        value={config.end} 
                                        onChange={e => updateDay('end', e.target.value)}
                                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold focus:ring-1 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            )}
                            {!config.active && <span className="text-xs font-black text-slate-400 uppercase tracking-widest mr-4">Fechado</span>}
                        </div>
                    );
                })}
            </div>
            <div className="mt-6 flex justify-end">
                <button 
                    onClick={handleSaveStudio}
                    className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                    <Save size={16} /> Salvar Horários
                </button>
            </div>
        </Card>
    );

    const renderNoticesTab = () => (
        <Card title="Comunicado Geral" icon={<Bell className="w-5 h-5" />}>
            <p className="text-sm text-slate-500 mb-4">Este aviso será exibido no dashboard principal para todos os colaboradores.</p>
            <textarea 
                value={studioData.general_notice}
                onChange={e => setStudioData({...studioData, general_notice: e.target.value})}
                className="w-full h-48 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none resize-none bg-slate-50 font-medium"
                placeholder="Ex: Atenção equipe, reunião geral na próxima segunda às 08h..."
            />
            <div className="mt-4 flex justify-end">
                <button 
                    onClick={handleSaveStudio}
                    className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                    <Save size={16} /> Publicar Aviso
                </button>
            </div>
        </Card>
    );

    const renderFinanceTab = () => (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <Card title="Gestão de Pagamentos & Taxas" icon={<Wallet className="w-5 h-5" />}>
                <div className="flex justify-between items-center mb-6">
                    <p className="text-sm text-slate-500 max-w-md">Configure os métodos aceitos e suas taxas. Isso afeta o cálculo líquido das comissões.</p>
                    <button 
                        onClick={() => setIsAddingPM(true)}
                        className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"
                    >
                        <Plus size={16} /> Novo Método
                    </button>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6 flex gap-3">
                    <Info className="text-blue-500 flex-shrink-0" size={20} />
                    <p className="text-xs text-blue-700">As taxas cadastradas aqui são descontadas automaticamente do valor bruto para gerar o faturamento real antes do cálculo das comissões da equipe.</p>
                </div>

                {/* Form to add new Payment Method */}
                {isAddingPM && (
                    <div className="mb-6 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-700">Novo Método de Pagamento</h4>
                            <button onClick={() => setIsAddingPM(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome do Método</label>
                                <input 
                                    value={newPMName}
                                    onChange={e => setNewPMName(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                                    placeholder="Ex: Cartão de Crédito"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Processamento (%)</label>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={newPMFee}
                                    onChange={e => setNewPMFee(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddingPM(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                            <button onClick={handleCreatePaymentMethod} className="px-4 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-md shadow-orange-100">Adicionar Método</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paymentMethods.map(pm => (
                        <div key={pm.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm hover:border-slate-300 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                    {getPaymentIcon(pm.name)}
                                </div>
                                <div>
                                    <span className="font-bold text-slate-700 block">{pm.name}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-black">ID: {pm.id}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        step="0.01"
                                        value={pm.fee_percentage}
                                        onChange={e => handleUpdatePaymentFee(pm.id, parseFloat(e.target.value))}
                                        className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-right font-bold text-orange-600 focus:ring-1 focus:ring-orange-500 outline-none"
                                    />
                                    <span className="text-slate-400 font-bold text-sm">%</span>
                                </div>
                                <button 
                                    onClick={() => handleDeletePaymentMethod(pm.id)}
                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Excluir Método"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {paymentMethods.length === 0 && !isAddingPM && (
                        <div className="col-span-2 py-8 text-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-400">
                            Nenhum método de pagamento configurado.
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );

    const renderStaffTab = () => (
        <Card className="text-center py-12">
            <User className="w-16 h-16 text-orange-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Gestão de Colaboradores</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">
                Para gerenciar permissões, serviços habilitados e horários individuais da equipe, utilize o menu "Clientes / Equipe" no menu principal.
            </p>
            <button 
                onClick={() => window.location.hash = '#/clientes'}
                className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-600 transition flex items-center gap-2 mx-auto"
            >
                Acessar Gestão de Equipe <ChevronRight size={16} />
            </button>
        </Card>
    );

    const tabs = [
        { id: 'studio', label: 'Estúdio', icon: Store },
        { id: 'services', label: 'Serviços', icon: Scissors },
        { id: 'schedule', label: 'Funcionamento', icon: Clock },
        { id: 'notices', label: 'Avisos', icon: Bell },
        { id: 'finance', label: 'Financeiro', icon: Wallet },
        { id: 'staff', label: 'Equipe', icon: User },
    ];

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
            </div>
        );
    }

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 z-10">
                <div className="p-6 border-b border-slate-100 h-20 flex items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="w-6 h-6 text-slate-400" /> Configurações
                    </h2>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                                activeTab === tab.id ? 'bg-orange-50 text-orange-600 shadow-sm border border-orange-100' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="mb-4">
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Configure as preferências do seu estúdio.</p>
                    </div>

                    {activeTab === 'studio' && renderStudioTab()}
                    {activeTab === 'services' && renderServicesTab()}
                    {activeTab === 'schedule' && renderScheduleTab()}
                    {activeTab === 'notices' && renderNoticesTab()}
                    {activeTab === 'finance' && renderFinanceTab()}
                    {activeTab === 'staff' && renderStaffTab()}
                </div>
            </main>
        </div>
    );
};

export default ConfiguracoesView;
