
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Settings, User, Scissors, Clock, Bell, Store, Save, Plus, 
    Trash2, Edit2, Search, Filter, ChevronLeft, Menu, ChevronRight, 
    Camera, Loader2, MapPin, Phone, Mail, FileText, Coffee, CheckCircle,
    CreditCard, DollarSign, Wallet, Smartphone
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { ServiceModal, ProfessionalModal } from '../modals/ConfigModals';
import { LegacyService, LegacyProfessional } from '../../types';
import ProfessionalDetail from './ProfessionalDetail';
import { supabase, testConnection } from '../../services/supabaseClient';

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const showToast = (message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    };

    // --- State: Studio Data ---
    const [studioSettings, setStudioSettings] = useState<any>({
        id: null,
        studio_name: '',
        address: '',
        phone: '',
        general_notice: '',
        work_schedule: {}
    });

    // --- State: Services & Team ---
    const [servicesData, setServicesData] = useState<LegacyService[]>([]);
    const [colaboradores, setColaboradores] = useState<LegacyProfessional[]>([]);
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
    const [serviceSearch, setServiceSearch] = useState('');
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

    // --- Modals ---
    const [serviceModal, setServiceModal] = useState<{ open: boolean; data: LegacyService | null }>({ open: false, data: null });
    const [profModal, setProfModal] = useState<{ open: boolean; data: LegacyProfessional | null }>({ open: false, data: null });

    // --- Fetchers ---

    const fetchStudioSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('studio_settings')
                .select('*')
                .limit(1)
                .maybeSingle();
            
            if (error) throw error;
            if (data) {
                setStudioSettings(data);
            }
        } catch (e) {
            console.error("Erro studio_settings:", e);
        }
    };

    const fetchServices = async () => {
        try {
            const { data, error } = await supabase.from('services').select('*').order('name');
            if (error) throw error;
            setServicesData(data || []);
        } catch (e) { console.error(e); }
    };

    const fetchColaboradores = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('professionals')
                .select('*')
                .order('name');
            
            if (error) throw error;
            setColaboradores(data || []);
        } catch (error) {
            console.error("Erro profissionais:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPaymentMethods = async () => {
        try {
            const { data, error } = await supabase.from('payment_methods').select('*').order('id');
            if (error) throw error;
            setPaymentMethods(data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (window.innerWidth < 768) setIsSidebarOpen(false);
        fetchStudioSettings();
        fetchServices();
        fetchColaboradores();
        fetchPaymentMethods();
    }, []);

    // --- Handlers: Save ---

    const handleSaveStudio = async () => {
        setIsSaving(true);
        try {
            const payload = {
                studio_name: studioSettings.studio_name,
                address: studioSettings.address,
                phone: studioSettings.phone,
                general_notice: studioSettings.general_notice,
                work_schedule: studioSettings.work_schedule
            };

            const { error } = await supabase
                .from('studio_settings')
                .update(payload)
                .eq('id', studioSettings.id);

            if (error) throw error;
            showToast("Configurações do estúdio salvas!");
        } catch (e: any) {
            showToast(`Erro ao salvar: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveService = async (service: LegacyService) => {
        try {
            const payload = {
                name: service.name,
                price: service.price,
                duration: service.duration,
                category: service.category,
                color: service.color
            };

            if (service.id && service.id < 1000000000) {
                await supabase.from('services').update(payload).eq('id', service.id);
            } else {
                await supabase.from('services').insert([payload]);
            }
            fetchServices();
            setServiceModal({ open: false, data: null });
            showToast("Serviço salvo com sucesso!");
        } catch (e) { showToast("Erro ao salvar serviço", "error"); }
    };

    const handleDeleteService = async (id: number) => {
        if (!window.confirm("Excluir este serviço?")) return;
        try {
            await supabase.from('services').delete().eq('id', id);
            fetchServices();
            showToast("Serviço removido");
        } catch (e) { showToast("Erro ao remover", "error"); }
    };

    const handleSaveProfessional = async (prof: LegacyProfessional) => {
        fetchColaboradores();
        setProfModal({ open: false, data: null });
        setSelectedProfessionalId(null);
        showToast(`Dados de "${prof.name}" atualizados!`);
    };

    const handleSaveFinance = async () => {
        setIsSaving(true);
        try {
            const promises = paymentMethods.map(pm => 
                supabase.from('payment_methods').update({ fee_percentage: pm.fee_percentage }).eq('id', pm.id)
            );
            await Promise.all(promises);
            showToast("Taxas atualizadas com sucesso!");
        } catch (e) {
            showToast("Erro ao salvar taxas financeiras", "error");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Views ---

    const renderStudioTab = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card title="Dados do Estúdio" icon={<Store size={18}/>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Nome Comercial</label>
                        <input 
                            value={studioSettings.studio_name || ''} 
                            onChange={e => setStudioSettings({...studioSettings, studio_name: e.target.value})}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">WhatsApp de Contato</label>
                        <input 
                            value={studioSettings.phone || ''} 
                            onChange={e => setStudioSettings({...studioSettings, phone: e.target.value})}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" 
                        />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Endereço Completo</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                            <input 
                                value={studioSettings.address || ''} 
                                onChange={e => setStudioSettings({...studioSettings, address: e.target.value})}
                                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none" 
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={handleSaveStudio} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100 disabled:opacity-50">
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        Salvar Informações
                    </button>
                </div>
            </Card>
        </div>
    );

    const renderServicesTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <Card>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Scissors size={20} className="text-orange-500" /> Catálogo de Serviços
                    </h3>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                placeholder="Filtrar..." 
                                value={serviceSearch}
                                onChange={e => setServiceSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <button onClick={() => setServiceModal({ open: true, data: null })} className="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                            <Plus size={18}/> Novo
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b">
                            <tr>
                                <th className="px-4 py-3">Serviço</th>
                                <th className="px-4 py-3">Duração</th>
                                <th className="px-4 py-3 text-right">Preço</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {servicesData.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).map(service => (
                                <tr key={service.id} className="hover:bg-slate-50/50 group">
                                    <td className="px-4 py-3 font-bold text-slate-700">{service.name}</td>
                                    <td className="px-4 py-3 text-slate-500">{service.duration} min</td>
                                    <td className="px-4 py-3 text-right font-black text-slate-800">R$ {service.price.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setServiceModal({ open: true, data: service })} className="p-1.5 text-slate-400 hover:text-orange-500 rounded-lg"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDeleteService(service.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );

    const renderScheduleTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <Card title="Funcionamento Geral" icon={<Clock size={18}/>}>
                <p className="text-sm text-slate-500 mb-6">Defina os horários padrão que o estúdio abre para o público.</p>
                <div className="space-y-3">
                    {DAYS_OF_WEEK.map(day => {
                        const config = studioSettings.work_schedule?.[day.key] || { active: true, start: '09:00', end: '18:00' };
                        const updateDay = (val: any) => {
                            setStudioSettings({
                                ...studioSettings,
                                work_schedule: { ...studioSettings.work_schedule, [day.key]: val }
                            });
                        };
                        return (
                            <div key={day.key} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${config.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-transparent opacity-50'}`}>
                                <div className="flex items-center gap-4">
                                    <ToggleSwitch on={config.active} onClick={() => updateDay({...config, active: !config.active})} />
                                    <span className="font-bold text-slate-700">{day.label}</span>
                                </div>
                                {config.active && (
                                    <div className="flex items-center gap-2">
                                        <input type="time" value={config.start} onChange={e => updateDay({...config, start: e.target.value})} className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-600 outline-none" />
                                        <span className="text-slate-300 font-bold">às</span>
                                        <input type="time" value={config.end} onChange={e => updateDay({...config, end: e.target.value})} className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-600 outline-none" />
                                    </div>
                                )}
                                {!config.active && <span className="text-xs font-black text-slate-400 uppercase tracking-widest mr-4">Fechado</span>}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={handleSaveStudio} className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2">
                        <Save size={18}/> Salvar Horários
                    </button>
                </div>
            </Card>
        </div>
    );

    const renderNotificationsTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <Card title="Avisos e Comunicados" icon={<Bell size={18}/>}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Mural de Recados (Equipe)</label>
                        <textarea 
                            value={studioSettings.general_notice || ''}
                            onChange={e => setStudioSettings({...studioSettings, general_notice: e.target.value})}
                            placeholder="Este aviso aparecerá no dashboard de todos os colaboradores..."
                            className="w-full border border-slate-200 rounded-2xl p-4 h-48 focus:ring-2 focus:ring-orange-500 outline-none resize-none bg-slate-50/50"
                        />
                    </div>
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex gap-3">
                        <Bell className="text-orange-500" size={20} />
                        <p className="text-xs text-orange-700 leading-relaxed">
                            <b>Dica:</b> Use este espaço para informar sobre promoções internas, metas do mês ou avisos importantes de manutenção.
                        </p>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={handleSaveStudio} className="bg-orange-500 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100">
                        <Save size={18}/> Publicar no Mural
                    </button>
                </div>
            </Card>
        </div>
    );

    const renderTeamTab = () => (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Equipe ({colaboradores.length})</h3>
                <button onClick={() => setProfModal({ open: true, data: null })} className="text-xs font-black text-orange-600 uppercase tracking-widest hover:underline">+ Adicionar Colaborador</button>
            </div>
            <ul className="divide-y divide-slate-50">
                {colaboradores.map(colab => (
                    <li key={colab.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedProfessionalId(colab.id)}>
                        <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-full border-2 border-orange-500 shadow-sm overflow-hidden bg-slate-100">
                                {colab.photo_url ? (
                                    <img src={colab.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : <User className="m-3 text-slate-400" size={24} />}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{colab.name}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{colab.role || 'Colaborador'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${colab.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {colab.active ? 'Ativo' : 'Inativo'}
                            </span>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );

    const renderFinanceTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <Card title="Configurações Financeiras" icon={<DollarSign size={18}/>}>
                <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                    <CreditCard className="text-blue-500 flex-shrink-0" size={20} />
                    <p className="text-sm text-blue-700 leading-relaxed">
                        Defina as taxas cobradas pela sua maquininha de cartão. Essas taxas serão descontadas das comissões se a opção estiver ativa no perfil do colaborador.
                    </p>
                </div>

                <div className="space-y-4">
                    {paymentMethods.map((pm, idx) => (
                        <div key={pm.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-blue-200 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 shadow-sm transition-colors">
                                    {pm.name.toLowerCase().includes('cartao') || pm.name.toLowerCase().includes('credito') || pm.name.toLowerCase().includes('debito') ? <CreditCard size={18}/> : pm.name.toLowerCase().includes('pix') ? <Smartphone className="w-4 h-4" /> : <DollarSign size={18}/>}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{pm.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Taxa de Operação</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <input 
                                        type="number"
                                        step="0.01"
                                        value={pm.fee_percentage}
                                        onChange={e => {
                                            const newMethods = [...paymentMethods];
                                            newMethods[idx].fee_percentage = Number(e.target.value);
                                            setPaymentMethods(newMethods);
                                        }}
                                        className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-right font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={handleSaveFinance} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-50 transition-all">
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        Salvar Taxas
                    </button>
                </div>
            </Card>
        </div>
    );

    // --- Main Render ---

    if (activeTab === 'team' && selectedProfessionalId) {
        const selectedProf = colaboradores.find(p => p.id === selectedProfessionalId);
        if (selectedProf) {
            return (
                <ProfessionalDetail 
                    professional={selectedProf}
                    services={servicesData}
                    onBack={() => setSelectedProfessionalId(null)}
                    onSave={handleSaveProfessional}
                />
            );
        }
    }

    const tabs = [
        { id: 'studio', label: 'Estúdio', icon: Store },
        { id: 'services', label: 'Serviços', icon: Scissors },
        { id: 'team', label: 'Colaboradores', icon: User },
        { id: 'finance', label: 'Financeiro', icon: Wallet },
        { id: 'schedule', label: 'Horários', icon: Clock },
        { id: 'notifications', label: 'Mural de Avisos', icon: Bell },
    ];

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden relative font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Sidebar de Configurações */}
            <aside className={`bg-white border-r border-slate-200 flex-col flex-shrink-0 transition-all duration-300 ease-in-out fixed md:relative z-30 h-full ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden'}`}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center h-20 bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 truncate">
                        <Settings className="w-6 h-6 text-slate-400" /> Configurações
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-1 w-64">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-orange-50 text-orange-600 shadow-sm border border-orange-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
                <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        <CheckCircle size={10} className="text-green-500" /> Banco de Dados
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Sincronizado via Supabase</p>
                </div>
            </aside>

            {/* Conteúdo Principal */}
            <main className="flex-1 overflow-y-auto w-full">
                <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center gap-4 mb-4">
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm"><Menu size={20}/></button>
                        )}
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{tabs.find(t => t.id === activeTab)?.label}</h3>
                            <p className="text-xs text-slate-500 font-medium">Ajuste as preferências globais do BelaApp</p>
                        </div>
                    </div>

                    {/* RENDER CONTENT BY TAB */}
                    {activeTab === 'studio' && renderStudioTab()}
                    {activeTab === 'services' && renderServicesTab()}
                    {activeTab === 'team' && renderTeamTab()}
                    {activeTab === 'finance' && renderFinanceTab()}
                    {activeTab === 'schedule' && renderScheduleTab()}
                    {activeTab === 'notifications' && renderNotificationsTab()}
                </div>
            </main>

            {/* Modals Globais */}
            {serviceModal.open && (
                <ServiceModal 
                    service={serviceModal.data} 
                    availableCategories={['Cabelo', 'Unhas', 'Cílios', 'Sobrancelha', 'Estética', 'Geral']} 
                    onClose={() => setServiceModal({ open: false, data: null })} 
                    onSave={handleSaveService} 
                />
            )}
            {profModal.open && (
                <ProfessionalModal 
                    professional={profModal.data} 
                    onClose={() => setProfModal({ open: false, data: null })} 
                    onSave={handleSaveProfessional} 
                />
            )}
        </div>
    );
};

export default ConfiguracoesView;
